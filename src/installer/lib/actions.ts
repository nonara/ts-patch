import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import chalk from 'chalk';
import * as shell from 'shelljs';
import { patchTSModule } from './patcher';
import { getModuleAbsolutePath, getTSModule, getTSPackage, mkdirIfNotExist, TSModule, TSPackage } from './file-utils';
import {
  appRoot, BackupError, defineProperties, Log, NPMError, parseOptions, PatchError, PersistenceError, resetOptions,
  RestoreError, TSPOptions, tspPackageJSON
} from './system';
import resolve = require('resolve');


/* ********************************************************************************************************************
 * Config
 * ********************************************************************************************************************/
// region Config

export const tsDependencies = [ 'ts-node' ];

shell.config.silent = true;

export const SRC_FILES = [ 'tsc.js', 'tsserverlibrary.js', 'typescript.js', 'typescriptServices.js' ];
export const BACKUP_DIRNAME = 'lib-backup';
export const RESOURCES_PATH = path.join(appRoot, tspPackageJSON.directories.resources);
export const HOOKS_FILES = [ 'postinstall', 'postinstall.cmd' ];

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
    fs.existsSync(getModuleAbsolutePath(fileOrFilesOrGlob, dir)) ? [ fileOrFilesOrGlob ] :
    glob.sync(fileOrFilesOrGlob);

  const ret = files.map(f => getTSModule(getModuleAbsolutePath(f, dir), includeSrc));

  return defineProperties(ret, {
    patched: { get: () => ret.filter(f => f.patchVersion) },
    unPatchable: { get: () => ret.filter(f => !f.canPatch) },
    canUpdateOrPatch: { get: () => ret.filter(f => f.canPatch && f.outOfDate) },
    patchable: { get: () => ret.filter(f => f.canPatch) },
  });
}

/**
 * Create backup of TS Module file
 */
function backup(tsModule: TSModule, tsPackage: TSPackage) {
  const backupDir = path.join(tsPackage.packageDir, BACKUP_DIRNAME);

  if (tsModule.patchVersion)
    throw new Error(`Cannot backup an already patched module. You may need to reinstall typescript.`)

  try { mkdirIfNotExist(backupDir) }
  catch (e) { throw new BackupError(tsModule.filename, `Couldn't create backup directory. ${e.message}`); }

  if (shell.cp(tsModule.file, backupDir) && shell.error())
    throw new BackupError(tsModule.filename, shell.error());

  if (tsModule.filename === 'typescript.js')
    if (shell.cp(path.join(tsModule.dir, 'typescript.d.ts'), backupDir) && shell.error())
      throw new BackupError('typescript.d.ts', shell.error());
}

/**
 * Restore module from backup
 */
function restore(currentModule: TSModule, tsPackage: TSPackage, noDelete?: boolean) {
  const copyOrMove = (fileName: string, dest: string) =>
    shell[noDelete ? 'cp' : 'mv'](fileName, dest);

  const backupDir = path.join(tsPackage.packageDir, BACKUP_DIRNAME);
  const { file, filename, canPatch, patchVersion, dir } = getTSModule(path.join(backupDir, currentModule.filename));

  /* Verify backup file */
  if (!canPatch) throw new RestoreError(filename, `Backup file is not a valid typescript module!`);
  if (patchVersion) throw new RestoreError(filename, `Backup file is not an un-patched ts module`);

  /* Restore files */
  if (copyOrMove(file, tsPackage.libDir) && shell.error())
    throw new RestoreError(filename, `Couldn't restore file - ${shell.error()}`);

  if (filename === 'typescript.js')
    if (copyOrMove(path.join(dir, 'typescript.d.ts'), tsPackage.libDir) && shell.error())
      throw new RestoreError(filename, `Couldn't restore file - ${shell.error()}`);

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
    Log([ '!', `Error deleting backup directory` + chalk.grey(`[${backupDir}]`) ], Log.verbose);
}

/**
 * Remove tsNode from dependencies in typescript's package.json
 */
function removeDependencies(tsPackage: TSPackage) {
  const pkgFile = path.join(tsPackage.packageDir, 'package.json');

  try {
    const pkgData: any = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));

    for (const d of tsDependencies) delete pkgData.dependencies[d];

    fs.writeFileSync(pkgFile, JSON.stringify(pkgData, null, 2));
  }
  catch (e) {
    throw new PatchError(e.message);
  }
}

/**
 * Add tsNode to typescript's dependencies
 */
