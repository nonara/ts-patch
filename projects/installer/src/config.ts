import path from 'path';
import { appRoot, tspPackageJSON } from './system';
import * as shell from 'shelljs';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

shell.config.silent = true;

export const RESOURCES_PATH = path.join(appRoot, tspPackageJSON.directories.resources);

export const defaultInstallLibraries = [ 'tsc.js', 'typescript.js' ];

// endregion
