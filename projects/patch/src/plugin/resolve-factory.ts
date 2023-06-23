namespace tsp {
  const path = require('path');

  const requireStack: string[] = [];

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  export interface ResolveFactoryResult {
    factory: PluginFactory | ProgramTransformer
    registerConfig: RegisterConfig
  }

  // endregion

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  export function resolveFactory(pluginCreator: PluginCreator, pluginConfig: PluginConfig): ResolveFactoryResult | undefined {
    const tsConfig = pluginConfig.tsConfig && path.resolve(pluginCreator.resolveBaseDir, pluginConfig.tsConfig);
    const transform = pluginConfig.transform!;
    const importKey = pluginConfig.import || 'default';
    const transformerPath = require.resolve(transform, { paths: [ pluginCreator.resolveBaseDir ] });

    if (pluginConfig.resolvePathAliases && !tsConfig) {
      console.warn(`[ts-patch] Warning: resolvePathAliases needs a tsConfig value pointing to a tsconfig.json for transformer" ${transform}.`);
    }

    /* Prevent circular require */
    if (requireStack.includes(transformerPath)) return;
    requireStack.push(transformerPath);

    /* Check if ESM */
    let isEsm: boolean | undefined = pluginConfig.isEsm;
    if (isEsm == null) {
      const impliedModuleFormat = tsShim.getImpliedNodeFormatForFile(
        transformerPath as tsShim.Path,
        undefined,
        tsShim.sys,
        { moduleResolution: tsShim.ModuleResolutionKind.Node16 }
      );

      isEsm = impliedModuleFormat === tsShim.ModuleKind.ESNext;
    }

    const isTs = transform!.match(/\.[mc]?ts$/) != null;

    const registerConfig: RegisterConfig = {
      isTs,
      isEsm,
      tsConfig: tsConfig,
      pluginConfig
    };

    registerPlugin(registerConfig);

    try {
      /* Load plugin */
      const commonjsModule = loadPlugin();

      const factoryModule = (typeof commonjsModule === 'function') ? { default: commonjsModule } : commonjsModule;
      const factory = factoryModule[importKey];

      if (!factory)
        throw new TsPatchError(
          `tsconfig.json > plugins: "${transform}" does not have an export "${importKey}": ` +
          require('util').inspect(factoryModule)
        );

      if (typeof factory !== 'function') {
        throw new TsPatchError(
          `tsconfig.json > plugins: "${transform}" export "${importKey}" is not a plugin: ` +
          require('util').inspect(factory)
        );
      }

      return {
        factory,
        registerConfig: registerConfig,
      };
    }
    finally {
      requireStack.pop();
      unregisterPlugin();
    }

    function loadPlugin(): PluginFactory | { [key: string]: PluginFactory } {
      /* Load plugin */
      let res: PluginFactory | { [key: string]: PluginFactory }
      try {
        res = require(transformerPath);
      } catch (e) {
        if (e.code === 'ERR_REQUIRE_ESM') {
          if (!registerConfig.isEsm) {
            unregisterPlugin();
            registerConfig.isEsm = true;
            registerPlugin(registerConfig);
            return loadPlugin();
          } else {
            throw new TsPatchError(
              `Cannot load ESM transformer "${transform}" from "${transformerPath}". Please file a bug report`
            );
          }
        }
        else throw e;
      }
      return res;
    }
  }

  // endregion
}

// endregion
