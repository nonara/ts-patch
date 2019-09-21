import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import chalk from 'chalk';
import * as shell from 'shelljs';
import { patchTSModule } from './patcher';
import { getModuleAbsolutePath, getTSModule, getTSPackage, mkdirIfNotExist, TSModule, TSPackage } from './file-utils';
import {
  TSPOptions, Log, parseOptions, PatchError, RestoreError, resetOptions, defineProperties, BackupError,
  PersistenceError, tspPackageJSON, appRoot
} from './system';


/* ********************************************************************************************************************
 * Config
 * ********************************************************************************************************************/
// region Config

shell.config.silent = true;

export const SRC_FILES = ['tsc.js', 'tsserverlibrary.js', 'typescript.js', 'typescriptServices.js'];
export const BACKUP_DIRNAME = 'lib-backup';
export const RESOURCES_PATH = path.join(appRoot, tspPackageJSON.directories.resources);
export const HOOKS_FILES = ['postinstall', 'postinstall.cmd'];

// endregion


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

/**
 * Parse file, array of files, or glob of files and get TSModule info for each
 */
export function parseFiles(fileOrFilesOrGlob: string | string[], dir: string, includeSrc: boolean = false) {
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

/**
 * Create backup of TS Module file
 */
function backup(tsModule: TSModule, tsPackage: TSPackage) {
  const backupDir = path.join(tsPackage.packageDir, BACKUP_DIRNAME);

  try { mkdirIfNotExist(backupDir) }
  catch (e) { throw new BackupError(tsModule.filename, `Couldn't create backup directory. ${e.message}`); }

  if (shell.cp(tsModule.file, backupDir) && shell.error())
    throw new BackupError(tsModule.filename, shell.error());
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
  const ret = patch(SRC_FILES, opts);
  Log(['+', chalk.green(`ts-patch installed!`)]);
  return ret;
}

/**
 * Remove patches from TypeScript modules
 */
export function uninstall(opts?: Partial<TSPOptions>) {
  const ret = unpatch(SRC_FILES, opts);
  Log(['-', chalk.green(`ts-patch removed!`)]);
  return ret;
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
  const {basedir} = parseOptions(opts);

  const tsPackage = getTSPackage(basedir);
  const modules = parseFiles(fileOrFilesOrGlob, tsPackage.libDir, true);

  if (modules.alreadyPatched.length >= modules.length) {
    Log(['!', `Files already patched. For details, run: `+ chalk.bgBlackBright('ts-patch check')]);
    return true;
  }

  /* Patch files */
  for (let m of modules.patchable) {
    const {file, filename} = m;
    Log(['~', `Patching ${chalk.blueBright(filename)} in ${chalk.blueBright(path.dirname(file))}`], Log.verbose);

    backup(m, tsPackage);
    patchTSModule(m, tsPackage);
    tsPackage.config.modules[filename] = fs.statSync(file).mtimeMs;

    Log(['+', chalk.green(`Successfully patched ${chalk.bold.yellow(filename)}.\r\n`)], Log.verbose);
  }

  tsPackage.config.save();

  if (modules.unPatchable.length > 1) {
    Log(['!',
      `Some files can't be patched! Try updating to a newer version of ts-patch. The following files are unable to be ` +
      `patched. [${modules.unPatchable.map(f => f.filename).join(', ')}]`
    ]);
    return false;
  }

  return true;
}

export function unpatch(fileOrFilesOrGlob: string | string[], opts?: Partial<TSPOptions>) {
  if (!fileOrFilesOrGlob) throw new PatchError(`Must provide a file path, array of files, or glob.`);
  const {basedir, verbose, instanceIsCLI} = parseOptions(opts);

  const tsPackage = getTSPackage(basedir);
  const modules = parseFiles(fileOrFilesOrGlob, tsPackage.libDir, true);

  if (modules.alreadyPatched.length < 1) {
    Log(['!', `No patched files detected. For details, run: `+ chalk.bgBlackBright('ts-patch check')]);
    return true;
  }

  /* Restore files */
  const errors:RestoreError[] = [];
  for (let tsModule of modules.alreadyPatched) {
    const {file, filename} = tsModule;
    Log(['~', `Restoring ${chalk.blueBright(filename)} in ${chalk.blueBright(path.dirname(file))}`], Log.verbose);

    try {
      restore(tsModule, tsPackage);
      delete tsPackage.config.modules[filename];

      Log(['+', chalk.green(`Successfully restored ${chalk.bold.yellow(filename)}.\r\n`)], Log.verbose);
    } catch (e) {
      errors.push(e);
    }
  }

  /* Save config, or remove if empty */
  if (Object.keys(tsPackage.config.modules).length > 0) tsPackage.config.save();
  else shell.rm('-rf', tsPackage.config.file);

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

  return true;
}

/**
 * Enable persistence hooks
 */
export function enablePersistence(opts?: Partial<TSPOptions>) {
  const {basedir} = parseOptions(opts);
  const {config, packageDir} = getTSPackage(basedir);

  Log(['~', `Enabling persistence in ${chalk.blueBright(packageDir)}`], Log.verbose);

  config.persist = true;
  config.save();

  /* Copy hooks */
  const hooksDir = path.join(packageDir, '../.hooks');
  const hooksFiles = HOOKS_FILES.map(f => path.join(RESOURCES_PATH, f));

  try { mkdirIfNotExist(hooksDir) }
  catch (e) { throw new PersistenceError(`Could not create hooks directory in node_modules: ${e.message}`); }

  if (shell.cp(hooksFiles, hooksDir) && shell.error())
    throw new PersistenceError(`Error trying to copy persistence hooks: ${shell.error()}`);

  Log(['+', chalk.green(`Enabled persistence for ${chalk.blueBright(packageDir)}`)]);
}

/**
 * Disable persistence hooks
 */
export function disablePersistence(opts?: Partial<TSPOptions>) {
  const {basedir} = parseOptions(opts);
  const {config, packageDir} = getTSPackage(basedir);

  Log(['~', `Disabling persistence in ${chalk.blueBright(packageDir)}`], Log.verbose);

  config.persist = false;
  config.save();

  /* Remove hooks */
  const hooksDir = path.join(packageDir, '../.hooks');
  const hooksFiles = HOOKS_FILES.map(f => path.join(hooksDir, f));

  if (shell.rm('-rf', hooksFiles) && shell.error())
    throw new PersistenceError(`Error trying to remove persistence hooks: ${shell.error()}`);

  Log(['-', chalk.green(`Disabled persistence for ${chalk.blueBright(packageDir)}`)]);
}

// endregion