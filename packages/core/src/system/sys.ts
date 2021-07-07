/**
 * Note: Some logic and naming convention based on TypeScript compiler's 'sys' code
 */
import fs from 'fs'
import path from 'path'
import * as crypto from 'crypto';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export namespace sys {
  export enum FileSystemEntryKind {
    Unknown = 'unknown',
    File = 'file',
    Directory = 'directory'
  }

  export interface FileSystemEntryDetail {
    kind: FileSystemEntryKind
    isSymlink: boolean
    mtime: Date
  }

  export interface FileSystemEntries {
    readonly files: readonly string[];
    readonly directories: readonly string[];
  }

  export interface CreateSymLinkOptions {
    /**
     * Recreate if exists
     * @default true
     */
    recreate: boolean

    /**
     * Create dirs if missing
     * @default true
     */
    createDirs: boolean

    /**
     * Specify type
     * @default (autodetected based on target)
     */
    type: 'file' | 'dir'
  }
}

// endregion


/* ****************************************************************************************************************** */
// region: System Utilities & Properties
/* ****************************************************************************************************************** */

export namespace sys {
  const getContext = (thisVal: any) => thisVal === globalThis ? sys : thisVal;

  /* ********************************************************* */
  // region: Public Utilities
  /* ********************************************************* */

  export function readFile(fileName: string, encoding?: BufferEncoding): string | undefined {
    let buffer: Buffer;
    try {
      buffer = fs.readFileSync(fileName);
    }
    catch (e) {
      return undefined;
    }

    if (encoding) return buffer.toString(encoding);

    let len = buffer.length;

    // Handle Big endian UTF-16 - Since big endian is not supported by node.js, flip byte pairs and treat as little
    // endian.
    if (len >= 2 && buffer[0] === 0xFE && buffer[1] === 0xFF) {
      len &= ~1; // Round down to a multiple of 2
      for (let i = 0; i < len; i += 2) {
        const temp = buffer[i];
        buffer[i] = buffer[i + 1];
        buffer[i + 1] = temp;
      }

      return buffer.toString('utf16le', 2);
    }

    // Handle Little endian UTF-16
    if (len >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
      return buffer.toString('utf16le', 2);
    }

    // Handle UTF-8
    if (len >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return buffer.toString('utf8', 3);
    }

    // Default is UTF-8 with no byte order mark
    return buffer.toString('utf8');
  }

  export function writeFile(fileName: string, data: string): void {
    let fd: number | undefined;

    try {
      fd = fs.openSync(fileName, 'w');
      fs.writeSync(fd, data, undefined, 'utf8');
    }
    finally {
      if (fd !== undefined) fs.closeSync(fd);
    }
  }

  export function fileExists(this: typeof sys, path: string): boolean {
    return getContext(this).getFileSystemEntryDetail(path)?.kind === FileSystemEntryKind.File;
  }

  export function directoryExists(this: typeof sys, path: string): boolean {
    return getContext(this).getFileSystemEntryDetail(path)?.kind === FileSystemEntryKind.Directory;
  }

  export function isSymLink(this: typeof sys, path: string): boolean {
    return !!getContext(this).getFileSystemEntryDetail(path)?.isSymlink;
  }

  export function getDirectories(this: typeof sys, path: string): string[] {
    return getContext(this).getFileSystemEntries(path).directories.slice();
  }

  export function realpath(path: string): string {
    try {
      return fs.realpathSync(path);
    }
    catch {
      return path;
    }
  }

  export function getModifiedTime(this: typeof sys, path: string) {
    return getContext(this).getFileSystemEntryDetail(path)?.mtime;
  }

  export function setModifiedTime(path: string, time: Date) {
    try {
      fs.utimesSync(path, time, time);
    }
    catch (e) {
      return;
    }
  }

  export function deleteFile(path: string): void {
    try {
      return fs.unlinkSync(path);
    }
    catch (e) {
      return;
    }
  }

