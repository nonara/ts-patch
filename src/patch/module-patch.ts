/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

import { Diagnostic } from 'typescript';
import * as TS from 'typescript';


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/
// region Constants

const transformerErrors = new WeakMap<TS.Program, Diagnostic[]>();

const { dirname } = require('path');

/* Declarations (implemented post-patch process) */
declare const ts: typeof TS;
declare const isTSC: boolean;
declare const tsPatch: {
  originalCreateProgram: typeof createProgram,
  createProgram: typeof createProgram
};

// endregion


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

function addDiagnosticFactory(program: TS.Program) {
  return (diag: TS.Diagnostic) => {
    const arr = transformerErrors.get(program) || [];
    arr.push(diag);
    transformerErrors.set(program, arr);
  };
}

function never(n: never): never { throw new Error('Unexpected type: ' + n); }

// endregion


/* ********************************************************************************************************************
 * createProgram
 * ********************************************************************************************************************/

function createProgram(
  rootNamesOrOptions: ReadonlyArray<string> | TS.CreateProgramOptions,
  options?: TS.CompilerOptions,
  host?: TS.CompilerHost,
  oldProgram?: TS.Program,
  configFileParsingDiagnostics?: ReadonlyArray<TS.Diagnostic>
): TS.Program {

  /* ***********************************************************
   * Helpers
   * ***********************************************************/
  // region Helpers

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

  /* ***********************************************************
   * Logic
   * ***********************************************************/
  // region Logic

  return (function run() {
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
    const program: TS.Program = createOpts ?
      tsPatch.originalCreateProgram(createOpts) :
      tsPatch.originalCreateProgram(rootNames, options, host, oldProgram, configFileParsingDiagnostics);

    /* Prepare Plugins */
    const plugins = preparePluginsFromCompilerOptions(options.plugins);
    const pluginCreator = new PluginCreator(plugins, projectDir);

    /* Hook TypeScript emit method */
    const originalEmit = program.emit;
    program.emit = function newEmit(
      targetSourceFile?: TS.SourceFile,
      writeFile?: TS.WriteFileCallback,
      cancellationToken?: TS.CancellationToken,
      emitOnlyDtsFiles?: boolean,
      customTransformers?: TS.CustomTransformers
    ): TS.EmitResult {
      /* Merge in our tranformers */
      const mergedTransformers = pluginCreator.createTransformers({ program }, customTransformers);

      /* Invoke TS emit */
      const result: TS.EmitResult = originalEmit(
        targetSourceFile,
        writeFile,
        cancellationToken,
        emitOnlyDtsFiles,
        mergedTransformers
      );

      result.diagnostics.concat(transformerErrors.get(program) || []);
      return result;
    };

    return program;
  })();

  // endregion
}


/* ********************************************************************************************************************
 * Plugin
 * ********************************************************************************************************************/
// region Plugin

let tsNodeIncluded = false;
const requireStack: string[] = [];

/* ***********************************************************
 * Types
 * ***********************************************************/
// region Types

export interface PluginConfig {
  /**
   * Language Server TypeScript Plugin name
   */
  name?: string;
  /**
   * Path to transformer or transformer module name
   */
  transform?: string;

  /**
   * The optional name of the exported transform plugin in the transform module.
   */
  import?: string;

  /**
   * Plugin entry point format type, default is program
   */
  type?: 'ls' | 'program' | 'config' | 'checker' | 'raw' | 'compilerOptions';

  /**
   * Should transformer applied after all ones
   */
  after?: boolean;

  /**
   * Should transformer applied for d.ts files, supports from TS2.9
   */
  afterDeclarations?: boolean;
}

export interface TransformerBasePlugin {
  before?: TS.TransformerFactory<TS.SourceFile>;
  after?: TS.TransformerFactory<TS.SourceFile>;
  afterDeclarations?: TS.TransformerFactory<TS.SourceFile | TS.Bundle>;
}

export type TransformerList = Required<TS.CustomTransformers>;

export type TransformerPlugin = TransformerBasePlugin | TS.TransformerFactory<TS.SourceFile>;

export type LSPattern = (ls: TS.LanguageService, config: {}) => TransformerPlugin;

export type ProgramPattern = (
  program: TS.Program,
  config: {},
  helpers?: { ts: typeof TS; addDiagnostic: (diag: TS.Diagnostic) => void }
) => TransformerPlugin;

export type CompilerOptionsPattern = (compilerOpts: TS.CompilerOptions, config: {}) => TransformerPlugin;

export type ConfigPattern = (config: {}) => TransformerPlugin;

export type TypeCheckerPattern = (checker: TS.TypeChecker, config: {}) => TransformerPlugin;

export type RawPattern = (
  context: TS.TransformationContext,
  program: TS.Program,
  config: {}
) => TS.Transformer<TS.SourceFile>;

export type PluginFactory =
  | LSPattern
  | ProgramPattern
  | ConfigPattern
  | CompilerOptionsPattern
  | TypeCheckerPattern
  | RawPattern;

// endregion


/* ***********************************************************
 * PluginCreator
 * ***********************************************************/

