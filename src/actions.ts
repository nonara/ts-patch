import {
  TSPOptions, AlreadyPatched, FileCopyError, getTSInfo, isAbsolute, Log, runTasks, parseOptions
} from './system';
import * as shell from 'shelljs';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import { patchTSModule } from './patch/patcher';


/* ********************************************************************************************************************
 * Config
 * ********************************************************************************************************************/
// region Config

export const SRC_FILES = ['tsc', 'tsserverlibrary', 'typescript', 'typescriptServices'];
export const BACKUP_DIRNAME = 'lib-backup';

// endregion


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/
// region Exports

/**
 * Patch TypeScript modules
 */
export function install(opts: Partial<TSPOptions>) {
  const options = parseOptions(opts);
  const {libDir, packageDir} = getTSInfo(options.basedir);
  const backupDir = path.join(packageDir, BACKUP_DIRNAME);

  runTasks({
    'create backups directory': () => shell.mkdir('-p', backupDir),

    'backup original modules': () => {
      for (let file of SRC_FILES.map(f => path.join(libDir, `${f}.js`))) {
        const filename = path.basename(file);
        Log(`[~] Backing up ${filename}...`, Log.verbose);
        shell.cp(file, backupDir);
        if (shell.error()) throw new FileCopyError(`Could not backup ${filename} to ${backupDir}. ${shell.error()}`);
      }
    },

    'patch modules': () => patch(SRC_FILES, options)
  });

  Log(`ts-patch installed!`);
}

/**
 * Remove patches from TypeScript modules
 */
export function uninstall(opts: Partial<TSPOptions>) {
  const options = parseOptions(opts);
  const {libDir, packageDir} = getTSInfo(options.basedir);
  const backupDir = path.join(packageDir, BACKUP_DIRNAME);
  const errors:string[] = [];

  runTasks({
    'restore original modules': () => {
      for (let file of SRC_FILES.map(f => path.join(backupDir, `${f}.js`))) {
        const filename = path.basename(file);
        Log(`[~] Restoring ${filename}...`, Log.verbose);
        shell.cp(file, libDir);
        if (shell.error()) errors.push(filename);
      }
    },
    'remove backup directory': () => {
      if (errors.length < 1) shell.rm('-rf', backupDir);
      else Log(`[!] Skipping removing backup directory because of errors.`, Log.verbose);
    }
  });

  if (errors.length > 0) throw new FileCopyError(
    `Could not restore all files. Try reinstalling typescript via npm. The following files could not be copied: [` +
    `${errors.join(', ')}]`
  );
  else Log('ts-patch removed!');
}

/**
 * Patch a TypeScript module
 */
export function patch(fileOrFilesOrGlob: string | string[], opts: Partial<TSPOptions>) {
  const options = parseOptions(opts);
  const files = Array.isArray(fileOrFilesOrGlob) ? fileOrFilesOrGlob
    : fs.existsSync(fileOrFilesOrGlob) ? [fileOrFilesOrGlob]
    : glob.sync(fileOrFilesOrGlob);

  const {libDir} = getTSInfo(options.basedir);

  for (let file of files) {
    file = isAbsolute(file) ? file : path.join(libDir,file);
    if (path.extname(file) !== '.js') file = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.js`);
    const filename = path.basename(file);

    Log(`[~] Patching ${filename} in ${path.dirname(file)}`, Log.verbose);

    try {
      patchTSModule(file, options.basedir)
    } catch (e) {
      if (e instanceof AlreadyPatched) Log(`[-] Skipping ${filename}. [Already patched]`, Log.verbose);
      else throw e;
    }

    Log(`[+] Successfully patched ${filename}.\r\n`, Log.verbose);
  }
}

// endregion