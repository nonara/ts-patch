namespace tsp {
  const crypto = require('crypto');

  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  /** @internal */
  interface CreateTransformersFromPatternOptions {
    factory: PluginFactory;
    config: PluginConfig;
    registerConfig: RegisterConfig;
    program: tsShim.Program;
    ls?: tsShim.LanguageService;
  }

  export namespace PluginCreator {
    export interface Options {
      resolveBaseDir: string;
    }
  }

  // endregion

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function createTransformersFromPattern(opt: CreateTransformersFromPatternOptions): TransformerBasePlugin {
    const { factory, config, program, ls, registerConfig } = opt;
    const { transform, after, afterDeclarations, name, type, transformProgram, ...cleanConfig } = config;

    if (!transform) throw new TsPatchError('Not a valid config entry: "transform" key not found');

    // @formatter:off
    const transformerKind =
      after ? 'after' :
      afterDeclarations ? 'afterDeclarations' :
      'before';
    // @formatter:on

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

    /* Extract factories */
    let transformerFactories: TsTransformerFactory[];
    // noinspection FallThroughInSwitchStatementJS
    switch (typeof pluginFactoryResult) {
      // Single transformer factory
      case 'function':
        transformerFactories = [ pluginFactoryResult ];
        break;
      // TransformerBasePlugin
      case 'object':
        const factoryOrFactories = pluginFactoryResult[transformerKind];

        // Single transformer factory
        if (typeof factoryOrFactories === 'function') {
          transformerFactories = [ pluginFactoryResult[transformerKind] ];
          break;
        }
        // Array of transformer factories
        else if (Array.isArray(factoryOrFactories)) {
          transformerFactories = [ ...factoryOrFactories ];
          break;
        }
        // Deliberate fall-through
      default:
        throw new TsPatchError(`Invalid plugin result: expected a function or an object with a '${transformerKind}' property`);
    }

    /* Wrap factories */
    const wrappedFactories: TsTransformerFactory[] = [];
    for (const transformerFactory of transformerFactories) {
      if (!transformerFactory || typeof transformerFactory !== 'function')
        throw new TsPatchError(
          `Invalid plugin entry point! Expected a transformer factory function or an object with a '${transformerKind}' property`
        );

      /* Wrap w/ register */
      const wrapper = wrapTransformerFactory(transformerFactory, registerConfig, true);
      wrappedFactories.push(wrapper);
    }

    const res: TransformerBasePlugin = {
      [transformerKind]: wrappedFactories
    };

    return res;
  }

  function wrapTransformerFactory(
    transformerFn: TsTransformerFactory,
    requireConfig: RegisterConfig,
    wrapInnerFunction: boolean
  ): TsTransformerFactory {
    const wrapper: TsTransformerFactory = function tspWrappedFactory(...args: any[]) {
      let res: any;
      try {
        registerPlugin(requireConfig);
        if (!wrapInnerFunction) {
          res = (transformerFn as Function)(...args);
        } else {
          const resFn = (transformerFn as Function)(...args);
          if (typeof resFn !== 'function') throw new TsPatchError('Invalid plugin: expected a function');
          res = wrapTransformerFactory(resFn, requireConfig, false);
        }
      }
      finally {
        unregisterPlugin();
      }

      return res;
    }

    return wrapper;
  }

  // endregion

  /* ********************************************************* *
   * PluginCreator (Class)
   * ********************************************************* */

  export class PluginCreator {
    public readonly plugins: TspPlugin[] = [];
    public readonly options: PluginCreator.Options;
    public readonly needsTscJsDocParsing: boolean;

    private readonly configs: PluginConfig[];

    constructor(configs: PluginConfig[], options: PluginCreator.Options) {
      this.configs = configs;
      this.options = options;

      const { resolveBaseDir } = options;

      /* Create plugins */
      this.plugins = configs
        .filter(config => config.transform !== undefined)
        .map(config => new TspPlugin(config, { resolveBaseDir }));

      /* Check if we need to parse all JSDoc comments */
      this.needsTscJsDocParsing = this.plugins.some(plugin => plugin.packageConfig?.tscOptions?.parseAllJsDoc === true);
    }

    private mergeTransformers(into: TransformerList, source: tsShim.CustomTransformers | TransformerBasePlugin) {
      const slice = <T>(input: T | T[]) => (Array.isArray(input) ? input.slice() : [ input ]);

      if (source.before) into.before.push(...slice(source.before));
      if (source.after) into.after.push(...slice(source.after));
      if (source.afterDeclarations) into.afterDeclarations.push(...slice(source.afterDeclarations));

      return this;
    }

    public createSourceTransformers(
      params: { program: tsShim.Program } | { ls: tsShim.LanguageService },
      customTransformers?: tsShim.CustomTransformers
    ): TransformerList {
      const transformers: TransformerList = { before: [], after: [], afterDeclarations: [] };

      const [ ls, program ] = ('ls' in params) ? [ params.ls, params.ls.getProgram()! ] : [ void 0, params.program ];

      for (const plugin of this.plugins) {
        if (plugin.kind !== 'SourceTransformer') continue;

        const { config } = plugin;

        const createFactoryResult = plugin.createFactory();
        if (!createFactoryResult) continue;

        const { factory, registerConfig } = createFactoryResult;

        this.mergeTransformers(
          transformers,
          createTransformersFromPattern({
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

    public createProgramTransformers(): Map<string, [ ProgramTransformer, PluginConfig ]> {
      const res = new Map<string, [ ProgramTransformer, PluginConfig ]>();
      for (const plugin of this.plugins) {
        if (plugin.kind !== 'ProgramTransformer') continue;

        const { config } = plugin;

        const createFactoryResult = plugin.createFactory();
        if (createFactoryResult === undefined) continue;

        const { registerConfig, factory: unwrappedFactory } = createFactoryResult;
        const factory = wrapTransformerFactory(unwrappedFactory as ProgramTransformer, registerConfig, false);

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
