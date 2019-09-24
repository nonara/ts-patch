import { createProgram as patchedCreateProgram } from './createProgram';
import * as TS from 'typescript';


/* ********************************************************************************************************************
 * Declarations
 * ********************************************************************************************************************/

declare const ts: typeof TS & { executeCommandLine(args: any[]): void };


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/

/** Is current module TSC */
export declare const isTSC: boolean;

/** ts-patch version */
export declare const version: string;

/** Exposed PluginCreator class */
export { PluginCreator } from './plugin';


/* ********************************************************************************************************************
 * Patch createProgram
 * ********************************************************************************************************************/

export const originalCreateProgram = ts.createProgram;
ts.createProgram = patchedCreateProgram;