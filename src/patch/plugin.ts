/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

import { never } from './shared';
import { addDiagnosticFactory } from './shared';
import {
  TransformerFactory, SourceFile, Bundle, CustomTransformers, LanguageService, Program, Diagnostic, CompilerOptions,
  TypeChecker, TransformationContext, Transformer, default as TS
} from 'typescript';

declare const ts: typeof TS & { originalCreateProgram: typeof TS.createProgram };


/* ********************************************************************************************************************
 * Types
 * ********************************************************************************************************************/
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
  before?: TransformerFactory<SourceFile>;
  after?: TransformerFactory<SourceFile>;
  afterDeclarations?: TransformerFactory<SourceFile | Bundle>;
}

export type TransformerList = Required<CustomTransformers>;

export type TransformerPlugin = TransformerBasePlugin | TransformerFactory<SourceFile>;

export type LSPattern = (ls: LanguageService, config: {}) => TransformerPlugin;

export type ProgramPattern = (
  program: Program,
  config: {},
  helpers?: { ts: typeof ts; addDiagnostic: (diag: Diagnostic) => void }
) => TransformerPlugin;

export type CompilerOptionsPattern = (compilerOpts: CompilerOptions, config: {}) => TransformerPlugin;

export type ConfigPattern = (config: {}) => TransformerPlugin;

export type TypeCheckerPattern = (checker: TypeChecker, config: {}) => TransformerPlugin;

export type RawPattern = (
  context: TransformationContext,
  program: Program,
  config: {}
) => Transformer<SourceFile>;

export type PluginFactory =
  | LSPattern
  | ProgramPattern
  | ConfigPattern
  | CompilerOptionsPattern
  | TypeCheckerPattern
  | RawPattern;

// endregion


/* ********************************************************************************************************************
 * PluginCreator
 * ********************************************************************************************************************/
// region PluginCreator

let tsNodeIncluded = false;
const requireStack: string[] = [];

/**
 * @example
 *
 * new PluginCreator([
 *   {transform: '@zerollup/ts-transform-paths', someOption: '123'},
 *   {transform: '@zerollup/ts-transform-paths', type: 'ls', someOption: '123'},
 *   {transform: '@zerollup/ts-transform-paths', type: 'ls', after: true, someOption: '123'}
 * ]).createTransformers({ program })
 */
export class PluginCreator {
  constructor(
    private configs: PluginConfig[],
    private resolveBaseDir: string = process.cwd()
  ) {
    PluginCreator.validateConfigs(configs);
  }

  public mergeTransformers(into: TransformerList, source: CustomTransformers | TransformerBasePlugin) {
    const slice = <T>(input: T | T[]) => (Array.isArray(input) ? input.slice() : [input]);

    if (source.before) into.before.push(...slice(source.before));
    if (source.after) into.after.push(...slice(source.after));
    if (source.afterDeclarations) into.afterDeclarations.push(...slice(source.afterDeclarations));

    return this;
  }

  public createTransformers(
    params: { program: Program } | { ls: LanguageService },
    customTransformers?: CustomTransformers
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
    /* Add support for TS transformers */
    if (!tsNodeIncluded && transform.match(/\.ts$/)) {
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
    program: Program;
    ls?: LanguageService;
  }):
    TransformerBasePlugin
  {
    const { transform, after, afterDeclarations, name, type, ...cleanConfig } = config;

    if (!transform) throw new Error('Not a valid config entry: "transform" key not found');

    let ret: TransformerPlugin;
    switch (config.type) {
      case 'ls':
        if (!ls) throw new Error(`Plugin ${transform} needs a LanguageService`);
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
        ret = (ctx: TransformationContext) => (factory as RawPattern)(ctx, program, cleanConfig);
        break;

      default:
        return never(config.type);
    }

    if (typeof ret === 'function')
      return after ? ({ after: ret }) :
        afterDeclarations ? ({ afterDeclarations: ret as TransformerFactory<SourceFile | Bundle> }) :
          { before: ret };

    return ret;
  }
}

// endregion