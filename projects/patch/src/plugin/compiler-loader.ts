namespace tsp {
  const fs = require('fs');
  const path = require('path');
  const url = require('url');
  const moduleApi = require('module');

  interface CompiledTransformer {
    format: TsFileFormat;
    source: string;
  }

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function isTypeScriptPath(filePath: string) {
    return tsExtensions.includes(path.extname(filePath));
  }

  function isBuiltinModule(specifier: string) {
    const builtinModules = moduleApi.builtinModules as string[] | undefined;
    const normalized = specifier.replace(/^node:/, '');
    return builtinModules?.includes(specifier) || builtinModules?.includes(normalized);
  }

  function getParentDir(parentURL: string | undefined) {
    if (!parentURL) return process.cwd();
    if (!parentURL.startsWith('file:')) return process.cwd();
    return path.dirname(url.fileURLToPath(parentURL));
  }

  function maybeFileURLToPath(specifier: string) {
    return specifier.startsWith('file:') ? url.fileURLToPath(specifier) : undefined;
  }

  function tryFile(filePath: string): string | undefined {
    try {
      const stat = fs.statSync(filePath);
      return stat.isFile() ? filePath : undefined;
    } catch {
      return undefined;
    }
  }

  function resolveTypeScriptFile(basePath: string): string | undefined {
    const ext = path.extname(basePath);

    if (tsExtensions.includes(ext)) return tryFile(basePath);

    const extensionReplacements: Record<string, string[]> = {
      '.js': [ '.ts' ],
      '.mjs': [ '.mts' ],
      '.cjs': [ '.cts' ]
    };

    for (const replacementExt of extensionReplacements[ext] || []) {
      const candidate = basePath.slice(0, -ext.length) + replacementExt;
      const res = tryFile(candidate);
      if (res) return res;
    }

    if (!ext) {
      for (const candidateExt of tsExtensions) {
        const res = tryFile(basePath + candidateExt);
        if (res) return res;
      }

      for (const candidateExt of tsExtensions) {
        const res = tryFile(path.join(basePath, 'index' + candidateExt));
        if (res) return res;
      }
    }

    return undefined;
  }

  function getTypeScriptModulePath(specifier: string, parentURL: string | undefined, registerConfig: RegisterConfig): string | undefined {
    if (isBuiltinModule(specifier)) return undefined;

    const fileURLPath = maybeFileURLToPath(specifier);
    if (fileURLPath) return resolveTypeScriptFile(fileURLPath);

    if (path.isAbsolute(specifier)) return resolveTypeScriptFile(specifier);

    if (specifier.startsWith('.')) {
      return resolveTypeScriptFile(path.resolve(getParentDir(parentURL), specifier));
    }

    const { compilerOptions, pluginConfig } = registerConfig;
    if (pluginConfig.resolvePathAliases && compilerOptions?.baseUrl && compilerOptions.paths) {
      const matchPath = getTsConfigPaths().createMatchPath(
        compilerOptions.baseUrl,
        compilerOptions.paths
      );

      const matchedPath = matchPath(
        specifier,
        undefined,
        fs.existsSync,
        supportedExtensions
      );

      if (matchedPath) return resolveTypeScriptFile(matchedPath);
    }

    return undefined;
  }

  function getCompilerOptions(registerConfig: RegisterConfig): tsShim.CompilerOptions {
    const baseOptions = registerConfig.compilerOptions || {};

    const compilerOptions: tsShim.CompilerOptions = {
      ...baseOptions,
      target: baseOptions.target ?? tsShim.ScriptTarget.ES2022,
      jsx: baseOptions.jsx ?? tsShim.JsxEmit.React,
      esModuleInterop: baseOptions.esModuleInterop ?? true,
      module: baseOptions.module ?? tsShim.ModuleKind.NodeNext,
      sourceMap: true,
      inlineSourceMap: false,
      inlineSources: true,
      declaration: false,
      declarationMap: false,
      emitDeclarationOnly: false,
      noEmit: false,
      outDir: undefined,
      outFile: undefined,
      composite: undefined,
      declarationDir: undefined
    };

    if (baseOptions.module === undefined) {
      compilerOptions.moduleResolution = baseOptions.moduleResolution ?? tsShim.ModuleResolutionKind.NodeNext;
    } else if (baseOptions.moduleResolution !== undefined) {
      compilerOptions.moduleResolution = baseOptions.moduleResolution;
    }

    return compilerOptions;
  }

  function getTranspileCompilerOptions(format: TsFileFormat, compilerOptions: tsShim.CompilerOptions): tsShim.CompilerOptions {
    // transpileModule does not receive Program package-scope metadata, so normalize
    // emit to the already-classified runtime format.
    const transpileOptions: tsShim.CompilerOptions = {
      ...compilerOptions,
      module: format === 'module' ? tsShim.ModuleKind.ESNext : tsShim.ModuleKind.CommonJS
    };

    delete transpileOptions.moduleResolution;
    return transpileOptions;
  }

  function formatDiagnostics(diagnostics: readonly tsShim.Diagnostic[]) {
    const diagnosticHost = {
      getCurrentDirectory: () => process.cwd(),
      getCanonicalFileName: (fileName: string) => fileName,
      getNewLine: () => tsShim.sys.newLine
    };

    const formatter = tsShim.formatDiagnosticsWithColorAndContext || tsShim.formatDiagnostics;
    return formatter(diagnostics, diagnosticHost);
  }

  function getTranspileDiagnostics(diagnostics: readonly tsShim.Diagnostic[] | undefined) {
    const ignoredDiagnostics = new Set([ 6059, 18002, 18003 ]);
    return (diagnostics || []).filter(diagnostic => !ignoredDiagnostics.has(diagnostic.code));
  }

  function inlineSourceMap(outputText: string, sourceMapText: string | undefined) {
    if (!sourceMapText) return outputText;

    const sourceMapComment = `//# sourceMappingURL=data:application/json;charset=utf-8;base64,${Buffer.from(sourceMapText, 'utf8').toString('base64')}`;
    const outputWithoutSourceMap = outputText.replace(/\r?\n?\/\/# sourceMappingURL=.*(?:\r?\n)?$/, '');

    return `${outputWithoutSourceMap}\n${sourceMapComment}`;
  }

  function compileTransformer(filePath: string, registerConfig: RegisterConfig): CompiledTransformer {
    const sourceText = fs.readFileSync(filePath, 'utf8');
    const compilerOptions = getCompilerOptions(registerConfig);
    const format = getEmitFormat(filePath, sourceText, compilerOptions);

    if (format === 'unsupported') {
      const moduleKind = compilerOptions.module === undefined ? 'undefined' : tsShim.ModuleKind[compilerOptions.module];
      throw new TsPatchError(
        `Transformer "${filePath}" uses tsConfig "module" setting "${moduleKind}", which is not loadable in Node. ` +
        `Use CommonJS, ES2015 or later, ESNext, Node16, NodeNext, or a module-specific extension such as ".cts" or ".mts".`
      );
    }

    const result = tsShim.transpileModule(sourceText, {
      compilerOptions: getTranspileCompilerOptions(format, compilerOptions),
      fileName: filePath,
      reportDiagnostics: true
    });

    const diagnostics = getTranspileDiagnostics(result.diagnostics);
    if (diagnostics.length) {
      throw new TsPatchError(
        `Unable to compile TypeScript transformer "${filePath}":\n` + formatDiagnostics(diagnostics)
      );
    }

    return {
      format,
      source: inlineSourceMap(result.outputText, result.sourceMapText)
    };
  }

  // endregion

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  export function registerCompilerLoader(registerConfig: RegisterConfig): () => void {
    if (typeof moduleApi.registerHooks !== 'function') {
      throw new TsPatchError('TypeScript transformer loading requires Node.js >=22.15.0 with module.registerHooks().');
    }

    const compiledFiles = new Map<string, CompiledTransformer>();

    const hooks = moduleApi.registerHooks({
      resolve(specifier: string, context: any, nextResolve: Function) {
        const parentURL = context?.parentURL as string | undefined;

        const explicitTsPath = getTypeScriptModulePath(specifier, parentURL, registerConfig);
        if (explicitTsPath) {
          return {
            url: url.pathToFileURL(explicitTsPath).href,
            shortCircuit: true
          };
        }

        try {
          const resolved = nextResolve(specifier, context);
          if (resolved?.url?.startsWith('file:')) {
            const resolvedPath = url.fileURLToPath(resolved.url);
            if (isTypeScriptPath(resolvedPath)) {
              return {
                url: resolved.url,
                shortCircuit: true
              };
            }
          }
          return resolved;
        } catch (e) {
          const fallbackPath = getTypeScriptModulePath(specifier, parentURL, registerConfig);
          if (fallbackPath) {
            return {
              url: url.pathToFileURL(fallbackPath).href,
              shortCircuit: true
            };
          }
          throw e;
        }
      },

      load(fileURL: string, context: any, nextLoad: Function) {
        if (!fileURL.startsWith('file:')) return nextLoad(fileURL, context);

        const filePath = url.fileURLToPath(fileURL);
        if (!isTypeScriptPath(filePath)) return nextLoad(fileURL, context);

        let compiledFile = compiledFiles.get(filePath);
        if (!compiledFile) {
          compiledFile = compileTransformer(filePath, registerConfig);
          compiledFiles.set(filePath, compiledFile);
        }

        return {
          format: compiledFile.format,
          source: compiledFile.source,
          shortCircuit: true
        };
      }
    });

    return () => {
      compiledFiles.clear();
      hooks.deregister();
    };
  }

  // endregion
}
