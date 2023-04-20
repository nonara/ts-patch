import { Logger, LogLevel } from '../system';
import chalk from 'chalk';
import path from 'path';
import { copyFileWithLock, mkdirIfNotExist, readFileWithLock, writeFileWithLock } from '../utils';
import fs from 'fs';
import { getModuleFile, TsModule } from '../module';
import { patchModule } from './patch-module';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface GetPatchedSourceOptions {
  log?: Logger
  skipCache?: boolean
  skipDts?: boolean
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getPatchedSource(tsModule: TsModule, options?: GetPatchedSourceOptions):
  { js: string, dts: string | undefined, loadedFromCache: boolean }
{
  const { backupCachePaths, patchedCachePaths } = tsModule;
  const { log, skipCache } = options || {};

  /* Write backup if not patched */
  if (!tsModule.isPatched) {
    for (const [ key, backupPath ] of Object.entries(backupCachePaths)) {
      const srcPath = key === 'dts' ? tsModule.dtsPath : tsModule.modulePath;
      if (key === 'dts' && options?.skipDts) continue;
      if (!srcPath) continue;

      log?.([ '~', `Writing backup cache to ${chalk.blueBright(backupPath)}` ], LogLevel.verbose);

      const cacheDir = path.dirname(backupPath);
      mkdirIfNotExist(cacheDir);
      copyFileWithLock(srcPath, backupPath);
    }
  }

  /* Get Patched Module */
  const canUseCache = !skipCache
    && !tsModule.moduleFile.patchDetail?.isOutdated
    && (!patchedCachePaths.dts || fs.existsSync(patchedCachePaths.dts))
    && fs.existsSync(patchedCachePaths.js)
    && !getModuleFile(patchedCachePaths.js).patchDetail?.isOutdated;

  let js: string | undefined;
  let dts: string | undefined;
  if (canUseCache) {
    js = readFileWithLock(patchedCachePaths.js);
    dts = !options?.skipDts && patchedCachePaths.dts ? readFileWithLock(patchedCachePaths.dts) : undefined;
  } else {
    const res = patchModule(tsModule, options?.skipDts);
    js = res.js;
    dts = res.dts;

    /* Write patched cache */
    if (!skipCache) {
      const cacheDir = path.dirname(patchedCachePaths.js);

      for (const [ key, patchPath ] of Object.entries(patchedCachePaths)) {
        const srcPath = key === 'dts' ? dts : js;
        if (key === 'dts' && options?.skipDts) continue;
        if (!srcPath) continue;

        log?.([ '~', `Writing patched cache to ${chalk.blueBright(patchPath)}` ], LogLevel.verbose);

        mkdirIfNotExist(cacheDir);
        writeFileWithLock(patchPath, srcPath);
      }
    }
  }

  return { js, dts, loadedFromCache: canUseCache };
}

// endregion
