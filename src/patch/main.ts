/*
 * Note: This file is used to generate module-patch.js (see rollup.config.js)
 */
import { createProgram } from './createProgram';
import * as TS from 'typescript';
import { PluginCreator } from './plugin';


/* ********************************************************************************************************************
 * Declarations
 * ********************************************************************************************************************/

declare const ts: typeof TS;
declare const tspVersion: string;


/* ********************************************************************************************************************
 * Link to ts object
 * ********************************************************************************************************************/

Object.assign(ts, {
  tspVersion,
  PluginCreator,
  originalCreateProgram: ts.createProgram,
  createProgram
});