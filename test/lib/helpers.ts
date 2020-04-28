import path from 'path';
import fs from 'fs';
import shell from 'shelljs';
import { BACKUP_DIRNAME, SRC_FILES } from '../../src/lib/actions';
import { getModuleAbsolutePath, mkdirIfNotExist } from '../../src/lib/file-utils';
import { appRoot, tspPackageJSON } from '../../src/lib/system';
import os from 'os';
import resolve from 'resolve';


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

export const tmpDir = path.join(os.tmpdir(), 'tmpTSDir');
export const srcDir = path.dirname(resolve.sync('typescript/package.json'));
export const destDir = path.join(tmpDir, 'node_modules', 'typescript');
export const libDir = path.join(destDir, 'lib');
export const backupDir = path.join(destDir, BACKUP_DIRNAME);
const fakePkgDir = path.resolve(tmpDir, 'fake-pkg');

const files = [
  ...SRC_FILES.map(f => getModuleAbsolutePath(f, path.join(srcDir, 'lib'))),
  path.join(path.join(srcDir, 'lib'), 'typescript.d.ts')
];


/* ********************************************************************************************************************
 * Fake TS
 * ********************************************************************************************************************/

export function createTSInstallation(fullInstall: boolean = false, tsVersion?: string) {
  if (!tsVersion) tsVersion = tspPackageJSON.devDependencies.typescript;

  const pkgJSON = `{
    "name": "fake-module",
    "version": "1.0.0",
    "dependencies": {
      "typescript": "${tsVersion}",
      "ts-patch": "file:ts-patch"
    }
  }`;

  /* Setup temp dir */
  removeTSInstallation();
  try { mkdirIfNotExist(path.join(destDir, 'lib')) }
  catch (e) { throw new Error(`Could not create temp directory! ${e.message}`); }

  // Write fake module package JSON file
  fs.writeFileSync(path.join(tmpDir, 'package.json'), pkgJSON);

  /* Install TS Module */
  if (fullInstall) {
    installTSPatch();
  } else {
    // Write typescript package JSON file
    fs.writeFileSync(path.join(destDir, 'package.json'), shell.sed(
      /(?<="version":\s*?").+?(?=")/,
      tsVersion!.replace(/[^0-9.\-\w]/g, ''),
      path.join(srcDir, 'package.json')
    ).toString());

    // Copy relevant typescript files
    for (let srcFile of files) {
      if (shell.cp(srcFile, libDir) && shell.error())
        throw new Error(`Error copying file ${path.basename(srcFile)}. ${shell.error()}`);
    }
  }
}

export function removeTSInstallation() {
  if (shell.rm('-rf', tmpDir) && shell.error()) throw Error(`Could not remove tmpDir! ${shell.error()}`);
}


/* ********************************************************************************************************************
 * Fake Package
 * ********************************************************************************************************************/

export function installFakePackage() {
  const pkgJSON = `{ "name": "fake-pkg", "version": "1.0.0" }`;

  removeFakePackage();

  /* Create package dir */
  try { mkdirIfNotExist(fakePkgDir) }
  catch (e) { throw new Error(`Could not create fake package directory! ${e.message}`); }

  // Write fake module package JSON file
  fs.writeFileSync(path.join(fakePkgDir, 'package.json'), pkgJSON);

  // Install package
  return shell.exec(`npm i --no-audit ${fakePkgDir}`, { cwd: tmpDir });
}


export function removeFakePackage() {
  if (shell.rm('-rf', fakePkgDir) && shell.error()) throw Error(`Could not remove fake package dir! ${shell.error()}`);
}


/* ********************************************************************************************************************
 * TS Patch
 * ********************************************************************************************************************/

export function installTSPatch() {
  const tspDir = path.join(tmpDir, 'ts-patch');

  /* Create package dir */
  try { mkdirIfNotExist(tspDir) }
  catch (e) { throw new Error(`Could not create ts-patch package directory! ${e.message}`) }

  // Copy dist files
  if (shell.cp('-R', path.join(appRoot, 'dist/*'), tspDir) && shell.error())
    throw new Error(`Error copying tsp files. ${shell.error()}`);

  // Install dependencies
  shell.exec(`npm i --no-audit`, { cwd: tmpDir });
}

export function removeTSPatch() {
  shell.exec(`npm uninstall --no-audit ts-patch`, { cwd: tmpDir });
}
