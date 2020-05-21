/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */
import * as TS from 'typescript';
import {
  Bundle, CompilerHost, CompilerOptions, CustomTransformers, Diagnostic, LanguageService, Program, SourceFile,
  TransformationContext, Transformer, TransformerFactory, TypeChecker
} from 'typescript';
import resolve from 'resolve';
import { diagnosticExtrasFactory } from './diagnostics';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

declare const ts: typeof TS & { originalCreateProgram: typeof TS.createProgram };

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
   * Apply transformer after internal TypeScript transformers
   */
  after?: boolean;

  /**
   * Apply transformer on d.ts files TS2.9+
   */
  afterDeclarations?: boolean;

  /**
   * Transform *Program* instance (alters during createProgram()) (`type`, `after`, & `afterDeclarations` settings will
   * not apply) Entry point must be (program: Program, host?: CompilerHost) => Program
   */
  transformProgram?: boolean;

  /**
   * Alias to transformProgram
   * @deprecated
   */
  beforeEmit?: boolean;
}

export type TransformerList = Required<CustomTransformers>;
export type TransformerPlugin = TransformerBasePlugin | TransformerFactory<SourceFile>;

export type PluginFactory =
  LSPattern | ProgramPattern | ConfigPattern | CompilerOptionsPattern | TypeCheckerPattern | RawPattern;

export interface TransformerBasePlugin {
  before?: TransformerFactory<SourceFile>;
  after?: TransformerFactory<SourceFile>;
  afterDeclarations?: TransformerFactory<SourceFile | Bundle>;
}

export type ProgramTransformer = (program: Program, host?: CompilerHost, config?: PluginConfig) => Program;

export type TspExtras = {
  ts: typeof ts;
  addDiagnostic: (diag: Diagnostic) => number,
  removeDiagnostic: (index: number) => void,
  diagnostics: readonly Diagnostic[]
}

/* ********************************************************* */
// region: Patterns
/* ********************************************************* */

export type LSPattern = (ls: LanguageService, config: {}) => TransformerPlugin;
export type CompilerOptionsPattern = (compilerOpts: CompilerOptions, config: {}) => TransformerPlugin;
export type ConfigPattern = (config: {}) => TransformerPlugin;
export type TypeCheckerPattern = (checker: TypeChecker, config: {}) => TransformerPlugin;

export type ProgramPattern = (
  program: Program,
  config: {},
  extras?: TspExtras
) => TransformerPlugin;

export type RawPattern = (
  context: TransformationContext,
  program: Program,
  config: {}
) => Transformer<SourceFile>;

// endregion

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

    // Support for deprecated 1.1 name
    for (const config of configs) if (config['beforeEmit']) config.transformProgram = true;
  }

  public mergeTransformers(into: TransformerList, source: CustomTransformers | TransformerBasePlugin) {
    const slice = <T>(input: T | T[]) => (Array.isArray(input) ? input.slice() : [ input ]);

    if (source.before) into.before.push(...slice(source.before));
    if (source.after) into.after.push(...slice(source.after));
    if (source.afterDeclarations) into.afterDeclarations.push(...slice(source.afterDeclarations));

    return this;
  }

  public createTransformers(
    params: { program: Program } | { ls: LanguageService },
    customTransformers?: CustomTransformers
  ): TransformerList {
    const transformers: TransformerList = { before: [], after: [], afterDeclarations: [] };

    const [ ls, program ] = ('ls' in params) ? [ params.ls, params.ls.getProgram()! ] : [ void 0, params.program ];

    for (const config of this.configs) {
      if (!config.transform || config.transformProgram) continue;

      const factory = this.resolveFactory(config.transform, config.import);
      if (factory === undefined) continue;

      this.mergeTransformers(
        transformers,
        PluginCreator.createTransformerFromPattern({ factory: <PluginFactory>factory, config, program, ls })
      );
    }

    // Chain custom transformers at the end
    if (customTransformers) this.mergeTransformers(transformers, customTransformers);

    return transformers;
  }

  public getProgramTransformers(): [ ProgramTransformer, PluginConfig ][] {
    const res:[ ProgramTransformer, PluginConfig ][] = [];
    for (const config of this.configs) {
      if (!config.transform || !config.transformProgram) continue;

      const factory = this.resolveFactory(config.transform, config.import) as ProgramTransformer;
      if (factory === undefined) continue;

      res.push([ factory, config ]);
    }

    return res;
  }


  /* ***********************************************************
   * Helpers
   * ***********************************************************/

  private resolveFactory(transform: string, importKey: string = 'default'):
    PluginFactory | ProgramTransformer | undefined
  {
    /* Add support for TS transformers */
    if (!tsNodeIncluded && transform.match(/\.ts$/)) {
      require('ts-node').register({
        transpileOnly: true,
        skipProject: true,
        compilerOptions: {
          target: 'ES2018',
          jsx: 'react',
          esModuleInterop: true,
          module: 'commonjs',
        },
      });
      tsNodeIncluded = true;
    }

    const modulePath = resolve.sync(transform, { basedir: this.resolveBaseDir });

    /* Prevent recursive requiring of createTransformers (issue with ts-node) */
    if (requireStack.indexOf(modulePath) > -1) return;

    /* Load plugin */
    requireStack.push(modulePath);
    const commonjsModule: PluginFactory | { [key: string]: PluginFactory } = require(modulePath);
    requireStack.pop();

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
    TransformerBasePlugin {
    const { transform, after, afterDeclarations, name, type, transformProgram, ...cleanConfig } = config;

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
        const { addDiagnostic, removeDiagnostic, diagnostics } = diagnosticExtrasFactory(program);

        ret = (factory as ProgramPattern)(program, cleanConfig, {
          ts,
          addDiagnostic,
          removeDiagnostic,
          diagnostics
        });
        break;

      case 'raw':
        ret = (ctx: TransformationContext) => (factory as RawPattern)(ctx, program, cleanConfig);
        break;

      default:
        throw new Error(`Invalid plugin type found in tsconfig.json: '${config.type}'`);
    }

    if (typeof ret === 'function')
      return after ? ({ after: ret }) :
             afterDeclarations ? ({ afterDeclarations: ret as TransformerFactory<SourceFile | Bundle> }) :
               { before: ret };

    return ret;
  }
}

// endregion
