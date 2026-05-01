import path from 'path';
import { getTsModule, TsModule } from './ts-module';
import { getTsPackage } from '../ts-package';
import { getPatchedSource } from '../patch/get-patched-source';
import { assertSupportedTypeScript } from '../system';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface GetLiveModuleOptions {
  libraryName?: string
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getLiveTypeScriptPath() {
  return process.env.TSP_COMPILER_TS_PATH
    ? path.resolve(process.env.TSP_COMPILER_TS_PATH)
    : require.resolve('typescript');
}

export function getLiveTypeScriptPackage() {
  return getTsPackage(getLiveTypeScriptPath());
}

export function getLiveModule(moduleName: TsModule.Name, opts?: GetLiveModuleOptions) {
  const skipCache = process.env.TSP_SKIP_CACHE === 'true';
  const libraryName = opts?.libraryName ?? String(moduleName).replace(/\.js$/, '');

  /* Open the TypeScript module */
  const tsPackage = getLiveTypeScriptPackage();
  assertSupportedTypeScript(tsPackage);

  const tsModule = getTsModule(tsPackage, moduleName, { skipCache });

  /* Get patched version */
  const { js } = getPatchedSource(tsModule, { skipCache, skipDts: true, libraryName });

  return { js, tsModule };
}

// endregion
