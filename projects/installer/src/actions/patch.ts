import { getInstallerOptions, InstallerOptions, LogLevel, mkdirIfNotExist, PatchError, TspError } from '../system';
import { getPatchInfo, getTsPackage, PatchInfo } from '../ts-package';
import chalk from 'chalk';
import { TsModule } from '../ts-module';
import path from 'path';
import { patchModule } from '../ts-module/patch-module';
import fs from 'fs';


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

  /* Determine files not already patched or outdated  */
  const patchableModuleNames: string[] = [];
  for (const [ moduleName, patchInfo ] of targetModulePatchInfo) {
    if (!patchInfo || patchInfo.isOutdated) patchableModuleNames.push(moduleName);
    else log([ '!',
      `${chalk.blueBright(moduleName)} is already patched with the latest version. For details, run: ` +
      chalk.bgBlackBright('ts-patch check')
    ]);
  }

  if (!patchableModuleNames.length) return true;

  /* Load patchable modules */
  const failedModulePaths: string[] = [];
  const patchableModules: TsModule[] = [];
  for (const moduleName of patchableModuleNames) {
    try {
      const tsModule = tsPackage.getModule(moduleName, options.skipCache);
      patchableModules.push(tsModule);
    } catch (e) {
      if (e instanceof TspError) log([ '!', e.message ]);
      failedModulePaths.push(path.join(tsPackage.libDir, moduleName));
    }
  }

  /* Patch modules */
  for (let tsModule of patchableModules) {
    const { moduleName, modulePath } = tsModule;
    log(
      [ '~', `Patching ${chalk.blueBright(moduleName)} in ${chalk.blueBright(path.dirname(modulePath ))}` ],
      LogLevel.verbose
    );

    try {
      /* Handle Cached */
      let js: string | undefined;
      let dts: string | undefined;
      let isCached = false;
      if (!options.skipCache) {
        const cached = tsModule.getCachedPatched();
        if (cached) {
          js = cached.js;
          dts = cached.dts;
          isCached = true;
        }
      }

      if (!isCached) {
        const { js: patchedJs, dts: patchedDts } = patchModule(tsModule, false, options.skipCache);
        js = patchedJs;
        dts = patchedDts;

        mkdirIfNotExist(tsModule.cachePath);
        fs.writeFileSync(path.join(tsModule.cachePath, 'original.js'), tsModule.source.sourceText);
        fs.writeFileSync(path.join(tsModule.cachePath, 'patched.js'), js);
      }

      /* Write Patched Module */
      log(
        [
          '~',
          `Writing patched ${chalk.blueBright(moduleName)} to ${chalk.blueBright(modulePath)}${isCached ? ' (cached)' : ''}`
        ],
        LogLevel.verbose
      );
      fs.writeFileSync(tsModule.modulePath, js!);
      if (tsModule.dtsPath) fs.writeFileSync(tsModule.dtsPath, dts!);

      log([ '+', chalk.green(`Successfully patched ${chalk.bold.yellow(moduleName)}.\r\n`) ], LogLevel.verbose);
    } catch (e) {
      if (e instanceof TspError) log([ '!', e.message ]);
      failedModulePaths.push(tsModule.modulePath);
    }
  }

  if (failedModulePaths.length > 1) {
    log([ '!',
      `Some files can't be patched! Try updating to a newer version of ts-patch. The following files are unable to be ` +
      `patched. [${failedModulePaths.join(', ')}]`
    ]);

    return false;
  }

  return true;
}

// endregion
