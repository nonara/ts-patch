namespace tsp {
  const crypto = require('crypto');

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  interface CreateTransformerFromPatternOptions {
    factory: PluginFactory;
    config: PluginConfig;
    requireConfig: RequireConfig;
    program: tsShim.Program;
    ls?: tsShim.LanguageService;
  }

  // endregion

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function validateConfigs(configs: PluginConfig[]) {
    for (const config of configs)
      if (!config.name && !config.transform) throw new Error('tsconfig.json plugins error: transform must be present');
  }

  function createTransformerFromPattern(opt: CreateTransformerFromPatternOptions): TransformerBasePlugin {
    const { factory, config, program, ls, requireConfig } = opt;
    const { transform, after, afterDeclarations, name, type, transformProgram, ...cleanConfig } = config;

    if (!transform) throw new Error('Not a valid config entry: "transform" key not found');

    let transformerFn: PluginFactory;
    switch (config.type) {
      case 'ls':
        if (!ls) throw new Error(`Plugin ${transform} needs a LanguageService`);
        transformerFn = (factory as LSPattern)(ls, cleanConfig);
        break;

      case 'config':
        transformerFn = (factory as ConfigPattern)(cleanConfig);
        break;

      case 'compilerOptions':
        transformerFn = (factory as CompilerOptionsPattern)(program.getCompilerOptions(), cleanConfig);
        break;

      case 'checker':
        transformerFn = (factory as TypeCheckerPattern)(program.getTypeChecker(), cleanConfig);
        break;

      case undefined:
      case 'program':
        const { addDiagnostic, removeDiagnostic, diagnostics } = diagnosticExtrasFactory(program);

        transformerFn = (factory as ProgramPattern)(program, cleanConfig, {
          ts: <any>ts,
          addDiagnostic,
          removeDiagnostic,
          diagnostics,
          library: tsp.currentLibrary
        });
        break;

      case 'raw':
        transformerFn = (ctx: tsShim.TransformationContext) => (factory as RawPattern)(ctx, program, cleanConfig);
        break;

      default:
        throw new Error(`Invalid plugin type found in tsconfig.json: '${config.type}'`);
    }

    /* Wrap w/ require hook */
    const wrapper = wrapTransformer(transformerFn, requireConfig, true);

    const res: TransformerBasePlugin =
      after ? ({ after: wrapper }) :
        afterDeclarations ? ({ afterDeclarations: wrapper as tsShim.TransformerFactory<tsShim.SourceFile | tsShim.Bundle> }) :
          { before: wrapper };

    return res;
  }

  function wrapTransformer<T extends PluginFactory | ProgramTransformer>(
    transformerFn: T,
    requireConfig: RequireConfig,
    wrapInnerFunction: boolean
  ): T {
    const wrapper = function tspWrappedFactory(...args: any[]) {
      let res: any;
      try {
        hookRequire(requireConfig);
        if (!wrapInnerFunction) {
          res = (transformerFn as Function)(...args);
        } else {
          const resFn = (transformerFn as Function)(...args);
          if (typeof resFn !== 'function') throw new Error('Invalid plugin: expected a function');
          res = wrapTransformer(resFn, requireConfig, false);
        }
      } finally {
        unhookRequire();
      }

      return res;
    } as T;

    return wrapper;
  }

  // endregion

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
      validateConfigs(configs);

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

        const resolvedFactory = tsp.resolveFactory(this, config);
        if (!resolvedFactory) continue;

        const { factory, requireConfig } = resolvedFactory;

        this.mergeTransformers(
          transformers,
          createTransformerFromPattern({
            factory: factory as PluginFactory,
            requireConfig,
            config,
            program,
            ls
          })
        );
      }

      // Chain custom transformers at the end
      if (customTransformers) this.mergeTransformers(transformers, customTransformers);

      return transformers;
    }

    public getProgramTransformers(): Map<string, [ ProgramTransformer, PluginConfig ]> {
      const res = new Map<string, [ ProgramTransformer, PluginConfig ]>();
      for (const config of this.configs) {
        if (!config.transform || !config.transformProgram) continue;

        const resolvedFactory = resolveFactory(this, config);
        if (resolvedFactory === undefined) continue;

        const { requireConfig } = resolvedFactory;
        const factory = wrapTransformer(resolvedFactory.factory as ProgramTransformer, requireConfig, false);

        const transformerKey = crypto
          .createHash('md5')
          .update(JSON.stringify({ factory, config }))
          .digest('hex');

        res.set(transformerKey, [ factory, config ]);
      }

      return res;
    }
  }
}
