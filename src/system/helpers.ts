import path from "path";
import fs from "fs";
import resolve = require('resolve');
import { FileNotFound, PackageError } from './errors';


/* ********************************************************************************************************************
 * General
 * ********************************************************************************************************************/
// region General

/**
 * Determine if path is absolute (works on windows and *nix)
 */
export const isAbsolute = (sPath: string) =>
  path.resolve(sPath) === path.normalize(sPath).replace(RegExp(path.sep + '$'), '');

/**
 * Filter object to only include entries by keys (Based on TypeScript Pick)
 * @param obj - Object to filter
 * @param keys - Keys to extract
 * @example
 * let obj = { a: 1, b: 2, c: '3' }     // Type is { a: number, b: number, c: string }
 * obj = pick(obj, 'a', 'b')            // Type is { a: number, c: string }
 */
export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  return {
    ...keys.reduce((p, key) => ({
      ...p,
      ...((obj as any).hasOwnProperty(key) && { [key]: obj[key] })
    }), {})
  } as Pick<T, K>;
}

/**
 * Type mapping for Object.keys
 */
export const getKeys = <T>(obj: T): Array<keyof T> => Object.keys(obj) as Array<keyof T>;

// endregion


/* ********************************************************************************************************************
 * File & Directory
 * ********************************************************************************************************************/
// region File & Directory

interface TSInfo { version: string, packageFile: string, packageDir: string, libDir: string }
const tsInfoCache = new Map<string,TSInfo>();

/**
 * Try to resolve typescript package in basedir and return package info (throws if not cannot find ts package)
 */
export function getTSInfo(basedir: string = process.cwd(), noCache: boolean = false): TSInfo {
  if (!fs.existsSync(basedir)) throw new PackageError(`${basedir} is not a valid directory`);

  const packageDir = path.dirname(resolve.sync('typescript/package.json', { basedir }));
  if (!packageDir) throw new PackageError(`Could not find typescript package in ${packageDir}`);

  /* Return from cache if already loaded */
  if (!noCache && tsInfoCache.has(packageDir)) return tsInfoCache.get(packageDir)!;

  /* Parse package.json data */
  const packageFile = path.join(packageDir,'package.json');
  const {name, version} = (() => {
    try {
      return JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    } catch (e) {
      throw new PackageError(`Could not parse json data in ${packageFile}`);
    }
  })();

  /* Validate */
  if (name !== 'typescript')
    throw new PackageError(`The package in ${packageDir} is not TypeScript. Found: ${name}.`);

  /* Construct result & save to cache */
  const res = {version, packageFile, packageDir, libDir: path.join(packageDir, 'lib')};
  tsInfoCache.set(packageDir, res);

  return res;
}

/**
 * Attempts to locate global installation of TypeScript
 */
export const getGlobalTSDir = () => {
  const errors = [];
  const basedir = require('global-prefix');
  const check = (dir: string) => { try { return getTSInfo(dir) } catch (e) { errors.push(e); return <any>{}; } };

  const { packageDir } = (check(basedir) || check(path.join(basedir, 'lib')));

  if (!packageDir)
    throw new PackageError(`Could not find global TypeScript installation! Are you sure it's installed globally?`);

  return packageDir;
};

/**
 * Check if module can be patched, and if it is, get its version
 */
export function getModuleInfo(moduleFile: string, includeSrc: boolean = false):
  {canPatch: boolean, patchVersion: string | false | null, moduleSrc?: string}
{
  if (!fs.existsSync(moduleFile)) throw new FileNotFound(`Could not find file ${moduleFile}.`);

  const fileData = fs.readFileSync(moduleFile, 'utf8');
  const canPatch = Boolean(fileData.match(/^\(function\s\(ts\)\s?{[\s\S]+?\(ts\s?\|\|\s?\(ts\s?=\s?{}\)\);?$/m));
  const patchVersion =
    canPatch && (fileData.match(/(?<=^\s*?tsPatch.version\s?=\s?['"`])\S+?(?=['"`])/m) || [])[0];

  return {canPatch, patchVersion, ...(includeSrc && {moduleSrc: fileData})};
}

/**
 * Get absolute path for module file
 */
export const getModuleAbsolutePath = (filename: string, libDir: string) => {
  let file = isAbsolute(filename) ? filename : path.join(libDir, filename);
  if (path.extname(file) !== '.js') file = path.join(path.dirname(file), `${path.basename(file, path.extname(file))}.js`);

  return file;
};


// endregion