/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

namespace tsp {
  const activeProgramTransformers = new Set<ProgramTransformer>();
  const { dirname } = require('path');

  /* ********************************************************* *
   * Helpers
   * ********************************************************* */

  function getProjectDir(compilerOptions: ts.CompilerOptions) {
    return compilerOptions.configFilePath && dirname(compilerOptions.configFilePath);
  }

  function getProjectConfig(compilerOptions: ts.CompilerOptions, rootFileNames: ReadonlyArray<string>) {
    let configFilePath = compilerOptions.configFilePath;
    let projectDir = getProjectDir(compilerOptions);

    if (configFilePath === undefined) {
      const baseDir = (rootFileNames.length > 0) ? dirname(rootFileNames[0]) : projectDir ?? process.cwd();
      configFilePath = ts.findConfigFile(baseDir, ts.sys.fileExists);

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
    const result = ts.readConfigFile(configFileNamePath, ts.sys.readFile);

    if (result.error) throw new Error('Error in tsconfig.json: ' + result.error.messageText);

    return ts.parseJsonConfigFileContent(result.config, ts.sys, projectDir, undefined, configFileNamePath);
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
    rootNamesOrOptions: ReadonlyArray<string> | ts.CreateProgramOptions,
    options?: ts.CompilerOptions,
    host?: ts.CompilerHost,
    oldProgram?: ts.Program,
    configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>
  ): ts.Program {
    let rootNames;

    /* Determine options */
    const createOpts = !Array.isArray(rootNamesOrOptions) ? <ts.CreateProgramOptions>rootNamesOrOptions : void 0;
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
    if (tsp.isTSC) {
      options = projectConfig.compilerOptions;
      if (createOpts) createOpts.options = options;
    }

    /* Invoke TS createProgram */
    let program: ts.Program & { originalEmit?: ts.Program['emit'] } =
      createOpts ?
      ts.originalCreateProgram(createOpts) :
      ts.originalCreateProgram(rootNames, options, host, oldProgram, configFileParsingDiagnostics);

    /* Prepare Plugins */
    const plugins = preparePluginsFromCompilerOptions(options.plugins);
    const pluginCreator = new PluginCreator(plugins, projectConfig.projectDir ?? process.cwd());

    /* Prevent recursion in Program transformers */
    const programTransformers = new Map(pluginCreator.getProgramTransformers());
    for (const [ transformer ] of pluginCreator.getProgramTransformers()) {
      if (activeProgramTransformers.has(transformer)) programTransformers.delete(transformer);
      else activeProgramTransformers.add(transformer);
    }

    /* Transform Program */
    for (const [ programTransformer, config ] of programTransformers) {
      const newProgram: any = programTransformer(program, host, config, { ts: <any>ts });
      if (typeof newProgram?.['emit'] === 'function') program = newProgram;
    }

    programTransformers.forEach((c, transformer) => activeProgramTransformers.delete(transformer));

    /* Hook emit method */
    if (!program.originalEmit) {
      program.originalEmit = program.emit;
      program.emit = newEmit;
    }

    function newEmit(
      targetSourceFile?: ts.SourceFile,
      writeFile?: ts.WriteFileCallback,
      cancellationToken?: ts.CancellationToken,
      emitOnlyDtsFiles?: boolean,
      customTransformers?: ts.CustomTransformers,
      ...additionalArgs: any
    ): ts.EmitResult {
      /* Merge in our transformers */
      const transformers = pluginCreator.createTransformers({ program }, customTransformers);

      /* Invoke TS emit */
      const result: ts.EmitResult = program.originalEmit!(
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
        if (!result.diagnostics.includes(diagnostic)) (<ts.Diagnostic[]>result.diagnostics).push(diagnostic)

      return result;
    }

    return program;
  }
}
