/* ****************************************************************************************************************** *
 * Internal
 * ****************************************************************************************************************** */

/** @internal */
declare namespace ts {
  export type Program = import('typescript').Program;
  export type TypeChecker = import('typescript').TypeChecker;
  export type Transformer<T> = import('typescript').Transformer<T>;
  export type CompilerOptions = import('typescript').CompilerOptions;
  export type Diagnostic = import('typescript').Diagnostic;
  export type CreateProgramOptions = import('typescript').CreateProgramOptions;
  export type CompilerHost = import('typescript').CompilerHost;
  export type WriteFileCallback=  import('typescript').WriteFileCallback;
  export type CancellationToken = import('typescript').CancellationToken;
  export type EmitResult = import('typescript').EmitResult;
  export type CustomTransformers = import('typescript').CustomTransformers;
  export type LanguageService = import('typescript').LanguageService;
  export type TransformerFactory<T> = import('typescript').TransformerFactory<T>;
  export type TransformationContext = import('typescript').TransformationContext;
  export type SourceFile = import('typescript').SourceFile;
  export type Bundle = import('typescript').Bundle;

  export const createProgram: typeof import('typescript').createProgram;
  export const findConfigFile: typeof import('typescript').findConfigFile;
  export const readConfigFile: typeof import('typescript').readConfigFile;
  export const parseJsonConfigFileContent: typeof import('typescript').parseJsonConfigFileContent;
  export const sys: typeof import('typescript').sys;
}


/* ****************************************************************************************************************** *
 * Added Properties
 * ****************************************************************************************************************** */

/** @build-types */
declare namespace ts {
  export const originalCreateProgram: typeof ts.createProgram;
}