  export const isWindows = () => process.platform === 'win32' || [ 'msys', 'cygwin' ].includes(<string>process.env.OSTYPE);

  export function createSHA256Hash(data: string): string {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  /**
   * Create a symbolic link
   */
  export function createSymLink(this: typeof sys, target: string, dest: string, options?: CreateSymLinkOptions): void {
    const ctx = getContext(this);

    const opt: CreateSymLinkOptions = {
      recreate: true,
      createDirs: true,
      type: <any>void 0,
      ...options
    };

    if (!opt.type) {
      const targetKind = ctx.getFileSystemEntryDetail(target)?.kind;
      switch (targetKind) {
        case FileSystemEntryKind.File:
          opt.type = 'file';
          break;
        case FileSystemEntryKind.Directory:
          opt.type = 'dir';
          break;
        default:
          throw new Error(`Cannot create symbolic link for ${target}. Not a file or directory!`);
      }
    }

    const linkType: fs.symlink.Type = (opt.type === 'dir' && ctx.isWindows()) ? 'junction' : opt.type;

    try {
      fs.symlinkSync(target, dest, linkType);
    }
    catch (e) {
      const errorHeader = `Error while trying to symlink "${target}" to "${dest}". `;

      // Inspiration credit to https://github.com/zkochan/symlink-dir/blob/main/src/index.ts
      switch ((<NodeJS.ErrnoException>e).code) {
        case 'ENOENT':
          if (!opt.createDirs) throw new Error(errorHeader + `Destination already exists!`);

          try {
            fs.mkdirSync(path.dirname(dest), { recursive: true })
          }
          catch (mkdirError) {
            mkdirError.message = errorHeader + `Could not make directories for dest. Details: ${mkdirError}`
            throw mkdirError
          }
          break;
        case 'EEXIST':
        case 'EISDIR':
          if (!opt.recreate) throw new Error(errorHeader + `Destination already exists!`);

          fs.unlinkSync(dest);
          break
        default:
          e.message = errorHeader + ` Detail: ${e}`
          throw e;
      }

      // Retry
      ctx.createSymLink.apply(ctx, Array.from(arguments) as any);
    }
  }

  export function getFileSystemEntries(dir: string): FileSystemEntries {
    try {
      const entries = fs.readdirSync(dir || '.', { withFileTypes: true });
      const files: string[] = [];
      const directories: string[] = [];

      for (const entry of entries) {
        const entryName = entry.name;

        // This is necessary because on some file system node fails to exclude
        // "." and "..". See https://github.com/nodejs/node/issues/4002
        if (entryName === '.' || entryName === '..') continue;

        let stat: any;
        if (entry.isSymbolicLink()) {
          const name = path.join(dir, entryName);

          try {
            stat = fs.statSync(name);
          }
          catch (e) {
            continue;
          }
        } else {
          stat = entry;
        }

        if (stat.isFile()) {
          files.push(entryName);
        } else if (stat.isDirectory()) {
          directories.push(entryName);
        }
      }

      files.sort();
      directories.sort();

      return { files, directories };
    }
    catch (e) {
      return {
        files: [] as never[],
        directories: [] as never[]
      };
    }
  }

  export function getFileSystemEntryDetail(path: string): undefined | FileSystemEntryDetail {
    // Since the error thrown by fs.statSync isn't used, we can avoid collecting a stack trace to improve
    // the CPU time performance.
    const originalStackTraceLimit = Error.stackTraceLimit;
    Error.stackTraceLimit = 0;

    try {
      const stat = fs.statSync(path);
      const kind = stat.isFile() ? FileSystemEntryKind.File :
                   stat.isDirectory() ? FileSystemEntryKind.Directory :
                   FileSystemEntryKind.Unknown;

      return {
        kind,
        isSymlink: stat.isSymbolicLink(),
        mtime: stat.mtime
      }
    }
    catch (e) {
      return void 0;
    }
    finally {
      Error.stackTraceLimit = originalStackTraceLimit;
    }
  }

  // endregion
}

// endregion
