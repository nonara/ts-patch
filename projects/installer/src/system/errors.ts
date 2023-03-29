/* ********************************************************************************************************************
 * Errors Classes
 * ********************************************************************************************************************/

export class TspError extends Error { }

export class WrongTSVersion extends TspError {name = 'WrongTSVersion'}

export class FileNotFound extends TspError {name = 'FileNotFound'}

export class PackageError extends TspError {name = 'PackageError'}

export class PatchError extends TspError {name = 'PatchError'}

export class PersistenceError extends TspError {name = 'PersistenceError'}

export class OptionsError extends TspError {name = 'OptionsError'}

export class NPMError extends TspError {name = 'NPMError'}

export class RestoreError extends TspError {
  constructor(public filename: string, message: string) {
    super(`Error restoring: ${filename}${message ? ' - ' + message : ''}`);
    this.name = 'RestoreError';
  }
}

export class BackupError extends TspError {
  constructor(public filename: string, message: string) {
    super(`Error backing up ${filename}${message ? ' - ' + message : ''}`);
    this.name = 'BackupError';
  }
}

export class FileWriteError extends TspError {
  constructor(public filename: string, message?: string) {
    super(`Error while trying to write to ${filename}${message ? `: ${message}` : ''}`);
  }
}
