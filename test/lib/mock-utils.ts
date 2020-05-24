import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import shell from 'shelljs';
import { default as mock } from 'mock-fs';
import { resourcesDir, testAssetsDir, tsInstallationDirs, tsProjectsDir } from './config';
import { patch } from '../../src/installer';
import { normalizeSlashes } from 'ts-node';
import resolve from 'resolve';


/* ****************************************************************************************************************** */
// region: Constants
/* ****************************************************************************************************************** */

const vanillaFiles = [
  ...cacheDirectory(tsProjectsDir),
  ...cacheDirectory(resourcesDir),
  ...cacheDirectory(testAssetsDir)
];

let patchedFiles = new Map<string, { ts: any, tscCode: string }>();

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function cacheDirectory(dir: string): [ string, string | {} ][] {
  return (shell.ls('-RAl', dir) as unknown as (fs.Stats & { name: string })[]).map(stat => {
    const statPath = normalizeSlashes(path.join(dir, stat.name));
    return [ statPath, stat.isFile() ? fs.readFileSync(statPath, 'utf-8') : {} ]
  });
}

// endregion


/* ****************************************************************************************************************** */
// region: FileSystem
/* ****************************************************************************************************************** */

export function mockFs(fileEntries: [ string, string | {} ][] = vanillaFiles) {
  mock(fileEntries.reduce((p, [key, value]) => { p[key] = value; return p; }, <Record<string, string | {}>>{}));
}

export function restoreFs() {
  mock.restore();
}

export function resetFs() {
  restoreFs();
  mockFs();
}

export function getPatchedTS(version: string): { ts: typeof ts, tscCode: string } {
  /* Create initial patched versions in cache */
  if (!patchedFiles.has(version)) {
    const shellExecSpy = jest.spyOn(shell, 'exec').mockImplementation();
    mockFs();

    /* Patch files & get exports for typescript module */
    [ ...tsInstallationDirs.entries() ].forEach(([ v, dir ]) => {
      patch([ 'typescript.js', 'tsc.js' ], { basedir: dir, silent: true });

      /* Get TS exports */
      const filePath = resolve.sync('typescript', { basedir: dir });
      require(filePath);
      const exports = require.cache[require.resolve(`typescript`, { paths: [ dir ] })]!.exports

      /* Get TSC code */
      const tscCode = fs.readFileSync(resolve.sync('typescript/lib/tsc.js', { basedir: dir }), 'utf-8');
      patchedFiles.set(v, { ts: exports, tscCode });
    });

    restoreFs()
    shellExecSpy.mockRestore();
  }

  return patchedFiles.get(version)!;
}

// endregion


