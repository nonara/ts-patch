namespace tsp {
  const path = require('path');

  const requireStack: string[] = [];

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  export interface ResolveFactoryResult {
    factory: PluginFactory | ProgramTransformer
    requireConfig: RequireConfig
  }

  // endregion

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  export function resolveFactory(pluginCreator: PluginCreator, pluginConfig: PluginConfig): ResolveFactoryResult | undefined {
    let compilerOptions: tsShim.CompilerOptions | undefined;
    let moduleResolutionCache: tsShim.ModuleResolutionCache | undefined;

    const tsConfig = pluginConfig.tsConfig && path.resolve(pluginCreator.resolveBaseDir, pluginConfig.tsConfig);
    const transform = pluginConfig.transform!;
    const importKey = pluginConfig.import || 'default';
    const builtFiles = new Map<string, string>();
    const transformerPath = require.resolve(transform, { paths: [ pluginCreator.resolveBaseDir ] });

    if (pluginConfig.resolvePathAliases && !tsConfig) {
      console.warn(`[ts-patch] Warning: resolvePathAliases needs a tsConfig value pointing to a tsconfig.json for transformer" ${transform}.`);
    }

    /* Prevent circular require */
    // process.stderr.write('PRE: ' + transformerPath + '\n');
    if (requireStack.includes(transformerPath)) return;
    requireStack.push(transformerPath);

    let isEsm: boolean | undefined = pluginConfig.isEsm;
    /* Check if ESM */
    if (isEsm == null) {
      const impliedModuleFormat = tsShim.getImpliedNodeFormatForFile(
        transformerPath as tsShim.Path,
        undefined,
        tsShim.sys,
        { moduleResolution: tsShim.ModuleResolutionKind.Node16 }
      );
      // process.stderr.write('impliedModuleFormat: ' + impliedModuleFormat + '\n');

      isEsm = impliedModuleFormat === tsShim.ModuleKind.ESNext;
    }

    const requireConfig: RequireConfig = {
      builtFiles,
      isEsm,
      tsConfig,
      compilerOptions,
      moduleResolutionCache,
      pluginConfig
    };

    hookRequire(requireConfig);

    try {
      /* Add support for TS transformers */
      if (transform!.match(/\.[mc]?ts$/)) {
        /* Load tsconfig */
        const configFile = tsConfig && tsShim.readConfigFile(tsConfig, tsShim.sys.readFile);
        const parsedConfigFile = configFile && tsShim.parseJsonConfigFileContent(configFile.config, tsShim.sys, path.dirname(tsConfig));
        compilerOptions = parsedConfigFile?.options;
        compilerOptions ??= {};
        requireConfig.compilerOptions = compilerOptions;

        /* Set CompilerOptions overrides */
        // TODO - It may be a good idea to swap this out in favour of adapting ts-node's ts-create-transpile-module
        //  approach. We should also add a way to disable our internal handling of this to allow custom solutions like
        //  ts-node to handle it all, if desired
        compilerOptions.target = tsShim.ScriptTarget.ES2020;
        compilerOptions.module = isEsm ? tsShim.ModuleKind.ESNext : tsShim.ModuleKind.CommonJS;
        compilerOptions.noEmit = false;
        compilerOptions.outDir = undefined;
        compilerOptions.declarations = false;

        // compilerOptions.noResolve = true;
        compilerOptions.isolatedModules = true;
        compilerOptions.allowNonTsExtensions = true;
        compilerOptions.suppressOutputPathCheck = true;
        compilerOptions.inlineSourceMap = true;
        compilerOptions.esModuleInterop = true;

        compilerOptions = tsShim.fixupCompilerOptions(compilerOptions) as tsShim.CompilerOptions;

        moduleResolutionCache = tsShim.createModuleResolutionCache(
          pluginCreator.resolveBaseDir,
          tsShim.sys.realpath ?? (tsShim.sys.useCaseSensitiveFileNames
              ? (x: string) => x
              : (<any>tsShim.sys).getCanonicalFileName
          ),
        );
        requireConfig.moduleResolutionCache = moduleResolutionCache;

        /* Create Program */
        const program = tsShim.createProgram([ transformerPath ], compilerOptions);

        // process.stderr.write(JSON.stringify(program.getSourceFiles().map(f => f.fileName), null, 2));
        // process.stderr.write(JSON.stringify(program.getCompilerOptions(), null, 2));

        /* Emit */
        const emitResult = program.emit(undefined, (fileName: string, data: string) => {
          // process.stderr.write(`file: ${fileName}\ndata: ${data}`);
          builtFiles.set(getCachePath(fileName), data);
        });

        /* Handle Diagnostics */
        const allDiagnostics = tsShim.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);
        allDiagnostics.forEach(diagnostic => {
          if (diagnostic.file) {
            const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start!);
            const message = tsShim.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            console.error(`${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
          } else {
            console.error(tsShim.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
          }
        });

        if (emitResult.emitSkipped) {
          console.error('Failed to compile transformer!');
          process.exit(1);
        }
      }

      /* Load plugin */
      let commonjsModule: PluginFactory | { [key: string]: PluginFactory } = require(transformerPath);

      const factoryModule = (typeof commonjsModule === 'function') ? { default: commonjsModule } : commonjsModule;
      const factory = factoryModule[importKey];

      if (!factory)
        throw new Error(
          `tsconfig.json > plugins: "${transform}" does not have an export "${importKey}": ` +
          require('util').inspect(factoryModule)
        );

      if (typeof factory !== 'function') {
        throw new Error(
          `tsconfig.json > plugins: "${transform}" export "${importKey}" is not a plugin: ` +
          require('util').inspect(factory)
        );
      }

      // process.stderr.write('POST: ' + transformerPath + '\n');

      return {
        factory,
        requireConfig,
      };
    }
    finally {
      requireStack.pop();
      unhookRequire();
    }
  }

  export function getCachePath(filePath: string) {
    const basedir = path.dirname(filePath);
    const basename = path.basename(filePath, path.extname(filePath));
    return tsShim.normalizePath(path.join(basedir, basename));
  }

  // endregion
}

// endregion
