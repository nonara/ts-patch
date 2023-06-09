/// <reference types="node"/>

namespace tsp {
  const path = require('path');

  let configStack: RegisterConfig[] = [];

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  export interface RegisterConfig {
    tsNodeInstance?: import('ts-node').Service
    tsConfigPathsCleanup?: () => void
    esmInterceptCleanup?: () => void
    isTs: boolean
    pluginConfig: PluginConfig
    isEsm: boolean
    tsConfig: string | undefined
    compilerOptions?: tsShim.CompilerOptions
  }

  // endregion

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function getTsNode() {
    try {
      return require('ts-node') as typeof import('ts-node');
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND')
        throw new TsPatchError(
          `Cannot use a typescript-based transformer without ts-node installed. `+
          `Add ts-node as a (dev)-dependency or install globally.`
        );
      else throw e;
    }
  }

  function getTsConfigPaths() {
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

    if (activeRegisterConfig.tsNodeInstance) {
      activeRegisterConfig.tsNodeInstance.enabled(false);
    }

    if (activeRegisterConfig.esmInterceptCleanup) {
      activeRegisterConfig.esmInterceptCleanup();
      delete activeRegisterConfig.esmInterceptCleanup;
    }
  }

  export function registerPlugin(registerConfig: RegisterConfig) {
    if (!registerConfig) throw new TsPatchError('requireConfig is required');
    configStack.push(registerConfig);

    const { isTs, isEsm, tsConfig, pluginConfig } = registerConfig;

    /* Register ESM */
    if (isEsm) {
      registerConfig.esmInterceptCleanup = registerEsmIntercept(registerConfig);
    }

    /* Register tsNode */
    if (isTs) {
      const tsNode = getTsNode();

      let tsNodeInstance: import('ts-node').Service;
      if (registerConfig.tsNodeInstance) {
        tsNodeInstance = registerConfig.tsNodeInstance;
        tsNode.register(tsNodeInstance);
      } else {
        tsNodeInstance = tsNode.register({
          transpileOnly: true,
          ...(tsConfig ? { project: tsConfig } : { skipProject: true }),
          compilerOptions: {
            target: isEsm ? 'ESNext' : 'ES2018',
            jsx: 'react',
            esModuleInterop: true,
            module: isEsm ? 'ESNext' : 'commonjs',
          }
        });
      }

      tsNodeInstance.enabled(true);
      registerConfig.tsNodeInstance = tsNodeInstance;
    }

    /* Register tsconfig-paths */
    if (tsConfig && pluginConfig.resolvePathAliases) {
      registerConfig.compilerOptions ??= getCompilerOptions(tsConfig);

      const { paths, baseUrl } = registerConfig.compilerOptions;
      if (paths && baseUrl) {
        registerConfig.tsConfigPathsCleanup = getTsConfigPaths().register({ baseUrl, paths });
      }
    }
  }

  // endregion
}
