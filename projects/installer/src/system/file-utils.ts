import path from 'path';
import fs from 'fs';
import { getTsPackage } from '../ts-package';
import { PackageError } from './errors';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

/**
 * Attempts to locate global installation of TypeScript
 */
export function getGlobalTsDir() {
  const errors = [];
  const dir = require('global-prefix');
  const check = (dir: string) => {
    try { return getTsPackage(dir) }
    catch (e) {
      errors.push(e);
      return <any>{};
    }
  };

  const { packageDir } = (check(dir) || check(path.join(dir, 'lib')));

  if (!packageDir)
    throw new PackageError(`Could not find global TypeScript installation! Are you sure it's installed globally?`);

  return packageDir;
}


export const mkdirIfNotExist = (dir: string) => !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });

// endregion
