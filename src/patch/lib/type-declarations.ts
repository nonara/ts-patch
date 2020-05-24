/*
 * Note: This file is used to generate module-patch.d.ts (see rollup.config.js)
 */
import { createProgram } from 'typescript';
import { diagnosticMap as dgMap } from './shared';


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/

export declare const tspVersion: string;
export declare const originalCreateProgram: typeof createProgram;
export declare const diagnosticMap: typeof dgMap;

export * from './types'
export * from './plugin'
