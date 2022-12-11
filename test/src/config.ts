import path from 'path';
import { normalizeSlashes } from 'typescript';


/* ****************************************************************************************************************** *
 * Locals
 * ****************************************************************************************************************** */

const getTsModule = (label: string, moduleSpecifier: string) => ({
  moduleSpecifier,
  tsDir: path.resolve(testRootDir, 'node_modules', moduleSpecifier),
  label
});


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

export const tmpDir = normalizeSlashes(path.resolve(__dirname, '../.tmp'))
export const testRootDir = normalizeSlashes(path.resolve(__dirname, '..'));
export const rootDir = normalizeSlashes(path.resolve(__dirname, '../../'));
export const resourcesDir = normalizeSlashes(path.resolve(__dirname, '../../dist/resources'));
export const assetsDir = normalizeSlashes(path.resolve(__dirname, '../assets'));

export const tsModules = [
  getTsModule('latest', 'ts-latest'),
  getTsModule('4.8', 'ts-48'),
  getTsModule('4.0', 'ts-40')
]

// endregion
