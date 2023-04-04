import fs from "fs";
import path from "path";
import * as os from "os";


/* ****************************************************************************************************************** */
// region: Locals
/* ****************************************************************************************************************** */

let cachePath: string | undefined;

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getCacheRoot() {
  if (!cachePath) {
    const envCachePath = process.env.TSP_CACHE_PATH;
    if (envCachePath) {
      cachePath = envCachePath;
    } else {
      const homeDir = os.homedir();
      cachePath = path.join(homeDir, '.tsp');
    }
  }

  return cachePath;
}

export function getCachePath(key: string, ...p: string[]) {
  return path.resolve(getCacheRoot(), key, ...p);
}

// endregion
