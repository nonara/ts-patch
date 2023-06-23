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
