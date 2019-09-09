import * as shell from "shelljs";


/* ********************************************************************************************************************
 * Error
 * ********************************************************************************************************************/

export class TaskError extends Error {
  constructor(task: string, message: string) {
    super((message = `Error while trying to ${task}${message && `: ${message}`}.`));
    this.message = message;
    this.name = "TaskError";
    this.stack = (<any> new Error()).stack;
  }
}

/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

/**
 * Execute a series of tasks and throw if any shelljs errors
 */
export function runTasks(tasks: { [x:string]: () => any }, verbose = false) {
  for (let [caption, task] of Object.entries(tasks)) {
    if (verbose) console.log(`[+] Running task: ${caption}`);
    if (task() && shell.error())
      throw new TaskError(caption, shell.error());
  }
}

/**
 * Output log message if not silent
 */
export const Log = (msg: string, silent?: boolean) => (!silent) && console.log(msg);
