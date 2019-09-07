import { readFileSync } from 'fs';
import * as resolve from 'resolve';
import { patchCreateProgram } from './patcher';
import { dirname } from 'path';
import { runInThisContext } from 'vm';
import Module = require('module');
type TypeScript = typeof ts;
import * as ts from 'typescript/lib/typescript';


/* ********************************************************************************************************************
 * Loader
 * ********************************************************************************************************************/
// region Loader

type LoadTSOptions = { folder?: string; forceConfigLoad?: boolean };

/**
 * Load patched version of TypeScript
 * @param filename - Filename to patch
 * @param folder - Base typescript module folder to look in
 * @param forceConfigLoad - Force config reload
 */
export function loadTSModule(filename: string, { folder = __dirname, forceConfigLoad = false }: LoadTSOptions = {}):
  TypeScript
{
  const libFilename = resolve.sync('typescript/lib/' + filename + '.original', { basedir: folder }) ||
    resolve.sync('typescript/lib/' + filename, { basedir: folder });

  // Update cache
  if (!(libFilename in require.cache)) require.cache[libFilename] = new TypeScriptModule(libFilename);

  // Check version
  const [major, minor] = ts.versionMajorMinor.split('.');
  if (+major < 3 && +minor < 7) throw new Error('Must use typescript version 2.7 or higher.');

  return patchCreateProgram(new TypeScriptModule(libFilename).exports, forceConfigLoad);
}

// endregion


/* ********************************************************************************************************************
 * Factory
 * ********************************************************************************************************************/
// region Factory

type TypeScriptFactory = (exports: TypeScript, require:NodeRequire, module:Module, filename:string, dirname:string) => void;
const typeScriptFactoryCache = new Map<string, TypeScriptFactory>();

class TypeScriptModule extends Module {
  private _exports: TypeScript | undefined = undefined;
  public paths = module.paths.slice();
  public loaded = true;

  constructor(public filename: string) {
    super(filename, module);
  }

  get exports() { return this._exports || this._init(); }

  set exports(value: TypeScript) { this._exports = value; }

  private _init() {
    this._exports = <TypeScript>{};

    let factory = typeScriptFactoryCache.get(this.filename);
    if (!factory) {
      const code = readFileSync(this.filename, 'utf8');

      factory = (runInThisContext(`(function (exports, require, module, __filename, __dirname) {${code}\n});`, {
        filename: this.filename,
        lineOffset: 0,
        displayErrors: true,
      }) as TypeScriptFactory);

      typeScriptFactoryCache.set(this.filename, factory);
    }

    factory.call(this._exports, this._exports, require, this, this.filename, dirname(this.filename));
    return this._exports;
  }
}

// endregion