function installDependencies(tsPackage: TSPackage) {
  const pkgFile = path.join(tsPackage.packageDir, 'package.json');

  /* Read TS package json */
  let pkgData: any;
  try { pkgData = JSON.parse(fs.readFileSync(pkgFile, 'utf8')); }
  catch (e) { throw new PatchError(e.message); }

  /* Find existing installations of dependencies */
  const getDependenciesDetail = () =>
    tsDependencies
      .map(name => {
        let location: string | undefined;
        let version: string | undefined;
        try {
          location = resolve.sync(`${name}/package.json`, { basedir: tsPackage.packageDir });
          version = require(location).version;
        }
        catch (e) { }
        return ({ name, location, version })
      });

  /* Install missing dependencies */
  const missingDeps = getDependenciesDetail().filter(({ version }) => !version);

  if (missingDeps.length > 0) {
    Log([ '~', `Installing dependencies: ${missingDeps.map(({ name }) => name).join(', ')} (via npm)...` ], Log.verbose);

    /*
     * Note: The environment variable is used here to compensate for an issue within istanbuljs/spawn-wrap
     *  When nyc coverage is run, spawn-wrap replaces any instance of the word 'node' in command string with an absolute
     *  path to its node installation. As a result, ts-node cannot install.
     *
     *  This workaround will be replaced shortly.
     */
    shell.exec(
      `npm i --no-audit ${process.platform === 'win32' ? '%PACKAGES%' : '$PACKAGES'}`,
      {
        cwd: path.resolve(tsPackage.packageDir, '..'),
        env: {
          ...process.env,
          PACKAGES: missingDeps.map(({ name }) => name).join(' ')
        }
      }
    );

    if (shell.error()) throw new NPMError(`Error while installing dependencies: ${shell.error()}`);
  }

  /* Write versions to TS dependencies */
  for (const { name, version } of getDependenciesDetail()) {
    if (!pkgData.hasOwnProperty('dependencies')) pkgData.dependencies = {};
    pkgData.dependencies[name] = `^${version}`;
  }

  try { fs.writeFileSync(pkgFile, JSON.stringify(pkgData, null, 2)) }
  catch (e) { throw new PatchError(e.message) }
}


// endregion


/* ********************************************************************************************************************
 * Actions
 * ********************************************************************************************************************/
// region Actions

/**
 * Set app options (superimposes opts onto defaultOptions)
 */
export const setOptions = (opts?: Partial<TSPOptions>) => resetOptions(opts);

/**
 * Patch TypeScript modules
 */
export function install(opts?: Partial<TSPOptions>) {
  const ret = patch(SRC_FILES, opts);
  if (ret) Log([ '+', chalk.green(`ts-patch installed!`) ]);
  return ret;
}

/**
 * Remove patches from TypeScript modules
 */
export function uninstall(opts?: Partial<TSPOptions>) {
  const ret = unpatch(SRC_FILES, opts);
  if (ret) Log([ '-', chalk.green(`ts-patch removed!`) ]);
  return ret;
}

/**
 * Check if files can be patched
 */
export function check(fileOrFilesOrGlob: string | string[] = SRC_FILES, opts?: Partial<TSPOptions>) {
  const { basedir } = parseOptions(opts);
  const { libDir, packageDir, version } = getTSPackage(basedir);

  Log(`Checking TypeScript ${chalk.blueBright(`v${version}`)} installation in ${chalk.blueBright(packageDir)}\r\n`);

  const modules = parseFiles(fileOrFilesOrGlob, libDir);
  for (const module of modules) {
    const { filename, patchVersion, canPatch, outOfDate } = module;
    if (patchVersion) Log([ '+',
      `${chalk.blueBright(filename)} is patched with ts-patch version ` +
      `${chalk[outOfDate ? 'redBright' : 'blueBright'](patchVersion)} ${outOfDate ? '(out of date)' : '' }`
    ]);
    else if (canPatch) Log([ '-', `${chalk.blueBright(filename)} is not patched.` ]);
    else Log([ '-', chalk.red(`${chalk.redBright(filename)} is not patched and cannot be patched!`) ]);

    Log('', Log.verbose);
  }

  return modules;
}

/**
 * Patch a TypeScript module
 */
export function patch(fileOrFilesOrGlob: string | string[], opts?: Partial<TSPOptions>) {
  if (!fileOrFilesOrGlob) throw new PatchError(`Must provide a file path, array of files, or glob.`);
  const { basedir } = parseOptions(opts);

  const tsPackage = getTSPackage(basedir);
  const modules = parseFiles(fileOrFilesOrGlob, tsPackage.libDir, true);

  if (!modules.canUpdateOrPatch.length) {
    Log([ '!',
      `File${modules.length-1 ? 's' : ''} already patched with the latest version. For details, run: ` +
      chalk.bgBlackBright('ts-patch check')
    ]);
    return false;
  }

  /* Patch files */
  for (let m of modules.canUpdateOrPatch) {
    const { file, filename } = m;
    Log([ '~', `Patching ${chalk.blueBright(filename)} in ${chalk.blueBright(path.dirname(file))}` ], Log.verbose);

    // If already patched, load backup module source. Otherwise, backup un-patched
    if (m.patchVersion) m.moduleSrc =
      getTSModule(path.join(tsPackage.packageDir, BACKUP_DIRNAME, m.filename), /* includeSrc */ true).moduleSrc;
    else backup(m, tsPackage);

    patchTSModule(m, tsPackage);
    tsPackage.config.modules[filename] = fs.statSync(file).mtimeMs;

    Log([ '+', chalk.green(`Successfully patched ${chalk.bold.yellow(filename)}.\r\n`) ], Log.verbose);
  }

  tsPackage.config.save();
  installDependencies(tsPackage);

  if (modules.unPatchable.length > 1) {
    Log([ '!',
      `Some files can't be patched! Try updating to a newer version of ts-patch. The following files are unable to be ` +
      `patched. [${modules.unPatchable.map(f => f.filename).join(', ')}]`
    ]);
    return false;
  }

  return true;
}

