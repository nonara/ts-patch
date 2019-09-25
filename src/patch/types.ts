/*
 * Note: This file is used to generate module-patch.d.ts -- Final file will only include 'namespace ts' declarations
 */
import {
  SourceFile, TransformerFactory, CustomTransformers, LanguageService, Program, Diagnostic, CompilerOptions,
  TypeChecker, Transformer, TransformationContext, createProgram
} from 'typescript';


/* ********************************************************************************************************************
 * ts-patch types
 * ********************************************************************************************************************/

declare namespace ts {
  export const tspVersion: string;
  export const originalCreateProgram: typeof createProgram;

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
}


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/

export = ts;