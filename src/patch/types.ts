/*
 * Note: This file is used to generate module-patch.d.ts (see rollup.config.js)
 */
import { createProgram } from 'typescript';


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/

export declare const tspVersion: string;
export declare const originalCreateProgram: typeof createProgram;
export * from './plugin'