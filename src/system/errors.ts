
/* ********************************************************************************************************************
 * Errors Classes
 * ********************************************************************************************************************/

export class PackageError extends Error { name = 'PackageError'  }
export class FileCopyError extends Error { name = 'FileCopyError' }
export class PatchError extends Error { name = 'PatchError' }
export class WrongVersionError extends Error { name = 'WrongVersionError' }
export class AlreadyPatched extends Error { name = 'AlreadyPatched' }
export class FileNotFound extends Error { name = 'FileNotFound' }
export class OptionsError extends Error { name = 'OptionsError' }
export class RestoreError extends Error { name = 'RestoreError' }

export class TaskError extends Error {
  name = 'TaskError';

  constructor(task: string, message: string) {
    super(`Error while trying to ${task}${message && `: ${message}`}.`);
  }
}

export class FileWriteError extends Error {
  constructor(filename: string, message:string) {
    super(`Error while trying to write to ${filename}. ${message}`);
  }
}
