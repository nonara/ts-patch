/*
 * Note: This file is used to generate module-patch.d.ts -- Final file will only include 'namespace ts' declarations
 */
import { createProgram } from 'typescript';

/* ********************************************************************************************************************
 * ts-patch types
 * ********************************************************************************************************************/

export declare const tspVersion: string;
export declare const originalCreateProgram: typeof createProgram;
export * from './plugin'