import { LogLevel, PatchError, TspError, } from '../system';
import { getTsPackage } from '../ts-package';
import chalk from 'chalk';
import { getModuleFile, getTsModule, ModuleFile } from '../module';
import path from 'path';
import { getInstallerOptions, InstallerOptions } from '../options';
import { writeFileWithLock } from '../utils';
import { getPatchedSource } from '../patch/get-patched-source';
import { existsSync } from 'fs';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

/**
 * Patch a TypeScript module
 */
export function patch(moduleName: string, opts?: Partial<InstallerOptions>): boolean
export function patch(moduleNames: string[], opts?: Partial<InstallerOptions>): boolean
export function patch(moduleNameOrNames: string | string[], opts?: Partial<InstallerOptions>): boolean {
  const targetModuleNames = [ moduleNameOrNames ].flat();
  if (!targetModuleNames.length) throw new PatchError(`Must provide at least one module name to patch`);

  const options = getInstallerOptions(opts);
  const { logger: log, dir, skipCache } = options;

  /* Load Package */
  const tsPackage = getTsPackage(dir);

  /* Get modules to patch and patch info */
  const moduleFiles: [ string, ModuleFile ][] =
    targetModuleNames
      .filter(m => existsSync(tsPackage.getModulePath(m)))
      .map(m => [ m, getModuleFile(tsPackage.getModulePath(m)) ]);
  if (!moduleFiles.length) throw new PatchError(`No valid modules found to patch`);

  /* Determine files not already patched or outdated  */
  const patchableFiles = moduleFiles.filter(entry => {
    const [ moduleName, moduleFile ] = entry;
    if (!moduleFile.patchDetail || moduleFile.patchDetail.isOutdated) return true;
    else {
      log([ '!',
        `${chalk.blueBright(moduleName)} is already patched with the latest version. For details, run: ` +
        chalk.bgBlackBright('ts-patch check')
      ]);

      return false;
    }
  });

  if (!patchableFiles.length) return true;

  /* Patch modules */
  const failedModulePaths: string[] = [];
  for (let entry of patchableFiles) {
    /* Load Module */
    const { 1: moduleFile } = entry;
    const tsModule = getTsModule(tsPackage, moduleFile, { skipCache: true });

    const { moduleName, modulePath } = tsModule;
    log(
      [ '~', `Patching ${chalk.blueBright(moduleName)} in ${chalk.blueBright(path.dirname(modulePath ))}` ],
      LogLevel.verbose
    );

    try {
      const { js, dts, loadedFromCache } = getPatchedSource(tsModule, { skipCache, log });

      /* Write Patched Module */
      log(
        [
          '~',
          `Writing patched ${chalk.blueBright(moduleName)} to ` +
          `${chalk.blueBright(modulePath)}${loadedFromCache ? ' (cached)' : ''}`
        ],
        LogLevel.verbose
      );

      writeFileWithLock(tsModule.modulePath, js!);
      if (dts) writeFileWithLock(tsModule.dtsPath!, dts!);

      log([ '+', chalk.green(`Successfully patched ${chalk.bold.yellow(moduleName)}.\r\n`) ], LogLevel.verbose);
    } catch (e) {
      if (e instanceof TspError || options.logLevel >= LogLevel.verbose) log([ '!', e.message ]);
      failedModulePaths.push(tsModule.modulePath);
    }
  }

  if (failedModulePaths.length > 1) {
    log([ '!',
      `Some files can't be patched! You can run again with --verbose to get specific error detail. The following files are unable to be ` +
      `patched:\n  - ${failedModulePaths.join('\n  - ')}`
    ]);

    return false;
  }

  return true;
}

// endregion
