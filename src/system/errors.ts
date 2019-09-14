
/* ********************************************************************************************************************
 * Errors Classes
 * ********************************************************************************************************************/

export class WrongTSVersion extends Error { name = 'WrongTSVersion' }
export class FileNotFound extends Error { name = 'FileNotFound' }
export class PackageError extends Error { name = 'PackageError'  }
export class PatchError extends Error { name = 'PatchError' }
export class OptionsError extends Error { name = 'OptionsError' }

export class RestoreError extends Error {
  constructor(public filename: string, public message: string) {
    super(`Error restoring ${filename}${message ? ' - '+message : ''}`);
    this.name = 'RestoreError';
  }
}

export class TaskError extends Error {
  name = 'TaskError';

  constructor(task: string, message: string) {
    super(`Error while trying to ${task}${message && `: ${message}`}.`);
  }
}

export class FileWriteError extends Error {
  constructor(filename: string, message:string) {
    super(`Error while trying to write to ${filename}${message && `: ${message}`}`);
  }
}
