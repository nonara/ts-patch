namespace tsp {
  const path = require('path');
  const fs = require('fs');

  const requireStack: string[] = [];

  /* ****************************************************** */
  // region: Types
  /* ****************************************************** */

  export namespace TspPlugin {
    export interface CreateOptions {
      resolveBaseDir: string
    }

    export type Kind = 'SourceTransformer' | 'ProgramTransformer'
  }

  // endregion

  /* ****************************************************** */
  // region: Helpers
  /* ****************************************************** */

  function getModulePackagePath(transformerPath: string, packageFilePath: string): string | undefined {
    let currentDir = path.dirname(transformerPath);

    const seenPaths = new Set<string>();
    while (currentDir !== path.parse(currentDir).root) {
      if (seenPaths.has(currentDir)) return undefined;
      seenPaths.add(currentDir);

      // Could likely fail if the transformer is in a symlinked directory or the package's main file is in a
      // directory above the package.json – however, I believe that the walking up method used here is the common
      // approach, so we'll consider these acceptable edge cases for now.
      if (path.relative(currentDir, packageFilePath).startsWith('..')) return undefined;

      const potentialPkgPath = path.join(currentDir, 'package.json');
      // If the project's package matches the transformer's package, return it
      if (fs.existsSync(potentialPkgPath)) {
        return potentialPkgPath === packageFilePath ? packageFilePath : undefined;
      }

      currentDir = path.resolve(currentDir, '..');
    }

    return undefined;
  }

  // endregion

  /* ****************************************************** */
  // region: TspPlugin
  /* ****************************************************** */

  export class TspPlugin {
    public readonly config: PluginConfig;
    public readonly tsConfigPath: string | undefined;
    public readonly entryFilePath: string;
    public readonly importKey: string;
    public readonly packageConfig: PluginPackageConfig | undefined;
    public readonly kind: TspPlugin.Kind;

    private readonly _createOptions: TspPlugin.CreateOptions;

    constructor(config: PluginConfig, createOptions: TspPlugin.CreateOptions) {
      this.config = { ...config };
      this.validateConfig();

      this._createOptions = createOptions;
      this.importKey = config.import || 'default';
      this.kind = config.transformProgram === true ? 'ProgramTransformer' : 'SourceTransformer';

      const { resolveBaseDir } = createOptions;
      const configTransformValue = config.transform!;

      /* Resolve paths */
      this.tsConfigPath = config.tsConfig && path.resolve(resolveBaseDir, config.tsConfig);
      const entryFilePath = require.resolve(configTransformValue, { paths: [ resolveBaseDir ] });
      this.entryFilePath = entryFilePath;
      let packageFilePath: string | undefined;
      try {
        packageFilePath = require.resolve(path.join(path.dirname(entryFilePath), 'package.json'), { paths: [ resolveBaseDir ] });
      } catch (e) {}

      /* Get module PluginPackageConfig */
      if (packageFilePath) {
        let pluginPackageConfig: PluginPackageConfig | undefined;

        const modulePackagePath = getModulePackagePath(entryFilePath, packageFilePath);
        if (modulePackagePath) {
          const modulePkgJsonContent = fs.readFileSync(modulePackagePath, 'utf8');
          const modulePkgJson = JSON.parse(modulePkgJsonContent) as { tsp?: PluginPackageConfig };

          pluginPackageConfig = modulePkgJson.tsp;
          if (pluginPackageConfig === null || typeof pluginPackageConfig !== 'object') pluginPackageConfig = undefined;
        }

        this.packageConfig = pluginPackageConfig;
      }
    }

    private validateConfig() {
      const { config } = this;

      const configTransformValue = config.transform;
      if (!configTransformValue) throw new TsPatchError(`Invalid plugin config: missing "transform" value`);

      if (config.resolvePathAliases && !config.tsConfig) {
        console.warn(`[ts-patch] Warning: resolvePathAliases needs a tsConfig value pointing to a tsconfig.json for transformer" ${configTransformValue}.`);
      }
    }

    createFactory() {
      const { entryFilePath, config, tsConfigPath, importKey } = this;
      const configTransformValue = config.transform!;

      /* Prevent circular require */
      if (requireStack.includes(entryFilePath)) return;
      requireStack.push(entryFilePath);

      /* Check if ESM */
      let isEsm: boolean | undefined = config.isEsm;
      if (isEsm == null) {
        const impliedModuleFormat = tsShim.getImpliedNodeFormatForFile(
          entryFilePath as tsShim.Path,
          undefined,
          tsShim.sys,
          { moduleResolution: tsShim.ModuleResolutionKind.Node16 }
        );

        isEsm = impliedModuleFormat === tsShim.ModuleKind.ESNext;
      }

      const isTs = configTransformValue.match(/\.[mc]?ts$/) != null;

      const registerConfig: RegisterConfig = {
        isTs,
        isEsm,
        tsConfig: tsConfigPath,
        pluginConfig: config
      };

      registerPlugin(registerConfig);

      try {
        /* Load plugin */
        const commonjsModule = loadEntryFile();

        const factoryModule = (typeof commonjsModule === 'function') ? { default: commonjsModule } : commonjsModule;
        const factory = factoryModule[importKey];

        if (!factory)
          throw new TsPatchError(
            `tsconfig.json > plugins: "${configTransformValue}" does not have an export "${importKey}": ` +
            require('util').inspect(factoryModule)
          );

        if (typeof factory !== 'function') {
          throw new TsPatchError(
            `tsconfig.json > plugins: "${configTransformValue}" export "${importKey}" is not a plugin: ` +
            require('util').inspect(factory)
          );
        }

        return {
          factory,
          registerConfig: registerConfig
        };
      }
      finally {
        requireStack.pop();
        unregisterPlugin();
      }

      function loadEntryFile(): PluginFactory | { [key: string]: PluginFactory } {
        /* Load plugin */
        let res: PluginFactory | { [key: string]: PluginFactory }
        try {
          res = require(entryFilePath);
        } catch (e) {
          if (e.code === 'ERR_REQUIRE_ESM') {
            if (!registerConfig.isEsm) {
              unregisterPlugin();
              registerConfig.isEsm = true;
              registerPlugin(registerConfig);
              return loadEntryFile();
            } else {
              throw new TsPatchError(
                `Cannot load ESM transformer "${configTransformValue}" from "${entryFilePath}". Please file a bug report`
              );
            }
          }
          else throw e;
        }
        return res;
      }
    }
  }

  // endregion
}

// endregion
