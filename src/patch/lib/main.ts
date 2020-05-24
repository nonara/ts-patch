/*
 * Note: This file is used to generate module-patch.js (see rollup.config.js)
 */
import { createProgram } from './createProgram';
import { PluginCreator } from './plugin';
import { diagnosticMap } from './shared';
import * as TS from 'typescript';
import * as TSPlus from './type-declarations';


/* ****************************************************************************************************************** *
 * Ambient Declarations
 * ****************************************************************************************************************** */

declare const ts: typeof TS & typeof TSPlus;
declare const tspVersion: string;


/* ********************************************************************************************************************
 * Link to ts object
 * ********************************************************************************************************************/

Object.assign(ts, {
  tspVersion,
  PluginCreator,
  originalCreateProgram: ts.createProgram,
  createProgram,
  diagnosticMap
});
