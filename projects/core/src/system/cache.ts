import path from 'path';
import * as os from 'os';
import { findCacheDirectory } from '../utils';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getCacheRoot() {
  return process.env.TSP_CACHE_DIR || findCacheDirectory({ name: 'tsp' }) || path.join(os.tmpdir(), 'tsp');
}

export function getCachePath(key: string, ...p: string[]) {
  return path.resolve(getCacheRoot(), key, ...p);
}

// endregion
