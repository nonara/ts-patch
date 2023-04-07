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

export const testRootDir = normalizeSlashes(path.resolve(__dirname, '..'));
export const rootDir = normalizeSlashes(path.resolve(__dirname, '../../'));
export const resourcesDir = normalizeSlashes(path.resolve(__dirname, '../../dist/resources'));
export const assetsDir = normalizeSlashes(path.resolve(__dirname, '../assets'));
export const projectsDir = normalizeSlashes(path.resolve(assetsDir, 'projects'));

export const tsModules = [
  getTsModule('latest', 'ts-latest'),
]

export const packageManagers = <const>[ 'npm', 'yarn', 'pnpm', 'yarn3' ];

export type PackageManager = typeof packageManagers[number];

// endregion
