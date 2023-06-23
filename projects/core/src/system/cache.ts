import path from 'path';
import * as os from 'os';
import { findCacheDirectory } from '../utils';
import { appRoot, lockFileDir } from '../config';
import fs from 'fs';


/* ****************************************************************************************************************** */
// region: Locals
/* ****************************************************************************************************************** */

let cacheRoot: string | undefined;
let lockFileRoot: string | undefined;

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getCacheRoot() {
  if (!cacheRoot) {
    cacheRoot =
      process.env.TSP_CACHE_DIR ||
      findCacheDirectory({ name: 'ts-patch', cwd: path.resolve(appRoot, '..') }) ||
      path.join(os.tmpdir(), 'ts-patch');

    if (!fs.existsSync(cacheRoot)) fs.mkdirSync(cacheRoot, { recursive: true });
  }

  return cacheRoot;
}

export function getCachePath(key: string, ...p: string[]) {
  return path.resolve(getCacheRoot(), key, ...p);
}

export function getLockFilePath(key: string) {
  if (!lockFileRoot) {
    lockFileRoot = path.join(getCacheRoot(), lockFileDir);
    if (!fs.existsSync(lockFileRoot)) fs.mkdirSync(lockFileRoot, { recursive: true });
  }

  return path.join(getCacheRoot(), lockFileDir, key);
}

// endregion
