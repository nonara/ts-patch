import { LogLevel, PatchError, RestoreError } from '../system';
import chalk from 'chalk';
import path from 'path';
import { getTsPackage } from '../ts-package';
import { getModuleFile, getTsModule, ModuleFile } from '../module';
import fs from 'fs';
import { getInstallerOptions, InstallerOptions } from '../options';
import { copyFileWithLock } from '../utils';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function unpatch(moduleName: string, opts?: Partial<InstallerOptions>): boolean
export function unpatch(moduleNames: string[], opts?: Partial<InstallerOptions>): boolean
export function unpatch(moduleNameOrNames: string | string[], opts?: Partial<InstallerOptions>): boolean {
  let res = false;

  const targetModuleNames = [ moduleNameOrNames ].flat();
  if (!targetModuleNames.length) throw new PatchError(`Must provide at least one module name to patch`);

  const options = getInstallerOptions(opts);
  const { logger: log, dir } = options;

  /* Load Package */
  const tsPackage = getTsPackage(dir);

  /* Get modules to patch and patch info */
  const moduleFiles: [ string, ModuleFile ][] =
    targetModuleNames.map(m => [ m, getModuleFile(tsPackage.getModulePath(m)) ]);

  /* Determine patched files */
  const unpatchableFiles = moduleFiles.filter(entry => {
    const [ moduleName, moduleFile ] = entry;
    if (moduleFile.patchDetail) return true;
    else {
      log([ '!', `${chalk.blueBright(moduleName)} is not patched. For details, run: ` + chalk.bgBlackBright('ts-patch check') ]);
      return false;
    }
  });

  /* Restore files */
  const errors: Record<string, Error> = {};
  for (const entry of unpatchableFiles) {
    /* Load Module */
    const { 1: moduleFile } = entry;
    const tsModule = getTsModule(tsPackage, moduleFile, { skipCache: true });

    try {
      log(
        [
          '~',
          `Restoring ${chalk.blueBright(tsModule.moduleName)} in ${chalk.blueBright(path.dirname(tsPackage.libDir))}`
        ],
        LogLevel.verbose
      );

      /* Get Backups */
      const backupPaths: string[] = []
      backupPaths.push(tsModule.backupCachePaths.js);
      if (tsModule.backupCachePaths.dts) backupPaths.push(tsModule.backupCachePaths.dts);

      /* Restore files */
      for (const backupPath of backupPaths) {
        if (!fs.existsSync(backupPath))
          throw new Error(`Cannot find backup file: ${backupPath}. Try reinstalling typescript.`);

        copyFileWithLock(backupPath, tsModule.modulePath);
      }

      log([ '+', chalk.green(`Successfully restored ${chalk.bold.yellow(tsModule.moduleName)}.\r\n`) ], LogLevel.verbose);
    } catch (e) {
      errors[tsModule.moduleName] = e;
    }
  }

  /* Handle errors */
  if (Object.keys(errors).length > 0) {
    Object.values(errors).forEach(e => {
      log([ '!', e.message ], LogLevel.verbose)
    });

    log('');
    throw new RestoreError(
      `[${Object.keys(errors).join(', ')}]`,
      'Try reinstalling typescript.' +
      (options.logLevel < LogLevel.verbose ? ' (Or, run uninstall again with --verbose for specific error detail)' : '')
    );
  } else {
    res = true;
  }

  return res;
}

// endregion
