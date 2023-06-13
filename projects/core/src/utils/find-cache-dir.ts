/**
 * @credit https://github.com/sindresorhus/find-cache-di
 * @license MIT
 * @author Sindre Sorhus
 * @author James Talmage
 *
 * MIT License
 *
 * Copyright (c) Sindre Sorhus <sindresorhus@gmail.com> (https://sindresorhus.com)
 * Copyright (c) James Talmage <james@talmage.io> (https://github.com/jamestalmage)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import process from 'node:process';
import path from 'node:path';
import fs from 'node:fs';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface FindCacheDirOptions {
  name: string;
  cwd?: string; // Default: process.cwd()
  create?: boolean; // Default: false
}

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

const isWritable = (path: string) => {
  try {
    fs.accessSync(path, fs.constants.W_OK);
    return true;
  }
  catch {
    return false;
  }
};

function useDirectory(directory: string, options: any) {
  if (options.create) {
    fs.mkdirSync(directory, { recursive: true });
  }

  return directory;
}

function getNodeModuleDirectory(directory: string) {
  const nodeModules = path.join(directory, 'node_modules');

  if (
    !isWritable(nodeModules)
    && (fs.existsSync(nodeModules) || !isWritable(path.join(directory)))
  ) {
    return;
  }

  return nodeModules;
}

function findNearestPackageDir(startPath: string): string | null {
  const visitedDirs = new Set<string>();
  let currentPath = path.resolve(startPath);

  while (true) {
    const packageJsonPath = path.join(currentPath, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      return path.dirname(packageJsonPath);
    }

    // Mark the current directory as visited
    visitedDirs.add(currentPath);

    // Move to the parent directory
    const parentPath = path.dirname(currentPath);

    // Check for a circular loop
    if (visitedDirs.has(parentPath) || parentPath === currentPath) {
      return null;
    }

    currentPath = parentPath;
  }
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function findCacheDirectory(options: FindCacheDirOptions) {
  /* Use ENV Cache Dir if present */
  if (process.env.CACHE_DIR && ![ 'true', 'false', '1', '0' ].includes(process.env.CACHE_DIR))
    return useDirectory(path.join(process.env.CACHE_DIR, options.name), options);

  /* Find Package Dir */
  const startDir = options.cwd || process.cwd();
  const pkgDir = findNearestPackageDir(startDir);
  if (!pkgDir) return undefined;

  /* Find Node Modules Dir */
  const nodeModules = getNodeModuleDirectory(pkgDir);
  if (!nodeModules) return undefined;

  return useDirectory(path.join(pkgDir, 'node_modules', '.cache', options.name), options);
}

// endregion
