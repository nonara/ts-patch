import fs from 'fs';
import crypto from 'crypto';


/* ****************************************************************************************************************** */
// region: Locals
/* ****************************************************************************************************************** */

type ReadFileResult = { content: string, hash: string };
const readFileCache = new Map<string, ReadFileResult>();

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function readFile(filePath: string, skipCache: boolean = false): ReadFileResult {
  if (!skipCache && readFileCache.has(filePath)) return readFileCache.get(filePath)!;

  const content = fs.readFileSync(filePath, 'utf8');
  const hash = crypto.createHash('md5').update(content).digest('hex');
  const result = { content, hash };

  readFileCache.set(filePath, result);

  return result;
}

// endregion
