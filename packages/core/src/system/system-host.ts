import { sys } from './sys';
import FileSystemEntries = sys.FileSystemEntries;
import FileSystemEntryDetail = sys.FileSystemEntryDetail;
import CreateSymLinkOptions = sys.CreateSymLinkOptions;


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface SystemHost {
  /**
   * Determine if file exists on disk
   */
  fileExists(fileName: string): boolean;

  /**
   * Determine if directory exists on disk
   */
  directoryExists(directoryName: string): boolean;

  /**
   * Read file from disk
   */
  readFile(fileName: string): string | undefined;

  /**
   * Write file to disk
   */
  writeFile(fileName: string, data: string, onError?: (message: string) => void): void;

  /**
   * Read file from disk
   */
  readFile(fileName: string): string | undefined;

  /**
   * Resolve a symbolic link.
   */
  realpath(path: string): string;

  /**
   * Get CWD
   */
  getCurrentDirectory(): string;

  /**
   * Determine if path is a symlink
   */
  isSymLink(path: string): boolean

  /**
   * Get directories in path
   */
  getDirectories(path: string): string[]

  /**
   * Create symbolic link
   */
  createSymLink(target: string, path: string, options?: CreateSymLinkOptions): void

  /**
   * Determine if environment is Windows or not
   */
  isWindows(): boolean

  /**
   * Get fs entries (files, directories) in dir
   */
  getFileSystemEntries(dir: string): FileSystemEntries

  /**
   * Get stats for filesystem entry
   */
  getFileSystemEntryDetail(path: string): undefined | FileSystemEntryDetail

  /**
   * Get modified time for filesystem entry
   */
  getModifiedTime(this: typeof sys,path: string): Date | undefined

  /**
   * Delete file from filesystem
   */
  deleteFile(path: string): void
}

// endregion


/* ****************************************************************************************************************** */
// region: Utilities
/* ****************************************************************************************************************** */

export function createSystemHost(overrides?: Partial<SystemHost>): SystemHost {
  return {
    readFile: sys.readFile,
    writeFile: sys.writeFile,
    fileExists: sys.fileExists,
    directoryExists: sys.directoryExists,
    isSymLink: sys.isSymLink,
    getDirectories: sys.getDirectories,
    getModifiedTime: sys.getModifiedTime,
    deleteFile: sys.deleteFile,
    realpath: sys.realpath,
    getCurrentDirectory: () => process.cwd(),
    createSymLink: sys.createSymLink,
    isWindows: sys.isWindows,
    getFileSystemEntries: sys.getFileSystemEntries,
    getFileSystemEntryDetail: sys.getFileSystemEntryDetail,
    ...overrides
  };
}

// endregion
