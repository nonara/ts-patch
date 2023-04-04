import {
  copyFileWithLock, LogLevel, mkdirIfNotExist, PatchError, readFileWithLock, TspError, writeFileWithLock
} from '../system';
import { getTsPackage } from '../ts-package';
import chalk from 'chalk';
import { getModuleFile, getTsModule, ModuleFile } from '../module';
import path from 'path';
import fs from "fs";
import { patchModule } from "../patch/patch-module";
import { getInstallerOptions, InstallerOptions } from "../options";


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
    targetModuleNames.map(m => [ m, getModuleFile(tsPackage.getModulePath(m)) ]);

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
      const { backupCachePaths } = tsModule;

      /* Write backup */
      if (!tsModule.isPatched) {
        for (const [ key, backupPath ] of Object.entries(backupCachePaths)) {
          const srcPath = key === 'dts' ? tsModule.dtsPath : tsModule.modulePath;
          if (!srcPath) continue;

          log([ '~', `Writing backup to ${chalk.blueBright(backupPath)}` ], LogLevel.verbose);

          const cacheDir = path.dirname(backupPath);
          mkdirIfNotExist(cacheDir);
          copyFileWithLock(srcPath, backupPath);
        }
      }

      /* Get Patched Module */
      const canUseCache = !skipCache
        && (!backupCachePaths.dts || fs.existsSync(backupCachePaths.dts))
        && fs.existsSync(backupCachePaths.js);

      let js: string | undefined;
      let dts: string | undefined;
      if (canUseCache) {
        js = readFileWithLock(backupCachePaths.js);
        dts = backupCachePaths.dts && readFileWithLock(backupCachePaths.dts);
      } else {
        const res = patchModule(tsModule);
        js = res.js;
        dts = res.dts;
      }

      /* Write Patched Module */
      log(
        [
          '~',
          `Writing patched ${chalk.blueBright(moduleName)} to ` +
          `${chalk.blueBright(modulePath)}${canUseCache ? ' (cached)' : ''}`
        ],
        LogLevel.verbose
      );

      writeFileWithLock(tsModule.modulePath, js!);
      if (dts) writeFileWithLock(tsModule.dtsPath!, dts!);

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
