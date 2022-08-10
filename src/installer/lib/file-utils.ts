import path from 'path';
import fs from 'fs';
import {
  appOptions, defineProperties, FileNotFound, FileWriteError, isAbsolute, Log, PackageError, tspPackageJSON
} from './system';
import resolve from 'resolve';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

/**
 * Attempts to locate global installation of TypeScript
 */
export const getGlobalTSDir = () => {
  const errors = [];
  const dir = require('global-prefix');
  const check = (dir: string) => {
    try { return getTSPackage(dir) }
    catch (e) {
      errors.push(e);
      return <any>{};
    }
  };

  const { packageDir } = (check(dir) || check(path.join(dir, 'lib')));

  if (!packageDir)
    throw new PackageError(`Could not find global TypeScript installation! Are you sure it's installed globally?`);

  return packageDir;
};

/**
 * Get absolute path for module file
 */
export const getModuleAbsolutePath = (filename: string, libDir: string) => {
  let file = isAbsolute(filename) ? filename : path.join(libDir, filename);
  if (path.extname(file) !== '.js') file = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.js`);

  return file;
};

export const mkdirIfNotExist = (dir: string) => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });

const isOutOfDate = (version: any) => {
  const currentVer = tspPackageJSON.version.match(/(\d+)\.(\d+)\.(\d+)/);
  // noinspection JSUnusedLocalSymbols
  const [ f, major, minor, patch ] = String(version).match(/(\d+)\.(\d+)\.(\d+)/) || [] as string[];

  return (isNaN(+major) || isNaN(+minor) || isNaN(+patch)) ||
    (currentVer?.[1] > major) || (currentVer?.[2] > minor) || (currentVer?.[3] > patch);
}

// endregion


/* ********************************************************************************************************************
 * TS Package
 * ********************************************************************************************************************/

// region TS Package

export interface TSPackage {
  version: string,
  packageFile: string,
  packageDir: string,
  config: TSPConfig,
  libDir: string
}

/**
 * Get TypeScript package info - Resolve from dir, throws if not cannot find TS package
 */
export function getTSPackage(dir: string = process.cwd()): TSPackage {
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
    if (name === 'typescript')
      return { version, packageFile, packageDir, config: getConfig(packageDir), libDir: path.join(packageDir, 'lib') };
  }

  throw new PackageError(`Could not find typescript package from ${dir}`);
}

// endregion


/* ********************************************************************************************************************
 * TS Module
 * ********************************************************************************************************************/

// region TS Module

export interface TSModule {
  filename: string,
  file: string,
  dir: string,
  canPatch: boolean,
  patchVersion: string | false | null,
  moduleSrc?: string
  outOfDate: boolean
}

/**
 * Get TypeScript module info
 */
export function getTSModule(file: string, includeSrc: boolean = false): TSModule {
  if (!fs.existsSync(file)) throw new FileNotFound(`Could not find file ${file}.`);

  const filename = path.basename(file);
  const dir = path.dirname(file);
  const fileData = fs.readFileSync(file, 'utf8');
  const canPatch = Boolean(fileData.match(/^\(function\s\(ts\)\s?{[\s\S]+?\(ts\s?\|\|\s?\(ts\s?=\s?{}\)\);?$/m));
  const patchVersion =
    canPatch && (
      fileData.match(/^\/\/\/\s*tsp:\s*(\S+)/s) ||
      fileData.match(/(?<=^\s*?var\stspVersion\s?=\s?['"`])(\S+?)(?=['"`])/m) ||
      []
    )[1];

  const outOfDate = isOutOfDate(patchVersion);

  return { file, filename, canPatch, dir, patchVersion, outOfDate, ...(includeSrc && canPatch && { moduleSrc: fileData }) };
}

// endregion


/* ********************************************************************************************************************
 * TSP Config
 * ********************************************************************************************************************/

// region TSP Config

export interface TSPConfig {
  readonly file: string,
  readonly version: string,
  modules: { [x: string]: number }

  save: Function;
}

/**
 * Load tsp config file data from TS package directory
 */
function getConfig(packageDir: string) {
  const configFile = path.join(packageDir, 'ts-patch.json');

  /* Load config file */
  let fileData = <Partial<TSPConfig>>{};
  if (fs.existsSync(configFile)) {
    try {
      fileData = JSON.parse(fs.readFileSync(configFile, 'utf8'));
    }
    catch (e) {
      if (appOptions.instanceIsCLI) console.warn(e);
      else Log([ '!', e.message ], Log.verbose)
    }
  }

  const config: TSPConfig = {
    modules: {},
    ...fileData,
    version: fileData.version || tspPackageJSON.version,
    file: configFile,
    save() { saveConfig(this) }
  };

  return defineProperties(config, {
    version: { writable: false },
    file: { enumerable: false, writable: false }
  });
}

function saveConfig(config: TSPConfig) {
  try {
    fs.writeFileSync(config.file, JSON.stringify(config, null, 2));
  }
  catch (e) {
    throw new FileWriteError(config.file, e.message);
  }
}

// endregion
