import path from 'path';
import ts from 'typescript';
import fs from 'fs';
import type { TsPackage } from '../ts-package';
import { ModuleSource, visitModule } from './visit-module';
import { PackageError } from '../system';
import { readFile } from '../system/read-file';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

export namespace TsModule {
  export const names = <const>['tsc.js', 'tsserverlibrary.js', 'typescript.js', 'tsserver.js'];
  export const cachedPatchFilename = 'patched.js';
  export const cachedBackupFilename = 'backup.js';
  export const cachedPatchDtsFilename = 'patched.d.ts';
  export const cachedBackupDtsFilename = 'backup.d.ts';
}

// endregion


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface TsModule {
  package: TsPackage;
  majorVer: number;
  minorVer: number;
  moduleName: TsModule.Name | string;
  modulePath: string;
  cacheKey: string;
  cachePath: string
  source: ModuleSource;
  dtsPath?: string;
  dtsCacheKey?: string;
  dtsCachePath?: string;
  dtsText?: string

  getCachedPatched(): { js: string, dts?: string } | undefined
  getCachedBackup(): { js: string, dts?: string } | undefined
}

export namespace TsModule {
  export type Name = typeof names[number];
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getTsModule(tsPackage: TsPackage, moduleName: TsModule.Name | string, skipCache?: boolean): TsModule {
  if (tsPackage.moduleCache.has(moduleName)) return tsPackage.moduleCache.get(moduleName)!;

  /* Find File */
  const modulePath = path.join(tsPackage.libDir, moduleName);
  if (!fs.existsSync(modulePath)) throw new PackageError(`Cannot find module file: ${modulePath}`);
  const maybeDtsFile = modulePath.replace(/\.js$/, '.d.ts');
  const dtsPath = fs.existsSync(maybeDtsFile) ? maybeDtsFile : undefined;

  /* Walk AST */
  const moduleFile = readFile(modulePath, skipCache);
  const sourceFile = ts.createSourceFile(
    modulePath,
    moduleFile.content,
    ts.ScriptTarget.Latest,
    true
  );
  const moduleSource = visitModule(sourceFile);

  /* Get DTS */
  const dtsFile = dtsPath ? readFile(dtsPath, skipCache) : undefined;
  const dtsText = dtsFile && dtsFile.content;
  const dtsCacheKey = dtsFile && dtsFile.hash;

  const cacheKey = moduleFile.hash;
  const cachePath = path.join(tsPackage.cacheDir, cacheKey);

  /* Create Module */
  const tsModule: TsModule = {
    majorVer: tsPackage.majorVer,
    minorVer: tsPackage.minorVer,
    moduleName,
    cacheKey,
    cachePath,
    modulePath: modulePath,
    source: moduleSource,
    package: tsPackage,
    dtsPath,
    dtsText,
    dtsCacheKey,

    getCachedPatched() {
      const jsFilePath = path.join(this.cachePath, TsModule.cachedPatchFilename);
      const dtsFilePath = this.dtsCachePath && path.join(this.dtsCachePath, TsModule.cachedPatchDtsFilename);
      if (!fs.existsSync(jsFilePath) || (dtsFilePath && !fs.existsSync(dtsFilePath))) return undefined;

      const js = fs.readFileSync(jsFilePath, 'utf-8');
      const dts = dtsFilePath && fs.readFileSync(dtsFilePath, 'utf-8');

      return { js, dts };
    },

    getCachedBackup() {
      const jsFilePath = path.join(this.cachePath, TsModule.cachedBackupFilename);
      const dtsFilePath = this.dtsCachePath && path.join(this.dtsCachePath, TsModule.cachedBackupDtsFilename);
      if (!fs.existsSync(jsFilePath) || (dtsFilePath && !fs.existsSync(dtsFilePath))) return undefined;

      const js = fs.readFileSync(jsFilePath, 'utf-8');
      const dts = dtsFilePath && fs.readFileSync(dtsFilePath, 'utf-8');

      return { js, dts };
    }
  }

  tsPackage.moduleCache.set(moduleName, tsModule);

  return tsModule;
}

// endregion
