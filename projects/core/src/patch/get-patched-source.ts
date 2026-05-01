import { getCachePath, Logger, LogLevel } from '../system';
import chalk from 'chalk';
import path from 'path';
import { copyFileWithLock, mkdirIfNotExist, readFileWithLock, writeFileWithLock } from '../utils';
import fs from 'fs';
import { getModuleFile, TsModule } from '../module';
import { patchModule } from './patch-module';
import { cachedFilePatchedPrefix } from '../config';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface GetPatchedSourceOptions {
  log?: Logger
  skipCache?: boolean
  skipDts?: boolean
  libraryName?: string
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getPatchedSource(tsModule: TsModule, options?: GetPatchedSourceOptions):
  { js: string, dts: string | undefined, loadedFromCache: boolean }
{
  const { backupCachePaths } = tsModule;
  const { log, skipCache, libraryName } = options || {};
  const defaultLibraryName = tsModule.moduleName.replace(/\.js$/, '');
  const patchedCachePaths = libraryName && libraryName !== defaultLibraryName
    ? getLibraryPatchedCachePaths(tsModule, libraryName)
    : tsModule.patchedCachePaths;

  /* Write backup if not patched */
  if (!tsModule.isPatched) {
    for (const [ key, backupPath ] of Object.entries(backupCachePaths)) {
      const srcPath = key === 'dts' ? tsModule.dtsPath : tsModule.moduleContentFilePath;
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
    && (options?.skipDts || !patchedCachePaths.dts || fs.existsSync(patchedCachePaths.dts))
    && fs.existsSync(patchedCachePaths.js)
    && !getModuleFile(patchedCachePaths.js).patchDetail?.isOutdated;

  let js: string | undefined;
  let dts: string | undefined;
  if (canUseCache) {
    js = readFileWithLock(patchedCachePaths.js);
    dts = !options?.skipDts && patchedCachePaths.dts ? readFileWithLock(patchedCachePaths.dts) : undefined;
  } else {
    const res = patchModule(tsModule, { skipDts: options?.skipDts, libraryName });
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

function getLibraryPatchedCachePaths(tsModule: TsModule, libraryName: string) {
  const jsName = withLibraryName(tsModule.moduleName, libraryName);
  const dtsName = tsModule.dtsPath && withLibraryName(path.basename(tsModule.dtsPath), libraryName);

  return {
    js: getCachePath(tsModule.cacheKey, cachedFilePatchedPrefix + jsName),
    dts: dtsName && getCachePath(tsModule.cacheKey, cachedFilePatchedPrefix + dtsName)
  };
}

function withLibraryName(fileName: string, libraryName: string) {
  return fileName.replace(/(\.d\.ts|(?:\.[^.]+))$/, `@${libraryName}$1`);
}

// endregion
