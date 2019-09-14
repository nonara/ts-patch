import {
  TSPOptions, Log, parseOptions, TaskError, PatchError, RestoreError, resetOptions, defineProperties
} from './system';
import { patchTSModule } from './patch/patcher';
import { getModuleAbsolutePath, getTSModule, getTSPackage, TSModule, TSPackage } from './ts-utils';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import chalk from 'chalk';
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

/* ***********************************************************
 * General
 * ***********************************************************/
// region General

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

/**
 * Parse file, array of files, or glob of files and get TSModule info for each
 */
function parseFiles(fileOrFilesOrGlob: string | string[], dir: string, includeSrc: boolean = false) {
  const files =
    Array.isArray(fileOrFilesOrGlob) ? fileOrFilesOrGlob :
    fs.existsSync(getModuleAbsolutePath(fileOrFilesOrGlob, dir)) ? [fileOrFilesOrGlob] :
      glob.sync(fileOrFilesOrGlob);

  const ret = files.map(f => getTSModule(getModuleAbsolutePath(f, dir), includeSrc));

  return defineProperties(ret, {
    alreadyPatched: { get: () => ret.filter(f => f.patchVersion) },
    unPatchable: { get: () => ret.filter(f => !f.canPatch) },
    patchable: { get: () => ret.filter(f => f.canPatch && !f.patchVersion) },
  });
}

// endregion


/* ***********************************************************
 * Persistence
 * ***********************************************************/
// region Persistence

function addPersist() {
  // const {basedir} = appOptions;
  // const {libDir, packageDir} = getTSPackage(basedir);
  // const files = SRC_FILES.map(f => getModuleAbsolutePath(f, libDir));
  //
  // runTasks({
  //   'add ts-patch.json in typescript dir': () => {
  //     fs.writeFileSync(path.join(packageDir, 'ts-patch.json'), JSON.stringify(
  //       files.reduce((p, f) => ({
  //         ...p,
  //         ...(fs.existsSync(f) && { [path.basename(f)]: fs.statSync(f).mtimeMs })
  //       }), {})
  //     ))
  //   }
  // });
}

function removePersist() {

}

// endregion


/* ***********************************************************
 * Backup
 * ***********************************************************/
// region Backup

/**
 * Create backup of TS Module file
 */
function backup(module: TSModule, tsPackage: TSPackage) {
  const backupDir = path.join(tsPackage.packageDir, BACKUP_DIRNAME);

  runTasks({
    'create backup dir': () => shell.mkdir('-p', backupDir),
    [`backing up ${module.file}`]: () => shell.cp(module.file, backupDir)
  });
}

/**
 * Restore module from backup
 */
function restore(currentModule: TSModule, tsPackage: TSPackage) {
  const backupDir = path.join(tsPackage.packageDir, BACKUP_DIRNAME);
  const {file, filename, canPatch, patchVersion} = getTSModule(path.join(backupDir, currentModule.filename));

  /* Verify backup file */
  if (!canPatch) throw new RestoreError(filename, `Backup file is not a valid typescript module!`);
  if (patchVersion) throw new RestoreError(filename, `Backup file is not an unpatched ts module`);

  // Move backup file
  if (shell.mv(file, tsPackage.libDir) && shell.error())
    throw new RestoreError(filename, `Couldn't move file - ${shell.error()}`);

  /* Verify restored file */
  const restoredModule = getTSModule(currentModule.file);
  if (!restoredModule.canPatch) throw new RestoreError(filename,
    `Restored file is not a valid typescript module! You will need to reinstall typescript.`
  );
  if (restoredModule.patchVersion) throw new RestoreError(filename,
    `Restored file still has patch! You will need to reinstall typescript.`
  );

  // Remove backup dir if empty
  if ((fs.readdirSync(backupDir).length < 1) && shell.rm('-rf', backupDir) && shell.error())
    Log(['!', `Error deleting backup directory` + chalk.grey(`[${backupDir}]`)], Log.verbose);
}

// endregion

// endregion



/* ********************************************************************************************************************
 * Actions
 * ********************************************************************************************************************/
// region Actions

