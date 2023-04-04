import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import { cliCommandsConfig } from './commands';
import { cliOptionsConfig } from './options';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const LINE_INDENT = '\r\n\t';
const COL_WIDTH = 45;

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getHelpMenu() {
  return LINE_INDENT + chalk.bold.blue('ts-patch [command] ') + chalk.blue('<options>') + '\r\n' + LINE_INDENT +

    // Commands
    Object
      .entries(cliCommandsConfig)
      .map(([ cmd, { short, caption, paramCaption } ]) => formatLine([ cmd, short ], caption, paramCaption))
      .join(LINE_INDENT) +

    // Options
    '\r\n' + LINE_INDENT + chalk.bold('Options') + LINE_INDENT +
    Object
      .entries(cliOptionsConfig)
      .map(([ long, { short, inverse, caption, paramCaption } ]) => formatLine([
        short && `${chalk.cyanBright('-' + short)}`,
        long && `${chalk.cyanBright(`${inverse ? '--no-' : '--'}${long}`)}`
      ], caption, paramCaption))
      .join(LINE_INDENT);

  function formatLine(left: (string | undefined)[], caption: string, paramCaption: string = '') {
    const leftCol = left.filter(Boolean).join(chalk.blue(', ')) + ' ' + chalk.yellow(paramCaption);
    const dots = chalk.grey('.'.repeat(COL_WIDTH - stripAnsi(leftCol).length));

    return `${leftCol} ${dots} ${caption}`;
  }
}

// endregion
