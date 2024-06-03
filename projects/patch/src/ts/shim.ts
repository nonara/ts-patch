/** @internal */
namespace tsp {
  /**
   * Compensate for modules which do not wrap functions in a `ts` namespace.
   */
  export const tsShim = new Proxy(
    {},
    {
      get(_, key: string) {
        const target = tsp.getTsInstance();
        if (target) {
          return (<any>target)[key];
        } else {
          try {
            return eval(key);
          } catch (e) {
            throw new TsPatchError(`Failed to find "${key}" in TypeScript shim`, e);
          }
        }
      },
    }
  ) as typeof import('typescript');

  export namespace tsShim {
    export type CompilerOptions = import('typescript').CompilerOptions;
    export type CreateProgramOptions = import('typescript').CreateProgramOptions;
    export type Program = import('typescript').Program;
    export type CompilerHost = import('typescript').CompilerHost;
    export type Diagnostic = import('typescript').Diagnostic;
    export type SourceFile = import('typescript').SourceFile;
    export type WriteFileCallback = import('typescript').WriteFileCallback;
    export type CancellationToken = import('typescript').CancellationToken;
    export type CustomTransformers = import('typescript').CustomTransformers;
    export type EmitResult = import('typescript').EmitResult;
    export type LanguageService = import('typescript').LanguageService;
    export type TransformationContext = import('typescript').TransformationContext;
    export type Node = import('typescript').Node;
    export type TransformerFactory<T extends Node> = import('typescript').TransformerFactory<T>;
    export type Bundle = import('typescript').Bundle;
    export type Path = import('typescript').Path;
    export type JSDocParsingMode = import('typescript').JSDocParsingMode;
  }
}
