import path from 'path';
import * as shell from 'shelljs';
import { normalizeSlashes } from 'ts-node';


/* ****************************************************************************************************************** */
// region: Constants
/* ****************************************************************************************************************** */

export const rootDir = normalizeSlashes(path.resolve(__dirname, '../../'));
export const tsProjectsDir = normalizeSlashes(path.resolve(__dirname, '../assets/ts'));
export const resourcesDir = normalizeSlashes(path.resolve(__dirname, '../../dist/resources'));
export const testAssetsDir = normalizeSlashes(path.resolve(__dirname, '../assets'));

export const tsInstallationDirs: Map<string, string> = new Map(
  shell.ls('-d', path.join(tsProjectsDir, '*')).map(name => [
    name.split('/').pop() as string,
    normalizeSlashes(name)
  ])
);

// endregion
