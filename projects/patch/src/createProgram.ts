/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

namespace tsp {
  const activeProgramTransformers = new Set<string>();
  const { dirname } = require('path');

  /* ********************************************************* *
   * Helpers
   * ********************************************************* */

  function getProjectDir(compilerOptions: tsShim.CompilerOptions) {
    return compilerOptions.configFilePath && dirname(compilerOptions.configFilePath);
  }

  function getProjectConfig(compilerOptions: tsShim.CompilerOptions, rootFileNames: ReadonlyArray<string>) {
    let configFilePath = compilerOptions.configFilePath;
    let projectDir = getProjectDir(compilerOptions);

    if (configFilePath === undefined) {
      const baseDir = (rootFileNames.length > 0) ? dirname(rootFileNames[0]) : projectDir ?? process.cwd();
      configFilePath = tsShim.findConfigFile(baseDir, tsShim.sys.fileExists);

      if (configFilePath) {
        const config = readConfig(configFilePath);
        compilerOptions = { ...config.options, ...compilerOptions };
        projectDir = getProjectDir(compilerOptions);
      }
    }

    return ({ projectDir, compilerOptions });
  }

  function readConfig(configFileNamePath: string) {
    const projectDir = dirname(configFileNamePath);
    const result = tsShim.readConfigFile(configFileNamePath, tsShim.sys.readFile);

    if (result.error) throw new Error('Error in tsconfig.json: ' + result.error.messageText);

    return tsShim.parseJsonConfigFileContent(result.config, tsShim.sys, projectDir, undefined, configFileNamePath);
  }

  function preparePluginsFromCompilerOptions(plugins: any): PluginConfig[] {
    if (!plugins) return [];

    // Old transformers system
    if ((plugins.length === 1) && plugins[0].customTransformers) {
      const { before = [], after = [] } = (plugins[0].customTransformers as { before: string[]; after: string[] });

      return [
        ...before.map((item: string) => ({ transform: item })),
        ...after.map((item: string) => ({ transform: item, after: true })),
      ];
    }

    return plugins;
  }

  /* ********************************************************* *
   * Patched createProgram()
   * ********************************************************* */

  export function createProgram(
    rootNamesOrOptions: ReadonlyArray<string> | tsShim.CreateProgramOptions,
    options?: tsShim.CompilerOptions,
    host?: tsShim.CompilerHost,
    oldProgram?: tsShim.Program,
    configFileParsingDiagnostics?: ReadonlyArray<tsShim.Diagnostic>
  ): tsShim.Program {
    let rootNames;

    /* Determine options */
    const createOpts = !Array.isArray(rootNamesOrOptions) ? <tsShim.CreateProgramOptions>rootNamesOrOptions : void 0;
    if (createOpts) {
      rootNames = createOpts.rootNames;
      options = createOpts.options;
      host = createOpts.host;
      oldProgram = createOpts.oldProgram;
      configFileParsingDiagnostics = createOpts.configFileParsingDiagnostics;
    } else {
      options = options!;
      rootNames = rootNamesOrOptions as ReadonlyArray<string>;
    }

    /* Get Config */
    const projectConfig = getProjectConfig(options, rootNames);
    if ([ 'tsc', 'tsserver', 'tsserverlibrary' ].includes(tsp.currentLibrary)) {
      options = projectConfig.compilerOptions;
      if (createOpts) createOpts.options = options;
    }

    /* Invoke TS createProgram */
    let program: tsShim.Program & { originalEmit?: tsShim.Program['emit'] } =
      createOpts ?
      tsShim.originalCreateProgram(createOpts) :
      tsShim.originalCreateProgram(rootNames, options, host, oldProgram, configFileParsingDiagnostics);

    /* Prepare Plugins */
    const plugins = preparePluginsFromCompilerOptions(options.plugins);
    const pluginCreator = new PluginCreator(plugins, projectConfig.projectDir ?? process.cwd());

    /* Prevent recursion in Program transformers */
    const programTransformers = pluginCreator.getProgramTransformers();

    /* Transform Program */
    for (const [ transformerKey, [ programTransformer, config ] ] of programTransformers) {
      if (activeProgramTransformers.has(transformerKey)) continue;
      activeProgramTransformers.add(transformerKey);

      const newProgram: any = programTransformer(program, host, config, { ts: <any>ts });
      if (typeof newProgram?.['emit'] === 'function') program = newProgram;

      activeProgramTransformers.delete(transformerKey);
    }

    /* Hook emit method */
    if (!program.originalEmit) {
      program.originalEmit = program.emit;
      program.emit = newEmit;
    }

    function newEmit(
      targetSourceFile?: tsShim.SourceFile,
      writeFile?: tsShim.WriteFileCallback,
      cancellationToken?: tsShim.CancellationToken,
      emitOnlyDtsFiles?: boolean,
      customTransformers?: tsShim.CustomTransformers,
      ...additionalArgs: any
    ): tsShim.EmitResult {
      /* Merge in our transformers */
      const transformers = pluginCreator.createTransformers({ program }, customTransformers);

      /* Invoke TS emit */
      const result: tsShim.EmitResult = program.originalEmit!(
        targetSourceFile,
        writeFile,
        cancellationToken,
        emitOnlyDtsFiles,
        transformers,
        // @ts-ignore
        ...additionalArgs
      );

      /* Merge in transformer diagnostics */
      for (const diagnostic of tsp.diagnosticMap.get(program) || [])
        if (!result.diagnostics.includes(diagnostic)) (<tsShim.Diagnostic[]>result.diagnostics).push(diagnostic)

      return result;
    }

    return program;
  }
}