/**
 * Set app options (super-imposes opts onto defaultOptions)
 */
export const setOptions = (opts?: Partial<TSPOptions>) => resetOptions(opts);

/**
 * Patch TypeScript modules
 */
export function install(opts?: Partial<TSPOptions>) {
  patch(SRC_FILES, opts);
  Log(['+', chalk.green(`ts-patch installed!`)]);
}

/**
 * Remove patches from TypeScript modules
 */
export function uninstall(opts?: Partial<TSPOptions>) {
  const {verbose, instanceIsCLI, basedir} = parseOptions(opts);

  const tsPackage = getTSPackage(basedir);
  const {libDir} = tsPackage;
  const modules = parseFiles(SRC_FILES, tsPackage.libDir);

  // Remove persistence hooks
  removePersist();

  if (modules.alreadyPatched.length < 1) return Log(['-', chalk.green(`No patched files found in ${libDir}`)]);

  /* Restore backup files */
  const errors:RestoreError[] = [];
  for (const m of modules)
    try { restore(m, tsPackage); } catch (e) { errors.push(e); }

  /* Handle errors */
  if (errors.length > 0)  {
    errors.forEach(e => {
      if (!instanceIsCLI) console.warn(e);
      else Log(['!', e.message], Log.verbose)
    });

    Log('');
    throw new RestoreError(
      `[${errors.map((e => e.filename)).join(', ')}]`,
      'Try reinstalling typescript via npm.' +
        (!verbose ? ' (Or, run uninstall again with --verbose for specific error detail)' : '')
    );
  }

  Log(['-', chalk.green('ts-patch removed!')]);
  return true;
}

/**
 * Check if files can be patched
 */
export function check(fileOrFilesOrGlob: string | string[] = SRC_FILES, opts?: Partial<TSPOptions>) {
  const {basedir} = parseOptions(opts);
  const {libDir, packageDir, version} = getTSPackage(basedir);

  Log(`Checking TypeScript ${chalk.blueBright(`v${version}`)} installation in ${chalk.blueBright(packageDir)}\r\n`);

  const modules = parseFiles(fileOrFilesOrGlob, libDir);

  for (const {filename, patchVersion, canPatch} of modules) {
    if (patchVersion) Log(
      ['+', `${chalk.blueBright(filename)} is patched with ts-patch version ${chalk.blueBright(patchVersion)}.`]
    );
    else if (canPatch) Log(['-', `${chalk.blueBright(filename)} is not patched.`]);
    else Log(['-', chalk.red(`${chalk.redBright(filename)} is not patched and cannot be patched!`)]);

    Log('', Log.verbose);
  }

  return modules;
}

/**
 * Patch a TypeScript module
 */
export function patch(fileOrFilesOrGlob: string | string[], opts?: Partial<TSPOptions>) {
  if (!fileOrFilesOrGlob) throw new PatchError(`Must provide a file path, array of files, or glob.`);

  const {basedir, persist} = parseOptions(opts);

  const tsPackage = getTSPackage(basedir);
  const modules = parseFiles(fileOrFilesOrGlob, tsPackage.libDir, true);

  if (modules.alreadyPatched.length >= modules.length) {
    Log(['!', `Files already patched. For details, run: `+ chalk.bgBlackBright('ts-patch check')]);
    return true;
  }

  /* Patch files */
  for (let module of modules.patchable) {
    const {file, filename} = module;
    Log(['~', `Patching ${chalk.blueBright(filename)} in ${chalk.blueBright(path.dirname(file))}`], Log.verbose);

    backup(module, tsPackage);
    patchTSModule(module, tsPackage);

    Log(['+', chalk.green(`Successfully patched ${chalk.bold.yellow(filename)}.\r\n`)], Log.verbose);
  }

  // Add persistence hooks
  if (persist) addPersist();

  if (modules.unPatchable.length > 1) {
    Log(['!',
      `Some files can't be patched! Try updating to a newer version of ts-patch. The following files are unable to be ` +
      `patched. [${modules.unPatchable.map(f => f.filename).join(', ')}]`
    ]);
    return false;
  }

  return true;
}

// endregion