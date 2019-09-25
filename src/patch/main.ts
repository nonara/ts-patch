import { createProgram } from './createProgram';
import * as TS from 'typescript';
import { PluginCreator } from './plugin';


/* ********************************************************************************************************************
 * Declarations
 * ********************************************************************************************************************/

declare const ts: typeof TS;
declare const tspVersion: string;


/* ********************************************************************************************************************
 * External (link to ts)
 * ********************************************************************************************************************/

Object.assign(ts, {
  tspVersion,
  PluginCreator,
  originalCreateProgram: ts.createProgram,
  createProgram
});