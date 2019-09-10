
/* ********************************************************************************************************************
 * Errors Classes
 * ********************************************************************************************************************/

export class PackageError extends Error { }
export class FileCopyError extends Error { }
export class PatchError extends Error { }
export class AlreadyPatched extends Error { }
export class FileNotFound extends Error { }

export class TaskError extends Error {
  constructor(task: string, message: string) {
    super(`Error while trying to ${task}${message && `: ${message}`}.`);
  }
}

export class FileWriteError extends Error {
  constructor(filename: string, message:string) {
    super(`Error while trying to write to ${filename}. ${message}`);
  }
}
