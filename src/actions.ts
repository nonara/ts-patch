import {
  TSPOptions, AlreadyPatched, FileCopyError, getTSInfo, Log, parseOptions, getModuleInfo, getModuleAbsolutePath,
  TaskError, PatchError, RestoreError, getKeys
} from './system';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import chalk from 'chalk';
import { patchTSModule } from './patch/patcher';
import * as shell from 'shelljs';


/* ********************************************************************************************************************
 * Config
 * ********************************************************************************************************************/
// region Config

shell.config.silent = true;

export const SRC_FILES = ['tsc', 'tsserverlibrary', 'typescript', 'typescriptServices'];
export const BACKUP_DIRNAME = 'lib-backup';

// endregion


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
 * Exports
 * ********************************************************************************************************************/
// region Exports

/**
 * Set app options
 */
export function setOptions(opts?: Partial<TSPOptions>) {
  return parseOptions(opts);
}

/**
 * Patch TypeScript modules
 */
export function install(opts?: Partial<TSPOptions>) {
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
export function uninstall(opts?: Partial<TSPOptions>) {
  const {silent, verbose, basedir} = parseOptions(opts);
  const {libDir, packageDir} = getTSInfo(basedir);
  const backupDir = path.join(packageDir, BACKUP_DIRNAME);

  const getPatchedFiles = () => {
    const info = Object
      .entries(check(SRC_FILES, { silent: !verbose })) // Make silent if not in verbose mode
      .filter(([f, {canPatch, patchVersion}]) => f && canPatch && Boolean(patchVersion));
    parseOptions({ silent });                             // Restore original silent setting
    return info;
  };

  if (getPatchedFiles().length < 1)
    return Log(['-', chalk.green(`No patched files found in ${libDir}`)]);

  runTasks({
    'restore original modules': () => shell.cp(path.join(backupDir, '*'), libDir),

    'remove backup directory': () => shell.rm('-rf', backupDir)
  });

  /* Verify files */
  const failed = getPatchedFiles();
  if (failed.length > 0) throw new RestoreError(
    `Could not restore all files. Try reinstalling typescript via npm. The following files were not restored: [` +
    `${chalk.yellow(getKeys(failed).join(', '))}]`
  );
  else Log(['-', chalk.green('ts-patch removed!')]);
}

/**
 * Check if files can be patched
 */
export function check(fileOrFilesOrGlob: string | string[] = SRC_FILES, opts?: Partial<TSPOptions>) {
  const {basedir} = parseOptions(opts);
  const {libDir, packageDir, version} = getTSInfo(basedir);

  const files =
    Array.isArray(fileOrFilesOrGlob) ? fileOrFilesOrGlob :
    fs.existsSync(getModuleAbsolutePath(fileOrFilesOrGlob, libDir)) ? [fileOrFilesOrGlob] :
      glob.sync(fileOrFilesOrGlob);

  const ret: Record<string, ReturnType<typeof getModuleInfo>> = {};

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

    ret[filename] = { patchVersion, canPatch };
  }

  return ret;
}

/**
 * Patch a TypeScript module
 */
export function patch(fileOrFilesOrGlob: string | string[], opts?: Partial<TSPOptions>) {
  const {basedir, cacheTSInfo} = parseOptions(opts);
  if (!fileOrFilesOrGlob) throw new PatchError(`Must provide a file path, array of files, or glob.`);

  const {libDir} = getTSInfo(basedir);

  const files =
    Array.isArray(fileOrFilesOrGlob) ? fileOrFilesOrGlob :
    fs.existsSync(getModuleAbsolutePath(fileOrFilesOrGlob, libDir)) ? [fileOrFilesOrGlob] :
      glob.sync(fileOrFilesOrGlob);

  for (let f of files) {
    const file = getModuleAbsolutePath(f, libDir);
    const filename = path.basename(file);

    Log(['~', `Patching ${chalk.blueBright(filename)} in ${chalk.blueBright(path.dirname(file))}`], Log.verbose);

    try {
      patchTSModule(file, basedir, !cacheTSInfo);
    } catch (e) {
      if (e instanceof AlreadyPatched)
        Log(['-', `Skipping ${chalk.blueBright(filename)}. [${chalk.underline(`Already patched`)}]`], Log.verbose);
      else throw e;
    }

    Log(['+', chalk.green(`Successfully patched ${chalk.bold.yellow(filename)}.\r\n`)], Log.verbose);
  }
}

// endregion