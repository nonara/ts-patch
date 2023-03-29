namespace tsp {
  /* ********************************************************* *
   * Vars
   * ********************************************************* */

  export const diagnosticMap: tsp.DiagnosticMap = new WeakMap();
  export declare let isTSC: boolean;
  export declare let tspVersion: string;

  /* ********************************************************* *
   * Utils
   * ********************************************************* */

  /** @internal */
  export function diagnosticExtrasFactory(program: ts.Program) {
    const diagnostics = diagnosticMap.get(program) || diagnosticMap.set(program, []).get(program)!;

    const addDiagnostic = (diag: ts.Diagnostic): number => diagnostics.push(diag);
    const removeDiagnostic = (index: number) => { diagnostics.splice(index, 1) };

    return { addDiagnostic, removeDiagnostic, diagnostics };
  }

  /** @internal */
  export const getCurrentLibrary = () => require('path').basename(__filename, require('path').extname(__filename));
}
