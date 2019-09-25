/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

import * as TS from 'typescript';
import * as TSPlus from './types';
import { never } from './shared';
import { addDiagnosticFactory } from './shared';
import {
  CompilerOptionsPattern,
  ConfigPattern,
  LSPattern,
  PluginConfig,
  PluginFactory,
  ProgramPattern,
  RawPattern,
  TransformerBasePlugin,
  TransformerList,
  TransformerPlugin,
  TypeCheckerPattern
} from './types';


/* ********************************************************************************************************************
 * Declarations
 * ********************************************************************************************************************/

declare const ts: typeof TS & typeof TSPlus;


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