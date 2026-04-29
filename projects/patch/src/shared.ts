namespace tsp {
  const os = require('os');
  const path = require('path');
  const fs = require('fs');

  /* ********************************************************* */
  // region: Vars
  /* ********************************************************* */

  export const diagnosticMap: tsp.DiagnosticMap = new WeakMap();

  /** Injected during patch — library name minus extension */
  export declare const currentLibrary: string;

  export const supportedExtensions = [ '.ts', '.mts', '.cts', '.js', '.mjs', '.cjs' ];
  export const tsExtensions = [ '.ts', '.mts', '.cts' ];

  /** @internal */
  export type TsInstance = typeof import('typescript') & {
    originalCreateProgram: typeof import('typescript').createProgram
    getEmitModuleKind(options: import('typescript').CompilerOptions): import('typescript').ModuleKind
    getEmitModuleFormatOfFileWorker?(
      sourceFile: import('typescript').SourceFile,
      options: import('typescript').CompilerOptions
    ): import('typescript').ModuleKind
    getImpliedNodeFormatForFileWorker(
      fileName: string,
      packageJsonInfoCache: unknown,
      host: import('typescript').ModuleResolutionHost,
      options: import('typescript').CompilerOptions
    ): import('typescript').ModuleKind.CommonJS | import('typescript').ModuleKind.ESNext | Partial<import('typescript').CreateSourceFileOptions> | undefined
    getEmitScriptTarget(options: import('typescript').CompilerOptions): import('typescript').ScriptTarget
    getSetExternalModuleIndicator(options: import('typescript').CompilerOptions): (file: import('typescript').SourceFile) => void
  };

  // endregion

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  /** @internal */
  export function diagnosticExtrasFactory(program: tsShim.Program) {
    const diagnostics = diagnosticMap.get(program) || diagnosticMap.set(program, []).get(program)!;

    const addDiagnostic = (diag: tsShim.Diagnostic): number => diagnostics.push(diag);
    const removeDiagnostic = (index: number) => { diagnostics.splice(index, 1) };

    return { addDiagnostic, removeDiagnostic, diagnostics };
  }

  /** @internal */
  export function getTmpDir(subPath?: string) {
    const tmpDir = path.resolve(os.tmpdir(), 'tsp', subPath);
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    return tmpDir;
  }

  /** @internal */
  export function getTsInstance() {
    return (typeof ts !== 'undefined' ? ts : module.exports) as TsInstance;
  }

  function getErrorMessage(e: any) {
    return String(e?.message || '');
  }

  function extractFilePathFromError(e: any): string | undefined {
    if (typeof e?.fileName === 'string') return e.fileName;

    const stack = String(e?.stack || '');
    const fileUrlMatch = stack.match(/file:\/\/([^:\n)]+\.[cm]?[tj]sx?):\d+:\d+/);
    if (fileUrlMatch) return decodeURIComponent(fileUrlMatch[1]);

    const pathMatch = stack.match(/(\/[^:\n)]+\.[cm]?[tj]sx?):\d+:\d+/);
    return pathMatch?.[1];
  }

  /** @internal */
  export function describeEsmInCjsError(e: any): string | undefined {
    const msg = getErrorMessage(e);
    const filePath = extractFilePathFromError(e);
    const sourceRef = filePath ? ` "${filePath}"` : '';

    if (msg.includes('import.meta') && msg.includes('outside a module')) {
      return (
        `Transformer source${sourceRef} uses "import.meta" but was loaded as CommonJS. ` +
        `Rename the transformer or helper to ".mts", set the transformer tsConfig "module" to ESNext, ` +
        `or use NodeNext with "type": "module" in the nearest package.json.`
      );
    }

    if (/await is only valid/i.test(msg) && /module/i.test(msg)) {
      return (
        `Transformer source${sourceRef} uses top-level "await" but was loaded as CommonJS. ` +
        `Rename the transformer or helper to ".mts", set the transformer tsConfig "module" to ESNext, ` +
        `or use NodeNext with "type": "module" in the nearest package.json.`
      );
    }

    if (e?.code === 'ERR_REQUIRE_ASYNC_MODULE') {
      return (
        `Transformer source${sourceRef} contains top-level "await" in its ESM graph and cannot be loaded synchronously with require(). ` +
        `Move async initialization out of the top level, or open an issue if the transformer requires async module initialization.`
      );
    }

    return undefined;
  }

  // endregion

  /* ********************************************************* */
  // region: Other
  /* ********************************************************* */

  export class TsPatchError extends Error {
    constructor(message: string, public diagnostic?: tsShim.Diagnostic) {
      super(message);
    }
  }

  // endregion
}
