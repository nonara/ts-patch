import path from 'path';
import { getTsModule, TsModule } from './ts-module';
import { getTsPackage } from '../ts-package';
import { getPatchedSource } from '../patch/get-patched-source';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getLiveModule(moduleName: TsModule.Name) {
  const skipCache = process.env.TSP_SKIP_CACHE === 'true';
  const tsPath = process.env.TSP_COMPILER_TS_PATH ? path.resolve(process.env.TSP_COMPILER_TS_PATH) : require.resolve('typescript');

  /* Open the TypeScript module */
  const tsPackage = getTsPackage(tsPath);
  const tsModule = getTsModule(tsPackage, moduleName, { skipCache });

  /* Get patched version */
  const { js } = getPatchedSource(tsModule, { skipCache, skipDts: true });

  return { js, tsModule };
}

// endregion
