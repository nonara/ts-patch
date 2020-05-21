/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

import { diagnosticMap } from './diagnostics';
import * as TS from 'typescript';
import * as TSPlus from './types';
import { PluginConfig, PluginCreator } from './plugin';
import { Diagnostic } from 'typescript';


/* ********************************************************************************************************************
 * Declarations
 * ********************************************************************************************************************/

declare const ts: typeof TS & typeof TSPlus;
declare const isTSC: boolean;


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

const { dirname } = require('path');

function getConfig(
  compilerOptions: TS.CompilerOptions, rootFileNames: ReadonlyArray<string>, defaultDir: string
) {
  if (compilerOptions.configFilePath === undefined) {
    const dir = (rootFileNames.length > 0) ? dirname(rootFileNames[0]) : defaultDir;

    const tsconfigPath = ts.findConfigFile(dir, ts.sys.fileExists);
    if (tsconfigPath) {
      const projectDir = dirname(tsconfigPath);

      const config = readConfig(tsconfigPath, dirname(tsconfigPath));
      compilerOptions = { ...config.options, ...compilerOptions };

      return ({ projectDir, compilerOptions });
    }
  }

  return ({ projectDir: dirname(compilerOptions.configFilePath as string), compilerOptions });
}

function readConfig(configFileNamePath: string, projectDir: string) {
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


/* ********************************************************************************************************************
 * createProgram (patched method)
 * ********************************************************************************************************************/

export function createProgram(
  rootNamesOrOptions: ReadonlyArray<string> | TS.CreateProgramOptions,
  options?: TS.CompilerOptions,
  host?: TS.CompilerHost,
  oldProgram?: TS.Program,
  configFileParsingDiagnostics?: ReadonlyArray<TS.Diagnostic>
): TS.Program {
  let rootNames;
  let projectDir = process.cwd();

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
  if (isTSC) {
    const info = getConfig(options, rootNames, projectDir);
    options = info.compilerOptions;

    if (createOpts) createOpts.options = options;

    projectDir = info.projectDir;
  }

  /* Invoke TS createProgram */
  let program: TS.Program = createOpts ?
    ts.originalCreateProgram(createOpts) :
    ts.originalCreateProgram(rootNames, options, host, oldProgram, configFileParsingDiagnostics);

  /* Prepare Plugins */
  const plugins = preparePluginsFromCompilerOptions(options.plugins);
  const pluginCreator = new PluginCreator(plugins, projectDir);

  /* Transform Program */
  for (const [ programTransformer, config ] of pluginCreator.getProgramTransformers()) {
    const newProgram:TS.Program | undefined = programTransformer(program, host, config);
    if (typeof newProgram?.['emit'] === 'function') program = newProgram;
  }

  /* Hook TypeScript emit method */
  const originalEmit = program.emit;

  program.emit = function newEmit(
    targetSourceFile?: TS.SourceFile,
    writeFile?: TS.WriteFileCallback,
    cancellationToken?: TS.CancellationToken,
    emitOnlyDtsFiles?: boolean,
    customTransformers?: TS.CustomTransformers
  ): TS.EmitResult {
    /* Merge in our transformers */
    const transformers = pluginCreator.createTransformers({ program }, customTransformers);

    /* Invoke TS emit */
    const result: TS.EmitResult = originalEmit(
      targetSourceFile,
      writeFile,
      cancellationToken,
      emitOnlyDtsFiles,
      transformers
    );

    /* Merge in transformer diagnostics */
    for (const diagnostic of diagnosticMap.get(program) || [])
      if (!result.diagnostics.includes(diagnostic)) (<Diagnostic[]>result.diagnostics).push(diagnostic)

    return result;
  };

  return program;
}
