import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import shell from 'shelljs';
import { default as mock } from 'mock-fs';
import { resourcesDir, testAssetsDir, tsInstallationDirs, tsProjectsDir } from './config';
import { patch } from '../../src/installer';
import { normalizeSlashes } from 'ts-node';
import resolve from 'resolve';
import FileSystem from 'mock-fs/lib/filesystem';


/* ****************************************************************************************************************** */
// region: Constants
/* ****************************************************************************************************************** */

const vanillaFiles = cacheDirectories(
  tsProjectsDir,
  resourcesDir,
  testAssetsDir
);

let patchedFiles = new Map<string, { ts: any, tscCode: string }>();
const cachedFiles = new Map<string, Buffer>();

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

/**
 * Create a DirectoryItems from actual files and directories for mock-fs (uses caching)
 */
function cacheDirectories(...directory: string[]): FileSystem.DirectoryItems {
  const res: FileSystem.DirectoryItems = {};
  for (const dir of directory)
    for (const stat of shell.ls('-RAl', dir) as unknown as (fs.Stats & { name: string })[]) {
      const statPath = normalizeSlashes(path.join(dir, stat.name));
      res[statPath] =
        !stat.isFile() ? {} :
        <ReturnType<typeof mock.file>>(() => {
          const fileData = fs.readFileSync(statPath);
          cachedFiles.set(statPath, fileData);

          return Object.defineProperty(mock.file({ content: '' })(), '_content', {
            get: () => cachedFiles.get(statPath),
            set: (data: any) => cachedFiles.set(statPath, data)
          });
        });
    }

  return res;
}

// endregion


/* ****************************************************************************************************************** */
// region: FileSystem
/* ****************************************************************************************************************** */

export function mockFs() {
  mock(vanillaFiles);
}

export function restoreFs() {
  mock.restore();
  cachedFiles.clear();
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


