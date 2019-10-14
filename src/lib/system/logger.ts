import chalk from 'chalk';
import { appOptions } from './options';
import stripAnsi from 'strip-ansi';


/* ********************************************************************************************************************
 * Logger
 * ********************************************************************************************************************/

/**
 * Output log message
 */
export function Log(msg: string | [string, string], logLevel: typeof Log[keyof typeof Log] = Log.normal) {
  if (logLevel > appOptions.logLevel) return;
  const { color, instanceIsCLI } = appOptions;

  /* Handle Icon */
  const printIcon = (icon:string) => chalk.bold.cyanBright(`[${ icon }] `);

  let icon: string = '';
  if (Array.isArray(msg)) {
    icon = msg[0];
    msg = (icon === '!') ? printIcon(chalk.bold.yellow(icon)) + chalk.yellow(msg[1]) :
      (icon === '~') ? printIcon(chalk.bold.cyanBright(icon)) + msg[1] :
      (icon === '=') ? printIcon(chalk.bold.greenBright(icon)) + msg[1] :
      (icon === '+') ? printIcon(chalk.bold.green(icon)) + msg[1] :
      (icon === '-') ? printIcon(chalk.bold.white(icon)) + msg[1] :
        msg[1];
  }
  const isError = (icon === '!');

  /* Print message */
  msg = !color ? stripAnsi(msg) : msg;

  if (!instanceIsCLI) console.log(msg);
  else if (isError) process.stderr.write(msg + '\r\n');
  else process.stdout.write(msg + '\r\n');
}

/** Log Levels **/
export namespace Log {
  export const system = 0;
  export const normal = 1;
  export const verbose = 2;
}