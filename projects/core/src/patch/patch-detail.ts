import { TsModule } from '../module';
import { corePatchName, tspPackageJSON } from '../config';
import semver from 'semver';
import { getHash } from '../utils';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

export const tspHeaderBlockStart = '/// tsp-module:';
export const tspHeaderBlockStop = '/// :tsp-module';
export const currentPatchDetailVersion = '0.1.0';

// endregion


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface PatchDetail {
  tsVersion: string
  tspVersion: string
  patchDetailVersion: string
  moduleName: TsModule.Name
  originalHash: string
  hash: string
  patches: PatchDetail.PatchEntry[]
}

export namespace PatchDetail {
  export interface PatchEntry {
    library: string
    version: string
    patchName?: string
    hash?: string
    blocksCache?: boolean
  }
}

// endregion


/* ****************************************************************************************************************** */
// region: PatchDetail (class)
/* ****************************************************************************************************************** */

export class PatchDetail {

  /* ********************************************************* */
  // region: Methods
  /* ********************************************************* */

  get isOutdated() {
    const packageVersion = tspPackageJSON.version;
    return semver.gt(packageVersion, this.tspVersion);
  }

  toHeader() {
    const lines = JSON.stringify(this, null, 2)
      .split('\n')
      .map(line => `/// ${line}`)
      .join('\n');

    return `${tspHeaderBlockStart}\n${lines}\n${tspHeaderBlockStop}`;
  }

  static fromHeader(header: string | string[]) {
    const headerLines = Array.isArray(header) ? header : header.split('\n');

    let patchDetail: PatchDetail | undefined;
    const startIdx = headerLines.findIndex(line => line === tspHeaderBlockStart) + 1;
    let endIdx = headerLines.findIndex(line => line === tspHeaderBlockStop);
    if (endIdx === -1) headerLines.length;
    if (startIdx && endIdx) {
      const patchInfoStr = headerLines
        .slice(startIdx, endIdx)
        .map(line => line.replace('/// ', ''))
        .join('\n');
      patchDetail = Object.assign(new PatchDetail(), JSON.parse(patchInfoStr) as PatchDetail);
    }

    return patchDetail;
  }

  static fromModule(tsModule: TsModule, patchedContent: string, patches: PatchDetail.PatchEntry[] = []) {
    patches.unshift({ library: 'ts-patch', patchName: corePatchName, version: tspPackageJSON.version });

    const patchDetail = {
      tsVersion: tsModule.package.version,
      tspVersion: tspPackageJSON.version,
      patchDetailVersion: currentPatchDetailVersion,
      moduleName: tsModule.moduleName,
      originalHash: tsModule.cacheKey,
      hash: getHash(patchedContent),
      patches: patches
    } satisfies Omit<PatchDetail, 'toHeader' | 'isOutdated'>

    return Object.assign(new PatchDetail(), patchDetail);
  }

  // endregion
}

// endregion
