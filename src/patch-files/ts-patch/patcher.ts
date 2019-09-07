import { dirname } from 'path';
import { PluginConfig, PluginCreator } from './PluginCreator';
import { Diagnostic } from 'typescript/lib/tsserverlibrary';
import * as ts from 'typescript/lib/typescript';

const tspVersion = ``;

/* ********************************************************************************************************************
 * Types
 * ********************************************************************************************************************/
// region Types

// @ts-ignore
declare module 'typescript' {
  interface CreateProgramOptions {
    rootNames: ReadonlyArray<string>;
    options: ts.CompilerOptions;
    projectReferences?: ReadonlyArray<ts.ProjectReference>;
    host?: ts.CompilerHost;
    oldProgram?: ts.Program;
    configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>;
  }

  interface ProjectReference {
    path: string;
    originalPath?: string;
    prepend?: boolean;
    circular?: boolean;
  }
}

// endregion


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

function getConfig(
  tsm: typeof ts, compilerOptions: ts.CompilerOptions, rootFileNames: ReadonlyArray<string>, defaultDir: string
) {
  if (compilerOptions.configFilePath === undefined) {
    const dir = (rootFileNames.length > 0) ? dirname(rootFileNames[0]) : defaultDir;

    const tsconfigPath = tsm.findConfigFile(dir, tsm.sys.fileExists);
    if (tsconfigPath) {
      const projectDir = dirname(tsconfigPath);

      const config = readConfig(tsm, tsconfigPath, dirname(tsconfigPath));
      compilerOptions = { ...config.options, ...compilerOptions };

      return ({ projectDir, compilerOptions });
    }
  }

  return ({ projectDir: dirname(compilerOptions.configFilePath as string), compilerOptions });
}

function readConfig(tsm: typeof ts, configFileNamePath: string, projectDir: string) {
  const result = tsm.readConfigFile(configFileNamePath, tsm.sys.readFile);

  if (result.error) throw new Error('Error in tsconfig.json: ' + result.error.messageText);

  return tsm.parseJsonConfigFileContent(result.config, tsm.sys, projectDir, undefined, configFileNamePath);
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
 * Patch
 * ********************************************************************************************************************/
// region Patch

export const TS_PATCH = Symbol('TS Patch applied');

export const transformerErrors = new WeakMap<ts.Program, Diagnostic[]>();

export function addDiagnosticFactory(program: ts.Program) {
  return (diag: ts.Diagnostic) => {
    const arr = transformerErrors.get(program) || [];
    arr.push(diag);
    transformerErrors.set(program, arr);
  };
}

/**
 * Patches createProgram on TypeScript module
 * @param tsm - Module to patch
 * @param forceReadConfig - Force Read Config?
 * @param projectDir - Base directory
 */
export function patchCreateProgram(tsm: typeof ts, forceReadConfig = false, projectDir = process.cwd()) {
  /* Don't patch if already patched */
  if ((tsm as any).ts_patch) return tsm;

  const originalCreateProgram = <any>tsm.createProgram;

  /* New createProgram method */
  function createProgram(createProgramOptions: ts.CreateProgramOptions): ts.Program;
  function createProgram(
    rootNames: ReadonlyArray<string>,
    options: ts.CompilerOptions,
    host?: ts.CompilerHost,
    oldProgram?: ts.Program,
    configFileParsingDiagnostics?: ReadonlyArray<ts.Diagnostic>
  ): ts.Program;
  function createProgram(
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
    if (forceReadConfig) {
      const info = getConfig(tsm, options, rootNames, projectDir);
      options = info.compilerOptions;

      if (createOpts) createOpts.options = options;

      projectDir = info.projectDir;
    }

    /* Invoke TS createProgram */
    const program: ts.Program = createOpts ?
      originalCreateProgram(createOpts) :
      originalCreateProgram(rootNames, options, host, oldProgram, configFileParsingDiagnostics);

    /* Prepare Plugins */
    const plugins = preparePluginsFromCompilerOptions(options.plugins);
    const pluginCreator = new PluginCreator(tsm, plugins, projectDir);

    /* Hook TypeScript emit method */
    const originalEmit = program.emit;
    program.emit = function newEmit(
      targetSourceFile?: ts.SourceFile,
      writeFile?: ts.WriteFileCallback,
      cancellationToken?: ts.CancellationToken,
      emitOnlyDtsFiles?: boolean,
      customTransformers?: ts.CustomTransformers
    ): ts.EmitResult {
      /* Merge in our tranformers */
      const mergedTransformers = pluginCreator.createTransformers({ program }, customTransformers);

      /* Invoke TS emit */
      const result: ts.EmitResult = originalEmit(
        targetSourceFile,
        writeFile,
        cancellationToken,
        emitOnlyDtsFiles,
        mergedTransformers
      );

      result.diagnostics = [...result.diagnostics, ...transformerErrors.get(program)!];
      return result;
    };

    return program;
  }

  /* Return patched TypeScript Module */
  tsm.createProgram = createProgram;

  /* Add patch version */
  (tsm as any).ts_patch = tspVersion;

  return tsm;
}

// endregion