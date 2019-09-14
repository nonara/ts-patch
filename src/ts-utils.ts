import path from "path";
import fs from "fs";
import resolve = require('resolve');
import { FileNotFound, PackageError, isAbsolute } from './system';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

/**
 * Attempts to locate global installation of TypeScript
 */
export const getGlobalTSDir = () => {
  const errors = [];
  const basedir = require('global-prefix');
  const check = (dir: string) => { try { return getTSPackage(dir) } catch (e) { errors.push(e); return <any>{}; } };

  const { packageDir } = (check(basedir) || check(path.join(basedir, 'lib')));

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

// endregion


/* ********************************************************************************************************************
 * TS Package
 * ********************************************************************************************************************/
// region TS Package

export interface TSPackage { version: string, packageFile: string, packageDir: string, libDir: string }

/**
 * Try to resolve typescript package in basedir and return package info (throws if not cannot find ts package)
 */
export function getTSPackage(basedir: string = process.cwd()): TSPackage {
  if (!fs.existsSync(basedir)) throw new PackageError(`${basedir} is not a valid directory`);

  const packageDir = path.dirname(resolve.sync('typescript/package.json', { basedir }));
  if (!packageDir) throw new PackageError(`Could not find typescript package in ${packageDir}`);

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

  return {version, packageFile, packageDir, libDir: path.join(packageDir, 'lib')};
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
}

/**
 * Check if module can be patched, and if it is, get its version
 */
export function getTSModule(file: string, includeSrc: boolean = false): TSModule
{
  if (!fs.existsSync(file)) throw new FileNotFound(`Could not find file ${file}.`);
  const filename = path.basename(file);
  const dir = path.dirname(file);

  const fileData = fs.readFileSync(file, 'utf8');
  const canPatch = Boolean(fileData.match(/^\(function\s\(ts\)\s?{[\s\S]+?\(ts\s?\|\|\s?\(ts\s?=\s?{}\)\);?$/m));
  const patchVersion =
    canPatch && (fileData.match(/(?<=^\s*?tsPatch.version\s?=\s?['"`])\S+?(?=['"`])/m) || [])[0];

  return { file, filename, canPatch, dir, patchVersion, ...(includeSrc && canPatch && {moduleSrc: fileData}) };
}