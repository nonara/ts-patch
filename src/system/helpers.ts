import path from "path";
import fs from "fs";
import resolve = require('resolve');
import { PackageError, TaskError } from './errors';
import * as shell from 'shelljs';
import { defaultOptions, TSPOptions } from './options';


/* ********************************************************************************************************************
 * Logger
 * ********************************************************************************************************************/
/**
 * Output log message if not silent
 */
export function Log(msg: string, logLevel: typeof Log[Exclude<keyof typeof Log, 'isSilent' | 'isVerbose'>] = Log.normal) {
  if (!Log.isSilent || (logLevel === Log.system)) console.log(msg)
}

export namespace Log {
  export let isSilent: boolean = false;
  export let isVerbose: boolean = false;
  export const system = 0;
  export const normal = 1;
  export const verbose = 2;
}


/* ********************************************************************************************************************
 * General
 * ********************************************************************************************************************/

/**
 * Determine if path is absolute (works on windows and *nix)
 */
export const isAbsolute = (sPath: string) =>
  path.resolve(sPath) === path.normalize(sPath).replace(RegExp(path.sep + '$'), '');

/**
 * Execute a series of tasks and throw if any shelljs errors
 */
export function runTasks(tasks: { [x:string]: () => any }) {
  for (let [caption, task] of Object.entries(tasks)) {
    Log(`\r\n[=] Running task: ${caption}\r\n`, Log.verbose);
    if (task() && shell.error())
      throw new TaskError(caption, shell.error());
  }
}

/**
 * Filter object to only include entries by keys (Based on TypeScript Pick)
 * @param obj - Object to filter
 * @param keys - Keys to extract
 * @example
 * let obj = { a: 1, b: 2, c: '3' }     // Type is { a: number, b: number, c: string }
 * obj = pick(obj, 'a', 'b')            // Type is { a: number, c: string }
 */
export function pick<T, K extends keyof T>(obj: T, ...keys: K[]): Pick<T, K> {
  return { ...keys.reduce((p, key) => ({ ...p, [key]: (obj as any)[key] }), {}) } as Pick<T, K>;
}

export const parseOptions = (options: Partial<TSPOptions>): TSPOptions => {
  options = { ...defaultOptions, ...options };
  Object.assign(Log, { isSilent: options.silent, isVerbose: options.verbose });
  return (options as TSPOptions);
};


/* ********************************************************************************************************************
 * File Operations
 * ********************************************************************************************************************/

interface TSInfo { version: string, packageFile: string, packageDir: string, libDir: string }
const tsInfoCache = new Map<string,TSInfo>();

/**
 * Try to resolve typescript package in basedir and return package info (throws if not cannot find ts package)
 */
export function getTSInfo(basedir: string = process.cwd(), noValidateVersion: boolean = false): TSInfo {
  if (!fs.existsSync(basedir)) throw new PackageError(`${basedir} is not a valid directory`);

  const packageDir = path.dirname(resolve.sync('typescript/package.json', { basedir }));
  if (!packageDir) throw new PackageError(`Could not find typescript package in ${packageDir}`);

  /* Return from cache if already loaded */
  if (tsInfoCache.has(packageDir)) return tsInfoCache.get(packageDir)!;

  /* Parse package.json data */
  const packageFile = path.join(packageDir,'package.json');
  const {name, version} = (() => {
    try {
      return JSON.parse(fs.readFileSync(packageFile, 'utf8'));
    } catch (e) {
      throw new PackageError(`Could not parse json data in ${packageFile}`)
    }
  })();

  /* Validate */
  if (name !== 'typescript') throw new PackageError(`The package in ${packageDir} is not TypeScript. Found: ${name}.`);
  if (!noValidateVersion) {
    const [major, minor] = version;
    if (+major < 3 && +minor < 7) throw new PackageError(`ts-patch requires TypeScript v2.7 or higher.`);
  }

  /* Construct result & save to cache */
  const res = {version, packageFile, packageDir, libDir: path.join(packageDir, 'lib')};
  tsInfoCache.set(packageDir, res);

  return res;
}

/**
 * Check if module can be patched, and if it is, get its version
 */
export function getModuleInfo(moduleFile: string, includeSrc: boolean = false):
  {canPatch: boolean, patchVersion: string | false | null, moduleSrc?: string}
{
  const fileData = fs.readFileSync(moduleFile, 'utf8');
  const canPatch = Boolean(fileData.match(/^\(function\s\(ts\)\s?{[\s\S]+?\(ts\s?\|\|\s?\(ts\s?=\s?{}\)\);?$/m));
  const patchVersion =
    canPatch && (fileData.match(/(?<=^\s*?tsPatch.version\s?=\s?['"`])\S+?(?=['"`])/m) || [])[0];

  return {canPatch, patchVersion, ...(includeSrc && {moduleSrc: fileData})};
}