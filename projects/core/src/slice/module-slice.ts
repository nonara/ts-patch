import { ModuleFile } from '../module';
import { Position } from '../system';
import semver from 'semver';
import { sliceTs54 } from './ts54';
import { sliceTs55 } from './ts55';


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
  bodyWrapper?: {
    start: string;
    end: string;
  }
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function sliceModule(moduleFile: ModuleFile, tsVersion: string) {
  const baseVersion = semver.coerce(tsVersion, { includePrerelease: false });
  if (!baseVersion) throw new Error(`Could not parse TS version: ${tsVersion}`);

  if (semver.lt(baseVersion, '5.0.0')) {
    throw new Error(`Cannot patch TS version <5`);
  }

  if (semver.lt(baseVersion, '5.5.0')) {
    return sliceTs54(moduleFile);
  }

  return sliceTs55(moduleFile);
}

/** @internal */
export namespace ModuleSlice {
  export const createError = (msg?: string) =>
    new Error(`Could not recognize TS format during slice!` + (msg ? ` — ${msg}` : ''));
}

// endregion

