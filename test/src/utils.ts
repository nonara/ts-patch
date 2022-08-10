import * as path from 'path';
import { default as mock } from 'mock-fs';
import { assetsDir, rootDir, testRootDir, tsModules } from './config';
import { BACKUP_DIRNAME } from 'ts-patch/src/installer/lib/actions';
import fs from 'fs';
import os from 'os';

/* ****************************************************************************************************************** *
 * Locals
 * ****************************************************************************************************************** */

const nodeModulesRoot = path.join(testRootDir, 'node_modules');

function loadDirs(mockBase: string, dir: string, predicate?: (p: string) => boolean, lazy?: boolean) {
  let dirs = fs.readdirSync(dir, { withFileTypes: true })
    .map(entry => [ entry.name, joinPaths(mockBase, entry.name), joinPaths(dir, entry.name) ])

  if (predicate) dirs = dirs.filter(([ dirName ]) => predicate(dirName));

  return Object.fromEntries(dirs.map(([ _, mockPath, fullPath ]) => [ mockPath, mock.load(fullPath, { lazy }) ]));
}

/* ****************************************************************************************************************** */
// region: Mock Utils
/* ****************************************************************************************************************** */

export function mockFs(tsModuleSpecifier: string = 'ts-latest') {
  mockFs.initialize(tsModuleSpecifier);
  resetFs();
}

export function resetFs() {
  mock.restore();
  mock({ ...mockFs.cachedMapping, ...mockFs.staticMapping });
}

export function restoreFs() {
  mock.restore();
}

export namespace mockFs {
  let currentModuleSpecifier: string;

  export let cachedMapping: any;
  export let staticMapping: any;

  export const mockRootDir = os.platform() === 'win32' ? 'C:\\' : '/';
  export const nodeModulesDir = path.join(mockRootDir, 'node_modules');
  export const tspDir = path.join(nodeModulesDir, 'ts-patch');
  export const tsDir = path.join(nodeModulesDir, 'typescript');
  export const tsLibDir = path.join(nodeModulesDir, 'typescript/lib');
  export const tsBackupDir = path.join(nodeModulesDir, 'typescript/' + BACKUP_DIRNAME);

  let _cached: any;
  let _static: any;

  export function initialize(tsModuleSpecifier: string) {
    const oldModuleSpecifier = currentModuleSpecifier;
    currentModuleSpecifier = tsModuleSpecifier;

    Object.defineProperties(mockFs, {
      cachedMapping: {
        get() {
          if (currentModuleSpecifier !== oldModuleSpecifier || !_cached)
            _cached = {
              ...loadDirs(
                mockFs.tspDir,
                path.join(nodeModulesRoot, 'ts-patch'),
                (dirName) => dirName !== 'test' && dirName[0] !== '.',
                false
              ),
              [mockFs.tsDir]: mock.load(tsModules.find(m => m.moduleSpecifier === tsModuleSpecifier)!.tsDir, { lazy: false }),
            };

          return _cached;
        }
      },
      staticMapping: {
        get() {
          _static ??= {
            ...loadDirs(mockFs.nodeModulesDir, nodeModulesRoot, (dirName) => dirName !== 'ts-patch'),
            [path.join(mockFs.mockRootDir, '/package.json')]: mock.load(path.join(assetsDir, 'test-package.json')),
            [path.join(rootDir, 'dist')]: mock.load(path.join(rootDir, 'dist'))
          };

          return _static;
        }
      }
    });
  }
}

// endregion


/* ****************************************************************************************************************** */
// region: General Utils
/* ****************************************************************************************************************** */

export const joinPaths = (...p: string[]) => path.join(...p).replace(/\\+/g, '/');

// endregion
