namespace tsp {
  const crypto = require('crypto');

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  interface CreateTransformerFromPatternOptions {
    factory: PluginFactory;
    config: PluginConfig;
    registerConfig: RegisterConfig;
    program: tsShim.Program;
    ls?: tsShim.LanguageService;
  }

  // endregion

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function validateConfigs(configs: PluginConfig[]) {
    for (const config of configs)
      if (!config.name && !config.transform) throw new TsPatchError('tsconfig.json plugins error: transform must be present');
  }

  function createTransformerFromPattern(opt: CreateTransformerFromPatternOptions): TransformerBasePlugin {
    const { factory, config, program, ls, registerConfig } = opt;
    const { transform, after, afterDeclarations, name, type, transformProgram, ...cleanConfig } = config;

    if (!transform) throw new TsPatchError('Not a valid config entry: "transform" key not found');

    const transformerKind = after ? 'after' : afterDeclarations ? 'afterDeclarations' : 'before';

    let pluginFactoryResult: TransformerPlugin;
    switch (config.type) {
      case 'ls':
        if (!ls) throw new TsPatchError(`Plugin ${transform} needs a LanguageService`);
        pluginFactoryResult = (factory as LSPattern)(ls, cleanConfig);
        break;

      case 'config':
        pluginFactoryResult = (factory as ConfigPattern)(cleanConfig);
        break;

      case 'compilerOptions':
        pluginFactoryResult = (factory as CompilerOptionsPattern)(program.getCompilerOptions(), cleanConfig);
        break;

      case 'checker':
        pluginFactoryResult = (factory as TypeCheckerPattern)(program.getTypeChecker(), cleanConfig);
        break;

      case undefined:
      case 'program':
        const { addDiagnostic, removeDiagnostic, diagnostics } = diagnosticExtrasFactory(program);

        pluginFactoryResult = (factory as ProgramPattern)(program, cleanConfig, {
          ts: <any>ts,
          addDiagnostic,
          removeDiagnostic,
          diagnostics,
          library: tsp.currentLibrary
        });
        break;

      case 'raw':
        pluginFactoryResult = (ctx: tsShim.TransformationContext) => (factory as RawPattern)(ctx, program, cleanConfig);
        break;

      default:
        throw new TsPatchError(`Invalid plugin type found in tsconfig.json: '${config.type}'`);
    }

    /* Handle result */
    let transformerFactory: TsTransformerFactory | undefined;
    switch (typeof pluginFactoryResult) {
      case 'function':
        transformerFactory = pluginFactoryResult;
        break;
      case 'object':
        transformerFactory = pluginFactoryResult[transformerKind];
        break;
    }

    if (!transformerFactory || typeof transformerFactory !== 'function')
      throw new TsPatchError(
        `Invalid plugin entry point! Expected a transformer factory function or an object with a '${transformerKind}' property`
      );

    /* Wrap w/ register */
    const wrapper = wrapTransformer(transformerFactory, registerConfig, true);

    const res: TransformerBasePlugin = {
      [transformerKind]: wrapper
    };

    return res;
  }

  function wrapTransformer<T extends PluginFactory | ProgramTransformer>(
    transformerFn: T,
    requireConfig: RegisterConfig,
    wrapInnerFunction: boolean
  ): T {
    const wrapper = function tspWrappedFactory(...args: any[]) {
      let res: any;
      try {
        registerPlugin(requireConfig);
        if (!wrapInnerFunction) {
          res = (transformerFn as Function)(...args);
        } else {
          const resFn = (transformerFn as Function)(...args);
          if (typeof resFn !== 'function') throw new TsPatchError('Invalid plugin: expected a function');
          res = wrapTransformer(resFn, requireConfig, false);
        }
      } finally {
        unregisterPlugin();
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

        const { factory, registerConfig } = resolvedFactory;

        this.mergeTransformers(
          transformers,
          createTransformerFromPattern({
            factory: factory as PluginFactory,
            registerConfig,
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

        const { registerConfig } = resolvedFactory;
        const factory = wrapTransformer(resolvedFactory.factory as ProgramTransformer, registerConfig, false);

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
