/**
 * NOTE: This file is used during the build process for patch as well
 */
import type ts from 'typescript';


/* ****************************************************************************************************************** */
// region: Plugin
/* ****************************************************************************************************************** */

export interface PluginConfig {
  [x:string]: any

  /**
   * Language Server TypeScript Plugin name
   */
  name?: string;

  /**
   * Path to transformer or transformer module name
   */
  transform?: string;

  /**
   * Resolve Path Aliases?
   */
  resolvePathAliases?: boolean;

  /**
   * tsconfig.json file (for transformer)
   */
  tsConfig?: string;

  /**
   * The optional name of the exported transform plugin in the transform module.
   */
  import?: string;

  /**
   * Is the transformer an ES Module
   */
  isEsm?: boolean

  /**
   * Plugin entry point format type, default is program
   */
  type?: 'ls' | 'program' | 'config' | 'checker' | 'raw' | 'compilerOptions';

  /**
   * Apply transformer after internal TypeScript transformers
   */
  after?: boolean;

  /**
   * Apply transformer on d.ts files
   */
  afterDeclarations?: boolean;

  /**
   * Transform *Program* instance (alters during createProgram()) (`type`, `after`, & `afterDeclarations` settings will
   * not apply) Entry point must be (program: Program, host?: CompilerHost) => Program
   */
  transformProgram?: boolean;
}

export type TransformerList = Required<ts.CustomTransformers>;
export type TransformerPlugin = TransformerBasePlugin | TsTransformerFactory;
export type TsTransformerFactory = ts.TransformerFactory<ts.SourceFile>

export type PluginFactory =
  LSPattern | ProgramPattern | ConfigPattern | CompilerOptionsPattern | TypeCheckerPattern | RawPattern;

export interface TransformerBasePlugin {
  before?: ts.TransformerFactory<ts.SourceFile>;
  after?: ts.TransformerFactory<ts.SourceFile>;
  afterDeclarations?: ts.TransformerFactory<ts.SourceFile | ts.Bundle>;
}

// endregion


/* ****************************************************************************************************************** */
// region: Extras
/* ****************************************************************************************************************** */

export type DiagnosticMap = WeakMap<ts.Program, ts.Diagnostic[]>;

export type TransformerExtras = {
  /**
   * Originating TypeScript instance
   */
  ts: typeof ts;
  /**
   * TypeScript library file event was triggered in (ie. 'tsserverlibrary' or 'typescript')
   */
  library: string
  addDiagnostic: (diag: ts.Diagnostic) => number,
  removeDiagnostic: (index: number) => void,
  diagnostics: readonly ts.Diagnostic[],
}

export type ProgramTransformerExtras = {
  /**
   * Originating TypeScript instance
   */
  ts: typeof ts;
}

// endregion


/* ****************************************************************************************************************** */
// region: Signatures
/* ****************************************************************************************************************** */

export type ProgramTransformer = (
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  config: PluginConfig,
  extras: ProgramTransformerExtras
) => ts.Program;

export type LSPattern = (ls: ts.LanguageService, config: {}) => TransformerPlugin;
export type CompilerOptionsPattern = (compilerOpts: ts.CompilerOptions, config: {}) => TransformerPlugin;
export type ConfigPattern = (config: {}) => TransformerPlugin;
export type TypeCheckerPattern = (checker: ts.TypeChecker, config: {}) => TransformerPlugin;

export type ProgramPattern = (
  program: ts.Program,
  config: {},
  extras: TransformerExtras
) => TransformerPlugin;

export type RawPattern = (
  context: ts.TransformationContext,
  program: ts.Program,
  config: {}
) => ts.Transformer<ts.SourceFile>;

// endregion