export function unpatch(fileOrFilesOrGlob: string | string[], opts?: Partial<TSPOptions>) {
  if (!fileOrFilesOrGlob) throw new PatchError(`Must provide a file path, array of files, or glob.`);
  const { basedir, verbose, instanceIsCLI } = parseOptions(opts);

  const tsPackage = getTSPackage(basedir);
  const modules = parseFiles(fileOrFilesOrGlob, tsPackage.libDir, true);

  if (modules.patched.length < 1) {
    Log([ '!', `File${modules.length-1 ? 's' : ''} not patched. For details, run: ` + chalk.bgBlackBright('ts-patch check') ]);
    return false;
  }

  /* Restore files */
  const errors: Record<string, Error> = {};
  for (let tsModule of modules.patched) {
    const { file, filename } = tsModule;
    Log([ '~', `Restoring ${chalk.blueBright(filename)} in ${chalk.blueBright(path.dirname(file))}` ], Log.verbose);

    try {
      restore(tsModule, tsPackage);
      delete tsPackage.config.modules[filename];

      Log([ '+', chalk.green(`Successfully restored ${chalk.bold.yellow(filename)}.\r\n`) ], Log.verbose);
    }
    catch (e) {
      errors[filename] = e;
    }
  }

  /* Save config, or handle if no patched files left */
  if (Object.keys(tsPackage.config.modules).length > 0) tsPackage.config.save();
  else {
    // Remove ts-patch.json file
    shell.rm('-rf', tsPackage.config.file);

    // Remove ts-node from package.json
    removeDependencies(tsPackage);
  }

  /* Handle errors */
  if (Object.keys(errors).length > 0) {
    Object.values(errors).forEach(e => {
      if (!instanceIsCLI) console.warn(e);
      else Log([ '!', e.message ], Log.verbose)
    });

    Log('');
    throw new RestoreError(
      `[${Object.keys(errors).join(', ')}]`,
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
  const { basedir } = parseOptions(opts);
  const { config, packageDir } = getTSPackage(basedir);

  Log([ '~', `Enabling persistence in ${chalk.blueBright(packageDir)}` ], Log.verbose);

  config.persist = true;
  config.save();

  /* Copy hooks */
  const hooksDir = path.join(packageDir, '../.hooks');
  const hooksFiles = HOOKS_FILES.map(f => path.join(RESOURCES_PATH, f));

  try { mkdirIfNotExist(hooksDir) }
  catch (e) { throw new PersistenceError(`Could not create hooks directory in node_modules: ${e.message}`); }

  if (shell.cp(hooksFiles, hooksDir) && shell.error())
    throw new PersistenceError(`Error trying to copy persistence hooks: ${shell.error()}`);

  /* Write absolute path to ts-patch in hooks */
  let tspPath;
  try { tspPath = path.dirname(resolve.sync('ts-patch/package.json', { basedir: packageDir })) }
  catch (e) { }

  if (tspPath)
    for (let file of hooksFiles.map(f => path.join(hooksDir, path.basename(f)))) {
      shell.sed('-i',
        /(?<=^(@SET\s)?tspdir\s*=\s*").+?(?="$)/m,
        tspPath.split(path.sep).join((path.extname(file) === '.cmd') ? '\\' : '/'),
        file
      );

      if (shell.error())
        throw new PersistenceError(`Error writing to hooks file '${path.basename(file)}': ${shell.error()}`);
    }

  Log([ '+', chalk.green(`Enabled persistence for ${chalk.blueBright(packageDir)}`) ]);
}

/**
 * Disable persistence hooks
 */
export function disablePersistence(opts?: Partial<TSPOptions>) {
  const { basedir } = parseOptions(opts);
  const { config, packageDir } = getTSPackage(basedir);

  Log([ '~', `Disabling persistence in ${chalk.blueBright(packageDir)}` ], Log.verbose);

  config.persist = false;
  config.save();

  /* Remove hooks */
  const hooksDir = path.join(packageDir, '../.hooks');
  const hooksFiles = HOOKS_FILES.map(f => path.join(hooksDir, f));

  if (shell.rm('-rf', hooksFiles) && shell.error())
    throw new PersistenceError(`Error trying to remove persistence hooks: ${shell.error()}`);

  Log([ '-', chalk.green(`Disabled persistence for ${chalk.blueBright(packageDir)}`) ]);
}

// endregion
