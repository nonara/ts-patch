import path from "path";
import os from "os";
import { BACKUP_DIRNAME, SRC_FILES } from '../../src/lib/actions';
import fs from "fs";
import resolve from 'resolve';
import shell from 'shelljs';
import { getModuleAbsolutePath, mkdirIfNotExist } from '../../src/lib/file-utils';
import { appRoot } from '../../src/lib/system';


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

export const tmpDir = path.join(os.tmpdir(), 'tmpTSDir');
export const srcDir = path.dirname(resolve.sync('typescript/package.json'));
export const destDir = path.join(tmpDir, 'node_modules', 'typescript');
export const libDir = path.join(destDir, 'lib');
export const backupDir = path.join(destDir, BACKUP_DIRNAME);
const fakePkgDir = path.resolve(tmpDir,'fake-pkg');

const files = SRC_FILES.map(f => getModuleAbsolutePath(f, path.join(srcDir, 'lib')));


/* ********************************************************************************************************************
 * Fake Installation
 * ********************************************************************************************************************/

export function createFakeTSInstallation(tsVersion: string = '2.7.1') {
  const pkgJSON = `{ 
    "name": "fake-module", 
    "version": "1.0.0", 
    "dependencies": { "typescript": "${tsVersion}", "ts-patch": "file:ts-patch" } 
  }`;

  /* Setup temp dir */
  removeFakeInstallation();
  try { mkdirIfNotExist(path.join(destDir,'lib')) }
  catch (e) { throw new Error(`Could not create temp directory! ${e.message}`); }

  // Write fake module package JSON file
  fs.writeFileSync(path.join(tmpDir, 'package.json'), pkgJSON);

  // Write typescript package JSON file
  fs.writeFileSync(path.join(destDir, 'package.json'), shell.sed(
    /(?<="version":\s*?").+?(?=")/,
    tsVersion,
    path.join(srcDir,'package.json')
  ));

  // Copy relevant typescript files
  for (let srcFile of files) {
    if (shell.cp(srcFile, libDir) && shell.error())
      throw new Error(`Error copying file ${path.basename(srcFile)}. ${shell.error()}`);
  }
}

export function removeFakeInstallation() {
  if (shell.rm('-rf', tmpDir) && shell.error()) throw Error(`Could not remove tmpDir! ${shell.error()}`);
}

export function installFakePackage() {
  const pkgJSON = `{ "name": "fake-pkg", "version": "1.0.0" }`;

  removeFakePackage();

  /* Create package dir */
  try { mkdirIfNotExist(fakePkgDir) }
  catch (e) { throw new Error(`Could not create fake package directory! ${e.message}`); }

  // Write fake module package JSON file
  fs.writeFileSync(path.join(fakePkgDir, 'package.json'), pkgJSON);

  // Install package
  return shell.exec(`cd ${tmpDir} && npm i ${fakePkgDir}`);
}


export function removeFakePackage() {
  if (shell.rm('-rf', fakePkgDir) && shell.error()) throw Error(`Could not remove fake package dir! ${shell.error()}`);
}

export function installTSPatch() {
  const tspDir = path.join(tmpDir, 'ts-patch');

  /* Create package dir */
 try { mkdirIfNotExist(tspDir) }
 catch (e) { throw new Error(`Could not create ts-patch package directory! ${e.message}`) }

  // Copy dist files
  if (shell.cp('-R', path.join(appRoot, 'dist/*'), tspDir) && shell.error())
    throw new Error(`Error copying tsp files. ${shell.error()}`);

  // Install dependencies
  return shell.exec(`cd ${tmpDir} && npm i`);
}

export function removeTSPatch() {
  return shell.exec(`cd ${tmpDir} && npm uninstall ts-patch`);
}