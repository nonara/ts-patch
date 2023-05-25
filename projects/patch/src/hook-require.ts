namespace tsp {
  const path = require('path');
  const crypto = require('crypto');
  let _Module: any;

  let requireConfigs: RequireConfig[] = [];
  let originalRequire: any;
  const resolvePathAliasesOptions = [ 'always', 'never', 'fallback' ];

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  export interface RequireConfig {
    pluginConfig: PluginConfig
    builtFiles: Map<string, string>
    isEsm: boolean
    tsConfig: any
    compilerOptions: tsShim.CompilerOptions | undefined
    moduleResolutionCache: tsShim.ModuleResolutionCache | undefined
  }

  // endregion

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function getNodeJsModule() {
    _Module ??= (originalRequire || require)('module');
    return _Module;
  }

  // endregion

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  export function unhookRequire() {
    requireConfigs.pop();
    if (!requireConfigs.length && originalRequire) {
      getNodeJsModule().prototype.require = originalRequire;
      originalRequire = undefined;
    }
  }

  export function hookRequire(requireConfig: RequireConfig) {
    if (!requireConfig) throw new Error('requireConfig is required');
    requireConfigs.push(requireConfig);

    if (originalRequire) return;

    /* Hook require */
    const fs = require('fs');
    const os = require('os');
    const Module = getNodeJsModule();

    originalRequire = Module.prototype.require;
    Module.prototype.require = function (request: string) {
      const activeRequireConfig = requireConfigs[requireConfigs.length - 1];
      if (!activeRequireConfig) throw new Error('Attempted to use hooked require without active RequireConfig!');

      const { isEsm, builtFiles, compilerOptions, moduleResolutionCache, pluginConfig } = activeRequireConfig;
      const { resolvePathAliases } = pluginConfig;

      // process.stderr.write(`require: ${request}\n`);

      /* Handle mapped paths */
      const resolvedPath =
        pluginConfig.resolvePathAliases !== 'never'
        && compilerOptions?.paths
        && resolveMappedPath(request, this.filename);

      let filePath: string;

      /* Handle resolvePathAliases: always */
      if (resolvedPath && resolvePathAliases === 'always') request = resolvedPath;

      /* Resolve file path */
      try {
        filePath = Module._resolveFilename(request, this);
      } catch (e) {
        if (e.code === 'MODULE_NOT_FOUND' && resolvedPath && resolvePathAliases !== 'always') {
          /* Handle resolvePathAliases: fallback */
          if (pluginConfig.resolvePathAliases === 'fallback') {
            request = resolvedPath;
            filePath = Module._resolveFilename(request, this);
          } else if (!resolvePathAliasesOptions.includes(pluginConfig.resolvePathAliases)) {
            console.warn(
              `There is a typescript path alias entry for "${request}". ` +
              `If you'd like ts-patch to resolve path aliases, you can add "resolvePathAliases": "always" to your plugin config. ` +
              `(see ts-patch documentation for more detail)`
            );
            throw e;
          }
          else throw e;
        }
        else throw e;
      }
      const extension = path.extname(filePath);

      /* Pass through for unsupported extensions */
      if (!supportedExtensions.includes(extension)) return originalRequire.call(this, request);

      if (Module._cache[filePath]) {
        return Module._cache[filePath].exports;
      }

      /* Load Code */
      const cacheKey = getCachePath(filePath);
      const isBuiltFile = builtFiles.has(cacheKey);
      const code = isBuiltFile ? builtFiles.get(cacheKey)! : fs.readFileSync(filePath, 'utf8');

      // process.stderr.write(
      //   `require: ${request} -> ${filePath} (${isBuiltFile ? 'built' : 'original'}) \n` +
      //   `isEsm: ${isEsm}\n` +
      //   `code: ${code}\n
      // `);

      /* Perform Require */
      try {
        return isEsm ? requireEsm.call(this) : requireCjs.call(this);
      } catch (error) {
        if (error.code === 'ERR_REQUIRE_ESM') {
          // process.stderr.write(`cjsFail: ${requireFilePath}\n`);
          return requireEsm.call(this);
        } else {
          throw error;
        }
      }

      function requireCjs(this: any) {
        /* Setup Module */
        const newModule = new Module(request, this);
        newModule.filename = filePath;
        newModule.paths = Module._nodeModulePaths(filePath);

        /* Add to cache */
        Module._cache[filePath] = newModule;

        /* Compile */
        newModule._compile(code, filePath);

        return newModule.exports;
      }

      function requireEsm(this: any) {
        // process.stderr.write(`requireEsm: ${requireFilePath}\n`);
        const esm = requireCustom<typeof import('esm')>(this, 'esm', () =>
          new Error(`The transformer "${request}" is an esm file. Add "esm" to your dependencies to enable esm transformers.`)
        );

        /* Write temp file */
        let tempFilePath = filePath;
        if (isBuiltFile) {
          /* Write to temp file */
          // Note: We force conversion to .ts to avoid issues with other library's require extensions (like ts-node)
          const extName = extension === '.mts' ? '.ts' : extension;
          tempFilePath = path.join(os.tmpdir(), crypto.randomBytes(16).toString('hex') + extName);

          fs.writeFileSync(tempFilePath, code, 'utf8');
        }

        try {
          /* Setup Module */
          const newModule = new Module(request, this);
          newModule.filename = filePath;
          newModule.paths = Module._nodeModulePaths(filePath);

          /* Add to cache */
          Module._cache[filePath] = newModule;

          /* Compile */
          const res = esm(newModule)(tempFilePath);
          newModule.filename = filePath;

          return res;
        } finally {
          if (tempFilePath)
            try { fs.unlinkSync(tempFilePath); }
            catch {}
        }
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
    };

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
  }

  // endregion
}
