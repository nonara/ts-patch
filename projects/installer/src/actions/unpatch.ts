import { getInstallerOptions, InstallerOptions, LogLevel, PatchError, RestoreError } from '../system';
import chalk from 'chalk';
import path from 'path';
import { getPatchInfo, getTsPackage, PatchInfo } from '../ts-package';
import { TsModule } from '../ts-module';
import fs from 'fs';


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
  const allModulePatchInfo = tsPackage.modulePatchInfo;
  const targetModulePatchInfo = new Map<string, PatchInfo | undefined>();
  for (const moduleName of targetModuleNames) {
    const patchInfo = allModulePatchInfo.has(moduleName)
      ? allModulePatchInfo.get(moduleName)
      : getPatchInfo(tsPackage, moduleName);

    targetModulePatchInfo.set(moduleName, patchInfo);
  }

  const unpatchTargets = [] as [ TsModule, ReturnType<TsModule['getCachedBackup']> ][];
  for (const [ moduleName, patchInfo ] of targetModulePatchInfo) {
    if (!patchInfo) {
      log([ '!', `${chalk.blueBright(moduleName)} is not patched. For details, run: ` + chalk.bgBlackBright('ts-patch check') ]);
      continue;
    }

    const tsModule = tsPackage.getModule(moduleName, options.skipCache);

    const backup = tsModule.getCachedBackup();
    if (!backup) {
      res = false;
      log([ '!', `Missing backup for ${chalk.blueBright(moduleName)}. Cannot restore! Reinstall typescript to restore.` ]);
    } else {
      unpatchTargets.push([ tsModule, backup ]);
    }
  }

  /* Restore files */
  const errors: Record<string, Error> = {};
  for (const [ tsModule, backup ] of unpatchTargets) {
    try {
      log(
        [
          '~',
          `Restoring ${chalk.blueBright(tsModule.moduleName)} in ${chalk.blueBright(path.dirname(tsPackage.libDir))}`
        ],
        LogLevel.verbose
      );

      fs.writeFileSync(backup!.js, tsModule.modulePath);
      if (backup!.dts) fs.writeFileSync(backup!.dts, tsModule.dtsPath!);

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
