import fs from 'fs';
import path from 'path';
import resolve from 'resolve';
import { PackageError } from '../system';
import { getTsModule, TsModule } from '../ts-module';
import { getPatchInfo, PatchInfo } from './patch-info';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface TsPackage {
  majorVer: number
  minorVer: number
  version: string
  packageFile: string
  packageDir: string
  cacheDir: string
  libDir: string

  moduleNames: TsModule.Name[]
  modulePatchInfo: Map<TsModule.Name | string, PatchInfo | undefined>
  getModule: (name: TsModule.Name | string, skipCache?: boolean) => TsModule

  /** @internal */
  moduleCache: Map<TsModule.Name | string, TsModule>
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

/**
 * Get TypeScript package info - Resolve from dir, throws if not cannot find TS package
 */
export function getTsPackage(dir: string = process.cwd()): TsPackage {
  if (!fs.existsSync(dir)) throw new PackageError(`${dir} is not a valid directory`);

  const possiblePackageDirs = [ dir, () => path.dirname(resolve.sync(`typescript/package.json`, { basedir: dir })) ];

  for (const d of possiblePackageDirs) {
    let packageDir: string;
    try {
      packageDir = typeof d === 'function' ? d() : d;
    } catch {
      break;
    }

    /* Parse package.json data */
    const packageFile = path.join(packageDir, 'package.json');
    if (!fs.existsSync(packageFile)) continue;

    const { name, version } = (() => {
      try {
        return JSON.parse(fs.readFileSync(packageFile, 'utf8'));
      }
      catch (e) {
        throw new PackageError(`Could not parse json data in ${packageFile}`);
      }
    })();

    /* Validate */
    if (name === 'typescript') {
      const [ sMajor, sMinor ] = version.split('.')
      const libDir = path.join(packageDir, 'lib');
      const cacheDir = path.resolve(packageDir, '../.tsp/cache/');

      /* Get all available module names in libDir */
      const moduleNames: TsModule.Name[] = [];
      for (const fileName of fs.readdirSync(libDir))
        if (TsModule.names.includes(fileName as TsModule.Name)) moduleNames.push(fileName as TsModule.Name);

      const res: TsPackage = {
        version,
        majorVer: +sMajor,
        minorVer: +sMinor,
        packageFile,
        packageDir,
        moduleNames,
        cacheDir,
        libDir,
        moduleCache: new Map(),
        modulePatchInfo: new Map(),
        getModule: (moduleName: TsModule.Name | string, skipCache?: boolean) => getTsModule(res, moduleName, skipCache)
      }

      /* Get patch info for each module */
      for (const moduleName of moduleNames) res.modulePatchInfo.set(moduleName, getPatchInfo(res, moduleName));

      return res;
    }
  }

  throw new PackageError(`Could not find typescript package from ${dir}`);
}

// endregion
