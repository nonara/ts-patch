import path from 'path';
import fs from 'fs';


/* ********************************************************************************************************************
 * General Helpers
 * ********************************************************************************************************************/

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
 * Fully typed Object.keys
 */
export const getKeys = <T>(obj: T): Array<keyof T> => Object.keys(obj) as Array<keyof T>;

type GetDescriptorType<T extends PropertyDescriptor & { initializer?: (...args: any[]) => any }> =
  'value' extends keyof T ? T['value'] :
  T['get'] extends Function ? ReturnType<T['get']> :
  T['set'] extends Function ? Parameters<T['set']>[0] :
  T['initializer'] extends Function ? ReturnType<T['initializer']> :
  never;

/**
 * Fully typed Object.defineProperties
 */
export function defineProperties<TObj, TProps extends Record<PropertyKey, PropertyDescriptor>>(obj: TObj, properties: TProps):
  TObj & { [K in keyof TProps]: GetDescriptorType<TProps[K]> } {
  return Object.defineProperties(obj, properties) as any;
}


/* ********************************************************************************************************************
 * TS Patch
 * ********************************************************************************************************************/

/**
 * Root directory for ts-patch
 */
export const appRoot = (() => {
  const moduleDir = path.join(__dirname, '../..');

  const chkFile = (pkgFile: string) =>
    (fs.existsSync(pkgFile) && (require(pkgFile).name === 'ts-patch')) ? path.dirname(pkgFile) : void 0;

  const res = chkFile(path.join(moduleDir, 'package.json')) || chkFile(path.join(moduleDir, '../..', 'package.json'));

  if (!res) throw new Error(`Error getting app root. No valid ts-patch package file found.`);

  return res;
})();

/**
 * Package json for ts-patch
 */
export const tspPackageJSON = require(path.resolve(appRoot, 'package.json'));
