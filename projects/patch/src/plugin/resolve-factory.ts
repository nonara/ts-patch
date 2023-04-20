namespace tsp {
  const requireStack: string[] = [];
  const path = require('path');
  const crypto = require('crypto');

  export function resolveFactory(pluginCreator: PluginCreator, config: PluginConfig): PluginFactory | ProgramTransformer | undefined {
    let originalRequire: any;
    let requireHooked = false;
    let compilerOptions: tsShim.CompilerOptions | undefined;
    let moduleResolutionCache: tsShim.ModuleResolutionCache | undefined;

    const tsConfig = config.tsConfig && path.resolve(pluginCreator.resolveBaseDir, config.tsConfig);
    const transform = config.transform!;
    const importKey = config.import || 'default';
    const builtFiles = new Map<string, string>();
    const transformerPath = require.resolve(transform, { paths: [ pluginCreator.resolveBaseDir ] });

    /* Prevent circular require */
    // process.stderr.write('PRE: ' + transformerPath + '\n');
    if (requireStack.includes(transformerPath)) return;
    requireStack.push(transformerPath);

    try {
      let isEsm: boolean | undefined = config.isEsm;
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

      hookRequire(isEsm, builtFiles);

      /* Add support for TS transformers */
      if (transform!.match(/\.[mc]?ts$/)) {
        /* Load tsconfig */
        const configFile = tsConfig && tsShim.readConfigFile(tsConfig, tsShim.sys.readFile);
        const parsedConfigFile = configFile && tsShim.parseJsonConfigFileContent(configFile.config, tsShim.sys, path.dirname(tsConfig));
        compilerOptions = parsedConfigFile?.options;
        compilerOptions ??= {};

        /* Set CompilerOptions overrides */
        // TODO - can possibly optimize this later by either ts.transpileModule or doing single file compilation
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

        compilerOptions = tsShim.fixupCompilerOptions(compilerOptions) as tsShim.CompilerOptions;

        moduleResolutionCache = tsShim.createModuleResolutionCache(
          pluginCreator.resolveBaseDir,
          tsShim.sys.realpath ?? (tsShim.sys.useCaseSensitiveFileNames
              ? (x: string) => x
              : (<any>tsShim.sys).getCanonicalFileName
          ),
        );

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

      return factory;
    }
    finally {
      requireStack.pop();
    }

    /* ********************************************************* *
     * Helpers
     * ********************************************************* */

    function requireCustom<T = any>(ctx: any, request: string, onNotFound: (e?: any) => Error): T {
      let res: any;
      try {
        res = originalRequire.call(ctx, request);
      }
      catch (error) {
        if (error.code === 'MODULE_NOT_FOUND') throw onNotFound(error);
        throw error;
      }

      return res;
    }

    function resolveMappedPath(moduleName: string, containingFile: string) {
      const resolved = tsShim.resolveModuleName(
        moduleName,
        containingFile,
        compilerOptions!,
        tsShim.sys,
        moduleResolutionCache
      );

      const res = resolved.resolvedModule?.resolvedFileName || undefined;
      // process.stderr.write(`resolveMappedPath: ${moduleName} -> ${res}\n`);

      return res;
    }

    function hookRequire(isEsm: boolean | undefined, builtFiles: Map<string, string>) {
      const fs = require('fs');
      const os = require('os');
      const Module = require('module');

      originalRequire = Module.prototype.require;
      Module.prototype.require = function (request: string) {
        // process.stderr.write(`require: ${request}\n`);

        /* Handle mapped paths */
        const resolvedPath = compilerOptions?.paths
          && !process.env.TSP_IGNORE_PATH_ALIASES
          && resolveMappedPath(request, this.filename);

        if (resolvedPath) request = resolvedPath;

        /* Resolve file path */
        const filePath = Module._resolveFilename(request, this);
        const extension = path.extname(filePath);

        /* Pass through for unsupported extensions */
        if (!supportedExtensions.includes(extension)) return originalRequire.call(this, request);

        /* Load Code */
        const cacheKey = getCachePath(filePath);
        const isBuiltFile = builtFiles.has(cacheKey);
        const code = isBuiltFile ? builtFiles.get(cacheKey)! : fs.readFileSync(filePath, 'utf8');

        // process.stderr.write(
        //   `require: ${request} -> ${filePath} (${isBuiltFile ? 'built' : 'original'}) \n` +
        //   `isEsm: ${isEsm}\n` +
        //   `code: ${code}\n
        // `);

        /* Write temp file if built */
        let requireFilePath = filePath;
        if (isBuiltFile) {
          /* Write to temp file */
          // Note: We force conversion to .ts to avoid issues with other library's require extensions (like ts-node)
          const extName = extension === '.mts' ? '.ts' : extension;
          let tempFilename = path.join(os.tmpdir(), crypto.randomBytes(16).toString('hex') + extName);

          fs.writeFileSync(tempFilename, code, 'utf8');

          requireFilePath = tempFilename;
        }

        /* Perform Require */
        try {
          return isEsm ? requireEsm.call(this, requireFilePath, filePath) : requireCjs.call(this, requireFilePath);
        } catch (error) {
          if (error.code === 'ERR_REQUIRE_ESM') {
            // process.stderr.write(`cjsFail: ${requireFilePath}\n`);
            return requireEsm.call(this, requireFilePath, filePath);
          } else {
            throw error;
          }
        } finally {
          if (isBuiltFile)
            try { fs.unlinkSync(requireFilePath); }
            catch {}
        }

        function requireCjs(this: any, requireFilePath: string) {
          return originalRequire.call(this, requireFilePath);
        }

        function requireEsm(this: any, requireFilePath: string, filePath: string) {
          // process.stderr.write(`requireEsm: ${requireFilePath}\n`);
          const esm = requireCustom<typeof import('esm')>(this, 'esm', () =>
            new Error(`The transformer "${request}" is an esm file. Add "esm" to your dependencies to enable esm transformers.`)
          );

          /* Setup Module */
          const newModule = new Module(request, this);
          newModule.filename = filePath;
          newModule.paths = Module._nodeModulePaths(filePath);

          /* Load temp file with esm package */
          return esm(newModule)(requireFilePath);
        }
      };

      requireHooked = true;
    }

    function getCachePath(filePath: string) {
      const basedir = path.dirname(filePath);
      const basename = path.basename(filePath, path.extname(filePath));
      return tsShim.normalizePath(path.join(basedir, basename));
    }
  }
}

// endregion
