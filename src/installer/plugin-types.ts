import {
  Bundle, CompilerHost, CompilerOptions, CustomTransformers, Diagnostic, LanguageService, Program, SourceFile,
  TransformationContext, Transformer,
  TransformerFactory, TypeChecker
} from 'typescript';
import * as ts from 'typescript';


/* ****************************************************************************************************************** */
// region: Plugin Related
/* ****************************************************************************************************************** */

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

// endregion


/* ****************************************************************************************************************** */
// region: Extras
/* ****************************************************************************************************************** */

export type TransformerExtras = {
  /**
   * Originating TypeScript instance
   */
  ts: typeof ts;
  /**
   * TypeScript library file event was triggered in (ie. 'tsserverlibrary' or 'typescript')
   */
  library: string
  addDiagnostic: (diag: Diagnostic) => number,
  removeDiagnostic: (index: number) => void,
  diagnostics: readonly Diagnostic[],
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
  program: Program,
  host: CompilerHost | undefined,
  config: PluginConfig,
  extras: ProgramTransformerExtras
) => Program;

export type LSPattern = (ls: LanguageService, config: {}) => TransformerPlugin;
export type CompilerOptionsPattern = (compilerOpts: CompilerOptions, config: {}) => TransformerPlugin;
export type ConfigPattern = (config: {}) => TransformerPlugin;
export type TypeCheckerPattern = (checker: TypeChecker, config: {}) => TransformerPlugin;

export type ProgramPattern = (
  program: Program,
  config: {},
  extras: TransformerExtras
) => TransformerPlugin;

export type RawPattern = (
  context: TransformationContext,
  program: Program,
  config: {}
) => Transformer<SourceFile>;

// endregion