/**
 * @example
 *
 * new PluginCreator([
 *   {transform: '@zerollup/ts-transform-paths', someOption: '123'},
 *   {transform: '@zerollup/ts-transform-paths', type: 'ls', someOption: '123'},
 *   {transform: '@zerollup/ts-transform-paths', type: 'ls', after: true, someOption: '123'}
 * ]).createTransformers({ program })
 */
class PluginCreator {
  constructor(
    private configs: PluginConfig[],
    private resolveBaseDir: string = process.cwd()
  ) {
    PluginCreator.validateConfigs(configs);
  }

  public mergeTransformers(into: TransformerList, source: TS.CustomTransformers | TransformerBasePlugin) {
    const slice = <T>(input: T | T[]) => (Array.isArray(input) ? input.slice() : [input]);

    if (source.before) into.before.push(...slice(source.before));
    if (source.after) into.after.push(...slice(source.after));
    if (source.afterDeclarations) into.afterDeclarations.push(...slice(source.afterDeclarations));

    return this;
  }

  public createTransformers(
    params: { program: TS.Program } | { ls: TS.LanguageService },
    customTransformers?: TS.CustomTransformers
  ) {
    const chain: TransformerList = { before: [], after: [], afterDeclarations: [] };

    const [ls, program] = ('ls' in params) ? [params.ls, params.ls.getProgram()!] : [void 0, params.program];

    for (const config of this.configs) {
      if (!config.transform) continue;
      const factory = this.resolveFactory(config.transform, config.import);

      // In case of recursion
      if (factory === undefined) continue;

      const transformer = PluginCreator.createTransformerFromPattern({ factory, config, program, ls });
      this.mergeTransformers(chain, transformer);
    }

    // Chain custom transformers at the end
    if (customTransformers) this.mergeTransformers(chain, customTransformers);

    return chain;
  }

  /* ***********************************************************
   * Helpers
   * ***********************************************************/

  private resolveFactory(transform: string, importKey: string = 'default'): PluginFactory | undefined {
    /* Look for ts-node */
    if (
      !tsNodeIncluded &&
      transform.match(/\.ts$/) &&
      (module.parent!.parent === null ||
        module.parent!.parent!.parent === null ||
        module.parent!.parent!.parent!.id.split(/[\/\\]/).indexOf('ts-node') === -1)
    ) {
      require('ts-node').register({
        transpileOnly: true,
        skipProject: true,
        compilerOptions: {
          target: 'es5',
          module: 'commonjs',
        },
      });
      tsNodeIncluded = true;
    }

    const modulePath = require('resolve').sync(transform, { basedir: this.resolveBaseDir });

    /* Prevent recursive requiring of createTransformers (issue with ts-node) */
    if (requireStack.indexOf(modulePath) > -1) return;

    requireStack.push(modulePath);
    const commonjsModule: PluginFactory | { [key: string]: PluginFactory } = require(modulePath);
    requireStack.pop();

    const factoryModule = (typeof commonjsModule === 'function') ? { default: commonjsModule } : commonjsModule;

    const factory = factoryModule[importKey];
    if (!factory)
      throw new Error(
        `tsconfig.json > plugins: "${transform}" does not have an export "${importKey}": ` +
        require("util").inspect(factoryModule)
      );

    if (typeof factory !== 'function') {
      throw new Error(
        `tsconfig.json > plugins: "${transform}" export "${importKey}" is not a plugin: ` +
        require("util").inspect(factory)
      );
    }

    return factory;
  }

  static validateConfigs(configs: PluginConfig[]) {
    for (const config of configs)
      if (!config.name && !config.transform) throw new Error('tsconfig.json plugins error: transform must be present');
  }

  static createTransformerFromPattern({ factory, config, program, ls }: {
    factory: PluginFactory;
    config: PluginConfig;
    program: TS.Program;
    ls?: TS.LanguageService;
  }):
    TransformerBasePlugin {
    const { transform, after, afterDeclarations, name, type, ...cleanConfig } = config;

    if (!transform) throw new Error('Not a valid config entry: "transform" key not found');

    let ret: TransformerPlugin;
    switch (config.type) {
      case 'ls':
        if (!ls) throw new Error(`Plugin ${transform} need a LanguageService`);
        ret = (factory as LSPattern)(ls, cleanConfig);
        break;

      case 'config':
        ret = (factory as ConfigPattern)(cleanConfig);
        break;

      case 'compilerOptions':
        ret = (factory as CompilerOptionsPattern)(program.getCompilerOptions(), cleanConfig);
        break;

      case 'checker':
        ret = (factory as TypeCheckerPattern)(program.getTypeChecker(), cleanConfig);
        break;

      case undefined:
      case 'program':
        ret = (factory as ProgramPattern)(program, cleanConfig, {
          ts,
          addDiagnostic: addDiagnosticFactory(program),
        });
        break;

      case 'raw':
        ret = (ctx: TS.TransformationContext) => (factory as RawPattern)(ctx, program, cleanConfig);
        break;

      default:
        return never(config.type);
    }

    if (typeof ret === 'function')
      return after ? ({ after: ret }) :
        afterDeclarations ? ({ afterDeclarations: ret as TS.TransformerFactory<TS.SourceFile | TS.Bundle> }) :
          { before: ret };

    return ret;
  }
}

// endregion


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/
// region Exports

tsPatch.createProgram = createProgram;

// endregion