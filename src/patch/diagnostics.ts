/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

import * as TS from 'typescript';
import { Diagnostic } from 'typescript';


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

export const diagnosticMap = new WeakMap<TS.Program, Diagnostic[]>();


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

export function diagnosticExtrasFactory(program: TS.Program) {
  const diagnostics = diagnosticMap.get(program) || diagnosticMap.set(program, []).get(program)!;

  const addDiagnostic = (diag: TS.Diagnostic): number => diagnostics.push(diag);
  const removeDiagnostic = (index: number) => { diagnostics.splice(index, 1) };

  return { addDiagnostic, removeDiagnostic, diagnostics };
}
