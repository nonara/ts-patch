import path from 'path';
import fs from 'fs';
import type { TsPackage } from '../ts-package';
import { getModuleSource, ModuleSource } from './module-source';
import { getCachePath, TspError } from '../system';
import { getModuleFile, ModuleFile } from './module-file';
import { cachedFilePatchedPrefix } from '../config';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

export namespace TsModule {
  export const names = <const>[
    'tsc.js', 
    'tsserverlibrary.js', 
    'typescript.js', 
    'tsserver.js', 
    '_tsc.js', 
    '_tsserver.js',
  ];
}

// endregion


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface TsModule {
  package: TsPackage;
  majorVer: number;
  minorVer: number;
  isPatched: boolean;

  moduleName: TsModule.Name;
  modulePath: string;
  moduleFile: ModuleFile;
  dtsPath: string | undefined;

  cacheKey: string;
  backupCachePaths: { js: string, dts?: string };
  patchedCachePaths: { js: string, dts?: string };

  getUnpatchedModuleFile(): ModuleFile;
  getUnpatchedSource(): ModuleSource;
}

export namespace TsModule {
  export type Name = (typeof names)[number] | string;
}

export interface GetTsModuleOptions {
  skipCache?: boolean
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getTsModule(tsPackage: TsPackage, moduleName: TsModule.Name, options?: GetTsModuleOptions):
  TsModule
export function getTsModule(tsPackage: TsPackage, moduleFile: ModuleFile, options?: GetTsModuleOptions): TsModule
export function getTsModule(
  tsPackage: TsPackage,
  moduleNameOrModuleFile: TsModule.Name | ModuleFile,
  options?: GetTsModuleOptions
): TsModule {
  const skipCache = options?.skipCache;

  /* Get Module File */
  let moduleFile: ModuleFile | undefined;
  let moduleName: string | undefined;
  let modulePath: string | undefined;
  if (typeof moduleNameOrModuleFile === "object" && moduleNameOrModuleFile.content) {
    moduleFile = moduleNameOrModuleFile;
    moduleName = moduleFile.moduleName;
    modulePath = moduleFile.filePath;
  } else {
    moduleName = moduleNameOrModuleFile as TsModule.Name;
  }

  /* Handle Local Cache */
  if (!skipCache && tsPackage.moduleCache.has(moduleName)) return tsPackage.moduleCache.get(moduleName)!;

  /* Load File (if not already) */
  if (!modulePath) modulePath = path.join(tsPackage.libDir, moduleName);
  if (!moduleFile) moduleFile = getModuleFile(modulePath);

  /* Get DTS if exists */
  const maybeDtsFile = modulePath.replace(/\.js$/, '.d.ts');
  const dtsPath = fs.existsSync(maybeDtsFile) ? maybeDtsFile : undefined;
  const dtsName = dtsPath && path.basename(dtsPath);

  /* Get Cache Paths */
  const cacheKey = moduleFile.patchDetail?.originalHash || moduleFile.getHash();
  const backupCachePaths = {
    js: getCachePath(cacheKey, moduleName),
    dts: dtsName && getCachePath(cacheKey, dtsName)
  }
  const patchedCachePaths = {
    js: getCachePath(cacheKey, cachedFilePatchedPrefix + moduleName),
    dts: dtsName && getCachePath(cacheKey, cachedFilePatchedPrefix + dtsName)
  }

  /* Create Module */
  const isPatched = !!moduleFile.patchDetail;
  let originalModuleFile: ModuleFile | undefined;
  const tsModule: TsModule = {
    package: tsPackage,
    majorVer: tsPackage.majorVer,
    minorVer: tsPackage.minorVer,
    isPatched,

    moduleName,
    modulePath,
    moduleFile,
    dtsPath,

    cacheKey,
    backupCachePaths,
    patchedCachePaths,

    getUnpatchedSource() {
      return getModuleSource(this);
    },

    getUnpatchedModuleFile() {
      if (!originalModuleFile) {
        if (isPatched) {
          if (!fs.existsSync(backupCachePaths.js)) throw new TspError(`Cannot find backup cache file for ${moduleName}. Please wipe node_modules and reinstall.`);
          originalModuleFile = getModuleFile(backupCachePaths.js);
        } else {
          originalModuleFile = isPatched ? getModuleFile(backupCachePaths.js) : moduleFile!;
        }
      }

      return originalModuleFile;
    }
  };

  tsPackage.moduleCache.set(moduleName, tsModule);

  return tsModule;
}

// endregion
