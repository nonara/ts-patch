/*
 * The logic in this file is based on TTypescript (https://github.com/cevek/ttypescript)
 * Credit & thanks go to cevek (https://github.com/cevek) for the incredible work!
 */

import * as TS from 'typescript';
import { Diagnostic } from 'typescript';


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

export const transformerErrors = new WeakMap<TS.Program, Diagnostic[]>();


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

export function addDiagnosticFactory(program: TS.Program) {
  return (diag: TS.Diagnostic) => {
    const arr = transformerErrors.get(program) || [];
    arr.push(diag);
    transformerErrors.set(program, arr);
  };
}

export function never(n: never): never { throw new Error('Unexpected type: ' + n); }
