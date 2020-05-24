import * as TS from 'typescript';
import { Diagnostic } from 'typescript';


/* ****************************************************************************************************************** */
// region: Constants
/* ****************************************************************************************************************** */

export const diagnosticMap = new WeakMap<TS.Program, Diagnostic[]>();

// endregion



/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

export function diagnosticExtrasFactory(program: TS.Program) {
  const diagnostics = diagnosticMap.get(program) || diagnosticMap.set(program, []).get(program)!;

  const addDiagnostic = (diag: TS.Diagnostic): number => diagnostics.push(diag);
  const removeDiagnostic = (index: number) => { diagnostics.splice(index, 1) };

  return { addDiagnostic, removeDiagnostic, diagnostics };
}

export const getCurrentLibrary = () => require('path').basename(__filename, require('path').extname(__filename));
