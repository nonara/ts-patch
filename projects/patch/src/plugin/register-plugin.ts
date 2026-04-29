/// <reference types="node"/>

namespace tsp {
  const path = require('path');

  let configStack: RegisterConfig[] = [];

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  export interface RegisterConfig {
    compilerLoaderCleanup?: () => void
    tsConfigPathsCleanup?: () => void
    isTs: boolean
    pluginConfig: PluginConfig
    tsConfig: string | undefined
    compilerOptions?: tsShim.CompilerOptions
  }

  // endregion

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  export function getTsConfigPaths() {
    try {
      return require('tsconfig-paths') as typeof import('tsconfig-paths');
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND')
        throw new TsPatchError(
          `resolvePathAliases requires the library: tsconfig-paths. `+
          `Add tsconfig-paths as a (dev)-dependency or install globally.`
        );
      else throw e;
    }
  }

  function getCompilerOptions(tsConfig: string) {
    const configFile = tsShim.readConfigFile(tsConfig, tsShim.sys.readFile);
    const parsedConfig = configFile && tsShim.parseJsonConfigFileContent(
      configFile.config,
      tsShim.sys,
      path.dirname(tsConfig)
    );

    return parsedConfig.options;
  }

  // endregion

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  export function unregisterPlugin() {
    const activeRegisterConfig = configStack.pop()!;

    if (activeRegisterConfig.tsConfigPathsCleanup) {
      activeRegisterConfig.tsConfigPathsCleanup();
      delete activeRegisterConfig.tsConfigPathsCleanup;
    }

    if (activeRegisterConfig.compilerLoaderCleanup) {
      activeRegisterConfig.compilerLoaderCleanup();
      delete activeRegisterConfig.compilerLoaderCleanup;
    }
  }

  export function registerPlugin(registerConfig: RegisterConfig) {
    if (!registerConfig) throw new TsPatchError('requireConfig is required');
    configStack.push(registerConfig);

    const { isTs, tsConfig, pluginConfig } = registerConfig;

    /* Register tsconfig-paths */
    if (tsConfig && pluginConfig.resolvePathAliases) {
      registerConfig.compilerOptions ??= getCompilerOptions(tsConfig);

      const { paths, baseUrl } = registerConfig.compilerOptions;
      if (paths && baseUrl) {
        registerConfig.tsConfigPathsCleanup = getTsConfigPaths().register({ baseUrl, paths });
      }
    }

    /* Register TypeScript compiler loader */
    if (isTs) {
      if (tsConfig) registerConfig.compilerOptions ??= getCompilerOptions(tsConfig);
      registerConfig.compilerLoaderCleanup = registerCompilerLoader(registerConfig);
    }
  }

  // endregion
}
