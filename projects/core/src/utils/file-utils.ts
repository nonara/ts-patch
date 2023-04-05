import path from 'path';
import fs from 'fs';
import { getTsPackage } from '../ts-package';
import { getLockFilePath, PackageError } from '../system';
import { getHash } from './general';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const lockFileWaitMs = 2_000;

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function waitForLockRelease(lockFilePath: string) {
  const start = Date.now();
  while (fs.existsSync(lockFilePath)) {
    sleep(100);

    if ((Date.now() - start) > lockFileWaitMs)
      throw new Error(
        `Could not acquire lock to write file. If problem persists, run ts-patch clear-cache and try again.
      `);
  }

  function sleep(ms: number) {
    const wakeUpTime = Date.now() + ms;
    while (Date.now() < wakeUpTime) {}
  }
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

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

export function withFileLock<T>(filePath: string, fn: () => T): T {
  const lockFileName = getHash(filePath) + '.lock';
  const lockFilePath = getLockFilePath(lockFileName);
  try {
    waitForLockRelease(lockFilePath);
    fs.writeFileSync(lockFilePath, '');
    return fn();
  } finally {
    fs.unlinkSync(lockFilePath);
  }
}

export function writeFileWithLock(filePath: string, content: string): void {
  withFileLock(filePath, () => {
    fs.writeFileSync(filePath, content);
  });
}

export function readFileWithLock(filePath: string): string {
  return withFileLock(filePath, () => {
    return fs.readFileSync(filePath, 'utf8');
  });
}

export function copyFileWithLock(src: string, dest: string): void {
  withFileLock(src, () => {
    withFileLock(dest, () => {
      fs.copyFileSync(src, dest);
    });
  });
}

// endregion
