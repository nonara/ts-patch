import path from 'path';
import fs from "fs";


/* ****************************************************************************************************************** */
// region: Library Config
/* ****************************************************************************************************************** */

/**
 * Root directory for ts-patch
 */
export const appRoot = (() => {
  const moduleDir = path.resolve(__dirname, '..');

  const chkFile = (pkgFile: string) =>
    (fs.existsSync(pkgFile) && (require(pkgFile).name === 'ts-patch')) ? path.dirname(pkgFile) : void 0;

  const res = chkFile(path.join(moduleDir, 'package.json')) || chkFile(path.join(moduleDir, '../../package.json'));

  if (!res) throw new Error(`Error getting app root. No valid ts-patch package file found in ` + moduleDir);

  return res;
})();

/**
 * Package json for ts-patch
 */
export const tspPackageJSON = require(path.resolve(appRoot, 'package.json'));

export const RESOURCES_PATH = path.join(appRoot, tspPackageJSON.directories.resources);

// endregion


/* ****************************************************************************************************************** */
// region: Patch Config
/* ****************************************************************************************************************** */

export const defaultInstallLibraries = [ 'tsc.js', 'typescript.js' ];

export const corePatchName = `<core>`;

export const modulePatchFilePath = path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.js');
export const dtsPatchFilePath = path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.d.ts');

// endregion


/* ****************************************************************************************************************** */
// region: Cache Config
/* ****************************************************************************************************************** */

export const cachedFilePatchedPrefix = 'patched.';
export const lockFileDir = 'locks';

// endregion
