import path from 'path';
import { tspPackageJSON } from '../system';
import { TsModule } from '../ts-module';
import { TsPackage } from './ts-package';
import fs from 'fs';


/* ****************************************************************************************************************** */
// region: Locals
/* ****************************************************************************************************************** */

const [ _, curMajor, curMinor, curPatch ] = tspPackageJSON.version.match(/(\d+)\.(\d+)\.(\d+)/);

// endregion


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface PatchInfo {
  majorVer: number,
  minorVer: number,
  patchVer: number,
  version: string,
  isOutdated: boolean
}

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function readFirstLineSync(filePath: string) {
  const fd = fs.openSync(filePath, 'r');
  const bufferSize = 1;
  const buffer = Buffer.alloc(bufferSize);
  let bytesRead = 0;
  let line = '';

  while (true) {
    bytesRead = fs.readSync(fd, buffer, 0, bufferSize, null);
    if (bytesRead <= 0) break;
    const char = buffer.toString();
    if (char === '\n') break;
    line += char;
  }

  fs.closeSync(fd);
  return line;
}


// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getPatchInfo(tsPackage: TsPackage, moduleName: TsModule.Name | string): PatchInfo | undefined {
  const moduleFile = path.join(tsPackage.libDir, moduleName);

  /* Check for patch header */
  const firstLine = readFirstLineSync(moduleFile);
  const version = firstLine.match(/^\/\/\/ tsp: (\d+)\.(\d+)\.(\d+)/);
  if (!version) return undefined;

  /* Get patch version */
  const [ strVersion, sMajor, sMinor, sPatch ] = version;
  const res = { majorVer: +sMajor, minorVer: +sMinor, patchVer: +sPatch };

  if (isNaN(res.majorVer) || isNaN(res.minorVer) || isNaN(res.patchVer)) return undefined;

  /* Check if patch is outdated */
  const isOutdated = (+curMajor > res.majorVer) || (+curMinor > res.minorVer) || (+curPatch > res.patchVer);

  return { ...res, isOutdated, version: strVersion }
}

// endregion
