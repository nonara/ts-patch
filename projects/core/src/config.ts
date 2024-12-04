import path from 'path';
import fs from "fs";
import ts from 'typescript';


/* ****************************************************************************************************************** */
// region: Library Config
/* ****************************************************************************************************************** */

/**
 * Root directory for ts-patch
 */
// TODO - This should be improved at some point
export const appRoot = (() => {
  const moduleDir = __dirname;

  const chkFile = (pkgFile: string) =>
    (fs.existsSync(pkgFile) && (require(pkgFile).name === 'ts-patch')) ? path.dirname(pkgFile) : void 0;

  const res = chkFile(path.join(moduleDir, 'package.json')) || chkFile(path.join(moduleDir, '../../../package.json'));

  if (!res) throw new Error(`Error getting app root. No valid ts-patch package file found in ` + moduleDir);

  return res;
})();

/**
 * Package json for ts-patch
 */
export const tspPackageJSON = require(path.resolve(appRoot, 'package.json'));

export const RESOURCES_PATH = path.join(appRoot, tspPackageJSON.directories.resources);

export const defaultNodePrinterOptions: ts.PrinterOptions = {
  newLine: ts.NewLineKind.LineFeed,
  removeComments: false
};

// endregion


/* ****************************************************************************************************************** */
// region: Patch Config
/* ****************************************************************************************************************** */

export const defaultInstallLibraries = [ 'tsc.js', 'typescript.js', '_tsc.js' ];

export const corePatchName = `<core>`;

export const modulePatchFilePath = path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.js');
export const dtsPatchFilePath = path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.d.ts');

export const execTscCmd = 'execTsc';

// endregion


/* ****************************************************************************************************************** */
// region: Cache Config
/* ****************************************************************************************************************** */

export const cachedFilePatchedPrefix = 'patched.';
export const lockFileDir = 'locks';

// endregion
