import chalk from 'chalk';
import stripAnsi from 'strip-ansi';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export enum LogLevel {
  system = 0,
  normal = 1,
  verbose = 2,
}

export type Logger = (msg: string | [ string, string ], logLevel?: LogLevel) => void;

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function createLogger(logLevel: LogLevel, useColour: boolean = true, isSilent: boolean = false): Logger {
  return function log(msg: string | [ string, string ], msgLogLevel: LogLevel = LogLevel.normal) {
    if (isSilent || msgLogLevel > logLevel) return;

    /* Handle Icon */
    const printIcon = (icon: string) => chalk.bold.cyanBright(`[${icon}] `);

    let icon: string = '';
    if (Array.isArray(msg)) {
      icon = msg[0];

      // @formatter:off
      msg = (icon === '!') ? printIcon(chalk.bold.yellow(icon)) + chalk.yellow(msg[1]) :
        (icon === '~') ? printIcon(chalk.bold.cyanBright(icon)) + msg[1] :
        (icon === '=') ? printIcon(chalk.bold.greenBright(icon)) + msg[1] :
        (icon === '+') ? printIcon(chalk.bold.green(icon)) + msg[1] :
        (icon === '-') ? printIcon(chalk.bold.white(icon)) + msg[1] :
        msg[1];
      // @formatter:on
    }

    /* Print message */
    const isError = (icon === '!');

    msg = !useColour ? stripAnsi(msg) : msg;
    (isError ? console.error : console.log)(msg);
  }
}

// endregion
