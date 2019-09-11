import {
  TSPOptions, AlreadyPatched, FileCopyError, getTSInfo, Log, parseOptions, getModuleInfo, getModuleAbsolutePath,
  defaultOptions, TaskError
} from './system';
import * as shell from 'shelljs';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import chalk from 'chalk';
import { patchTSModule } from './patch/patcher';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

/**
 * Execute a series of tasks and throw if any shelljs errors
 */
export function runTasks(tasks: { [x:string]: () => any }) {
  for (let [caption, task] of Object.entries(tasks)) {
    Log('', Log.verbose);
    Log(['=', `Running task: ${chalk.bold.yellow(caption)}\r\n`], Log.verbose);
    if (task() && shell.error())
      throw new TaskError(caption, shell.error());
  }
}

// endregion


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
export function install(opts: Partial<TSPOptions> = defaultOptions) {
  const options = parseOptions(opts);
  const {libDir, packageDir} = getTSInfo(options.basedir);
  const backupDir = path.join(packageDir, BACKUP_DIRNAME);

  runTasks({
    'create backups directory': () => shell.mkdir('-p', backupDir),

    'backup original modules': () => {
      for (let file of SRC_FILES.map(f => getModuleAbsolutePath(f, libDir))) {
        const filename = path.basename(file);
        Log(['~', `Backing up ${filename}...`], Log.verbose);
        shell.cp(file, backupDir);
        if (shell.error()) throw new FileCopyError(`Could not backup ${filename} to ${backupDir}. ${shell.error()}`);
      }
    },

    'patch modules': () => patch(SRC_FILES, options)
  });

  Log(['+', chalk.green(`ts-patch installed!`)]);
}

/**
 * Remove patches from TypeScript modules
 */
export function uninstall(opts: Partial<TSPOptions> = defaultOptions) {
  const options = parseOptions(opts);
  const {libDir, packageDir} = getTSInfo(options.basedir);
  const backupDir = path.join(packageDir, BACKUP_DIRNAME);
  const errors:string[] = [];

  runTasks({
    'restore original modules': () => {
      for (let file of SRC_FILES.map(f => getModuleAbsolutePath(f, backupDir))) {
        const filename = path.basename(file);
        Log(['~', `Restoring ${filename}...`], Log.verbose);
        shell.cp(file, libDir);
        if (shell.error()) errors.push(filename);
      }
    },
    'remove backup directory': () => {
      if (errors.length < 1) shell.rm('-rf', backupDir);
      else Log(['!', `Skipping removing backup directory because of errors.`], Log.verbose);
    }
  });

  if (errors.length > 0) throw new FileCopyError(
    `Could not restore all files. Try reinstalling typescript via npm. The following files could not be copied: [` +
    `${chalk.yellow(errors.join(', '))}]`
  );
  else Log(['-', chalk.green('ts-patch removed!')]);
}

/**
 * Check if files can be patched
 */
export function check(opts: Partial<TSPOptions> = defaultOptions, fileOrFilesOrGlob: string | string[] = SRC_FILES) {
  const options = parseOptions(opts);
  const files = Array.isArray(fileOrFilesOrGlob) ? fileOrFilesOrGlob
    : fs.existsSync(fileOrFilesOrGlob) ? [fileOrFilesOrGlob]
    : glob.sync(fileOrFilesOrGlob);

  const {libDir, packageDir, version} = getTSInfo(options.basedir);
  const ret = [];

  Log(`Checking TypeScript ${chalk.blueBright(`v${version}`)} installation in ${chalk.blueBright(packageDir)}\r\n`);

  for (let f of files) {
    const file = getModuleAbsolutePath(f, libDir);
    const filename = path.basename(file);

    Log(['~', `Checking ${filename}.`], Log.verbose);

    if (!fs.existsSync(file)) {
      console.warn(`[!] Could not find ${filename} in ${libDir}`);
      continue;
    }

    const {patchVersion, canPatch} = getModuleInfo(file);

    if (patchVersion) Log(['+', `${chalk.blueBright(filename)} is patched with ts-patch version ${chalk.blueBright(patchVersion)}.`]);
    else if (canPatch) Log(['-', `${chalk.blueBright(filename)} is not patched.`]);
    else Log(['-', chalk.red(`${chalk.redBright(filename)} is not patched and cannot be patched!`)]);

    Log('', Log.verbose);

    ret.push({ [filename]: { patchVersion, canPatch }});
  }

  return ret;
}

/**
 * Patch a TypeScript module
 */
export function patch(fileOrFilesOrGlob: string | string[], opts: Partial<TSPOptions> = defaultOptions) {
  const options = parseOptions(opts);
  const files = Array.isArray(fileOrFilesOrGlob) ? fileOrFilesOrGlob
    : fs.existsSync(fileOrFilesOrGlob) ? [fileOrFilesOrGlob]
    : glob.sync(fileOrFilesOrGlob);

  const {libDir} = getTSInfo(options.basedir);

  for (let f of files) {
    const file = getModuleAbsolutePath(f, libDir);
    const filename = path.basename(file);

    Log(['~', `Patching ${chalk.blueBright(filename)} in ${chalk.blueBright(path.dirname(file))}`], Log.verbose);

    try {
      patchTSModule(file, options.basedir)
    } catch (e) {
      if (e instanceof AlreadyPatched) Log(['-', `Skipping ${chalk.blueBright(filename)}. [${chalk.underline(`Already patched`)}]`], Log.verbose);
      else throw e;
    }

    Log(['+', chalk.green(`Successfully patched ${chalk.bold.yellow(filename)}.\r\n`)], Log.verbose);
  }
}

// endregion