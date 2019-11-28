/* ********************************************************************************************************************
 * Errors Classes
 * ********************************************************************************************************************/

export class WrongTSVersion extends Error {name = 'WrongTSVersion'}

export class FileNotFound extends Error {name = 'FileNotFound'}

export class PackageError extends Error {name = 'PackageError'}

export class PatchError extends Error {name = 'PatchError'}

export class PersistenceError extends Error {name = 'PersistenceError'}

export class OptionsError extends Error {name = 'OptionsError'}

export class NPMError extends Error {name = 'NPMError'}

export class RestoreError extends Error {
  constructor(public filename: string, message: string) {
    super(`Error restoring: ${filename}${message ? ' - ' + message : ''}`);
    this.name = 'RestoreError';
  }
}

export class BackupError extends Error {
  constructor(public filename: string, message: string) {
    super(`Error backing up ${filename}${message ? ' - ' + message : ''}`);
    this.name = 'BackupError';
  }
}

export class FileWriteError extends Error {
  constructor(public filename: string, message: string) {
    super(`Error while trying to write to ${filename}${message && `: ${message}`}`);
  }
}
