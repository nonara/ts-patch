namespace tsp {
  /* ********************************************************* *
   * Vars
   * ********************************************************* */

  export const diagnosticMap: tsp.DiagnosticMap = new WeakMap();

  export const supportedExtensions = [ '.ts', '.mts', '.cts', '.js', '.mjs', '.cjs' ];
  export const tsExtensions = [ '.ts', '.mts', '.cts' ];

  /** Injected during patch — library name minus extension */
  export declare const currentLibrary: string;

  /* ********************************************************* *
   * Utils
   * ********************************************************* */

  /** @internal */
  export function diagnosticExtrasFactory(program: tsShim.Program) {
    const diagnostics = diagnosticMap.get(program) || diagnosticMap.set(program, []).get(program)!;

    const addDiagnostic = (diag: tsShim.Diagnostic): number => diagnostics.push(diag);
    const removeDiagnostic = (index: number) => { diagnostics.splice(index, 1) };

    return { addDiagnostic, removeDiagnostic, diagnostics };
  }
}
