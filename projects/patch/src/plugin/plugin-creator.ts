/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

namespace tsp {
  /* ********************************************************* *
   * PluginCreator (Class)
   * ********************************************************* */

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
      public resolveBaseDir: string = process.cwd()
    )
    {
      PluginCreator.validateConfigs(configs);

      // Support for deprecated 1.1 name
      for (const config of configs) if (config['beforeEmit']) config.transformProgram = true;
    }

    public mergeTransformers(into: TransformerList, source: tsShim.CustomTransformers | TransformerBasePlugin) {
      const slice = <T>(input: T | T[]) => (Array.isArray(input) ? input.slice() : [ input ]);

      if (source.before) into.before.push(...slice(source.before));
      if (source.after) into.after.push(...slice(source.after));
      if (source.afterDeclarations) into.afterDeclarations.push(...slice(source.afterDeclarations));

      return this;
    }

    public createTransformers(
      params: { program: tsShim.Program } | { ls: tsShim.LanguageService },
      customTransformers?: tsShim.CustomTransformers
    ): TransformerList {
      const transformers: TransformerList = { before: [], after: [], afterDeclarations: [] };

      const [ ls, program ] = ('ls' in params) ? [ params.ls, params.ls.getProgram()! ] : [ void 0, params.program ];

      for (const config of this.configs) {
        if (!config.transform || config.transformProgram) continue;

        const factory = tsp.resolveFactory(this, config);
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
      const res: [ ProgramTransformer, PluginConfig ][] = [];
      for (const config of this.configs) {
        if (!config.transform || !config.transformProgram) continue;

        const factory = resolveFactory(this, config) as ProgramTransformer;
        if (factory === undefined) continue;

        res.push([ factory, config ]);
      }

      return res;
    }

    /* ********************************************************* *
     * Static
     * ********************************************************* */

    static validateConfigs(configs: PluginConfig[]) {
      for (const config of configs)
        if (!config.name && !config.transform) throw new Error('tsconfig.json plugins error: transform must be present');
    }

    static createTransformerFromPattern({ factory, config, program, ls }: {
      factory: PluginFactory;
      config: PluginConfig;
      program: tsShim.Program;
      ls?: tsShim.LanguageService;
    }): TransformerBasePlugin
    {
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
            ts: <any>ts,
            addDiagnostic,
            removeDiagnostic,
            diagnostics,
            library: tsp.currentLibrary
          });
          break;

        case 'raw':
          ret = (ctx: tsShim.TransformationContext) => (factory as RawPattern)(ctx, program, cleanConfig);
          break;

        default:
          throw new Error(`Invalid plugin type found in tsconfig.json: '${config.type}'`);
      }

      if (typeof ret === 'function')
        return after ? ({ after: ret }) :
          afterDeclarations ? ({ afterDeclarations: ret as tsShim.TransformerFactory<tsShim.SourceFile | tsShim.Bundle> }) :
            { before: ret };

      return ret;
    }
  }
}
