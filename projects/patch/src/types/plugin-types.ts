// @ts-nocheck
/** AUTO-GENERATED - DO NOT EDIT */

/** @build-types */
declare namespace tsp {
    export interface PluginConfig {
        [x: string]: any;
        name?: string;
        transform?: string;
        resolvePathAliases?: boolean;
        tsConfig?: string;
        import?: string;
        isEsm?: boolean;
        type?: 'ls' | 'program' | 'config' | 'checker' | 'raw' | 'compilerOptions';
        after?: boolean;
        afterDeclarations?: boolean;
        transformProgram?: boolean;
    }
    export type TransformerList = Required<ts.CustomTransformers>;
    export type TransformerPlugin = TransformerBasePlugin | TsTransformerFactory;
    export type TsTransformerFactory = ts.TransformerFactory<ts.SourceFile>;
    export type PluginFactory = LSPattern | ProgramPattern | ConfigPattern | CompilerOptionsPattern | TypeCheckerPattern | RawPattern;
    export interface TransformerBasePlugin {
        before?: ts.TransformerFactory<ts.SourceFile>;
        after?: ts.TransformerFactory<ts.SourceFile>;
        afterDeclarations?: ts.TransformerFactory<ts.SourceFile | ts.Bundle>;
    }
    export type DiagnosticMap = WeakMap<ts.Program, ts.Diagnostic[]>;
    export type TransformerExtras = {
        ts: typeof ts;
        library: string;
        addDiagnostic: (diag: ts.Diagnostic) => number;
        removeDiagnostic: (index: number) => void;
        diagnostics: readonly ts.Diagnostic[];
    };
    export type ProgramTransformerExtras = {
        ts: typeof ts;
    };
    export type ProgramTransformer = (program: ts.Program, host: ts.CompilerHost | undefined, config: PluginConfig, extras: ProgramTransformerExtras) => ts.Program;
    export type LSPattern = (ls: ts.LanguageService, config: {}) => TransformerPlugin;
    export type CompilerOptionsPattern = (compilerOpts: ts.CompilerOptions, config: {}) => TransformerPlugin;
    export type ConfigPattern = (config: {}) => TransformerPlugin;
    export type TypeCheckerPattern = (checker: ts.TypeChecker, config: {}) => TransformerPlugin;
    export type ProgramPattern = (program: ts.Program, config: {}, extras: TransformerExtras) => TransformerPlugin;
    export type RawPattern = (context: ts.TransformationContext, program: ts.Program, config: {}) => ts.Transformer<ts.SourceFile>;
}
