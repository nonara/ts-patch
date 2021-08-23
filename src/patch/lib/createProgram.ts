/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

import { diagnosticMap } from './shared';
import * as TS from 'typescript';
import { Diagnostic } from 'typescript';
import { PluginCreator } from './plugin';
import { PluginConfig, ProgramTransformer } from '../../installer';
import * as TSPlus from './type-declarations';


/* ****************************************************************************************************************** */
// region: Constants & Ambients
/* ****************************************************************************************************************** */

const activeProgramTransformers = new Set<ProgramTransformer>();
const { dirname } = require('path');

declare const ts: typeof TS & typeof TSPlus;
declare const isTSC: boolean;

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function getProjectDir(compilerOptions: TS.CompilerOptions) {
  return compilerOptions.configFilePath && dirname(compilerOptions.configFilePath);
}

function getProjectConfig(compilerOptions: TS.CompilerOptions, rootFileNames: ReadonlyArray<string>) {
  let configFilePath = compilerOptions.configFilePath;
  let projectDir = getProjectDir(compilerOptions);

  if (configFilePath === undefined) {
    const baseDir = (rootFileNames.length > 0) ? dirname(rootFileNames[0]) : projectDir ?? process.cwd;
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

// endregion


/* ****************************************************************************************************************** */
// region: createProgram - (patched method)
/* ****************************************************************************************************************** */

export function createProgram(
  rootNamesOrOptions: ReadonlyArray<string> | TS.CreateProgramOptions,
  options?: TS.CompilerOptions,
  host?: TS.CompilerHost,
  oldProgram?: TS.Program,
  configFileParsingDiagnostics?: ReadonlyArray<TS.Diagnostic>
): TS.Program {
  let rootNames;

  /* Determine options */
  const createOpts = !Array.isArray(rootNamesOrOptions) ? <TS.CreateProgramOptions>rootNamesOrOptions : void 0;
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
  if (isTSC) {
    options = projectConfig.compilerOptions;
    if (createOpts) createOpts.options = options;
  }

  /* Invoke TS createProgram */
  let program: TS.Program & { originalEmit?: TS.Program['emit'] } =
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
    const newProgram: any = programTransformer(program, host, config, { ts });
    if (typeof newProgram?.['emit'] === 'function') program = newProgram;
  }

  programTransformers.forEach((c, transformer) => activeProgramTransformers.delete(transformer));

  /* Hook emit method */
  if (!program.originalEmit) {
    program.originalEmit = program.emit;
    program.emit = newEmit;
  }

  function newEmit(
    targetSourceFile?: TS.SourceFile,
    writeFile?: TS.WriteFileCallback,
    cancellationToken?: TS.CancellationToken,
    emitOnlyDtsFiles?: boolean,
    customTransformers?: TS.CustomTransformers,
    ...additionalArgs: any
  ): TS.EmitResult {
    /* Merge in our transformers */
    const transformers = pluginCreator.createTransformers({ program }, customTransformers);

    /* Invoke TS emit */
    const result: TS.EmitResult = program.originalEmit!(
      targetSourceFile,
      writeFile,
      cancellationToken,
      emitOnlyDtsFiles,
      transformers,
      // @ts-ignore
      ...additionalArgs
    );

    /* Merge in transformer diagnostics */
    for (const diagnostic of diagnosticMap.get(program) || [])
      if (!result.diagnostics.includes(diagnostic)) (<Diagnostic[]>result.diagnostics).push(diagnostic)

    return result;
  }

  return program;
}

// endregion
