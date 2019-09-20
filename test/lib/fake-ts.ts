import path from "path";
import os from "os";
import { BACKUP_DIRNAME, SRC_FILES } from '../../src/lib/actions';
import fs from "fs";
import resolve from 'resolve';
import shell from 'shelljs';
import { getModuleAbsolutePath } from '../../src/lib/file-utils';


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

export const tmpDir = path.join(os.tmpdir(), 'tmpTSDir');
export const srcDir = path.dirname(resolve.sync('typescript/package.json'));
export const destDir = path.join(tmpDir, 'node_modules', 'typescript');
export const libDir = path.join(destDir, 'lib');
export const backupDir = path.join(destDir, BACKUP_DIRNAME);

const files = SRC_FILES.map(f => getModuleAbsolutePath(f, path.join(srcDir, 'lib')));


/* ********************************************************************************************************************
 * Fake Installation
 * ********************************************************************************************************************/

export function createFakeTSInstallation(tsVersion: string = '2.7.1') {
  const pkgJSON = `{ "name": "fake-module", "version": "1.0.0", "dependencies": { "typescript": "${tsVersion}" } }`;

  /* Setup temp dir */
  removeFakeInstallation();
  if (shell.mkdir('-p', path.join(destDir,'lib')) && shell.error())
    throw new Error(`Could not create temp directory! ${shell.error()}`);

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
