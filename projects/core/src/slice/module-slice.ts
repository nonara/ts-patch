import { ModuleFile } from '../module';
import { Position } from '../system';
import semver from 'semver';
import { sliceTs5 } from './ts5';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface ModuleSlice {
  moduleFile: ModuleFile
  firstSourceFileStart: number
  wrapperPos?: Position
  bodyPos: Position
  fileEnd: number
  sourceFileStarts: [ name: string, position: number ][]
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function sliceModule(moduleFile: ModuleFile, tsVersion: string) {
  if (semver.lte(tsVersion, '5.0.0')) {
    throw new Error(`Cannot patch TS version <5`);
  }

  /* Handle 5+ */
  return sliceTs5(moduleFile);
}

/** @internal */
export namespace ModuleSlice {
  export const createError = (msg?: string) =>
    new Error(`Could not recognize TS format during slice!` + (msg ? ` — ${msg}` : ''));
}

// endregion

