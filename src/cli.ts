#!/usr/bin/env node

import { getTSInfo, parseOptions, Log, TSPOptions, appOptions } from './system';
import minimist from 'minimist';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import * as actions from './actions'


/* ********************************************************************************************************************
 * Commands & Options
 * ********************************************************************************************************************/

type CLIOptions = Record<keyof typeof cliOptions, { flag?: string, caption: string | string[], inverse?: boolean }>;

const cliOptions = {
  silent: { flag: 's', caption: 'Run silently' },
  global: { flag: 'g', caption: 'Target global TypeScript installation' },
  verbose: { flag: 'v', caption: 'Chat it up' },
  basedir: { flag: 'd', caption: ['<dir>', 'Base directory to resolve package from'] },
  color: { inverse: true, caption: 'Strip ansi colours from output' }
};

const cliCommands = {
  install: { short: 'i', caption: 'Installs ts-patch' },
  uninstall: { short: 'u', caption: 'Restores original typescript files' },
  check: { short: 'c', caption:
      `Check patch status (use with ${chalk.cyanBright('--basedir')} to specify TS package location)`
  },
  patch: { short: void 0, caption: [
    '<module_file> | <glob>', 'Patch specific module(s) ' + chalk.yellow('(Not recommended. Use install instead)')
  ]},
  version: { short: 'v', caption: 'Show version' },
  help: { short: '/?', caption: 'Show help menu' },
};


/* ********************************************************************************************************************
 * Menu
 * ********************************************************************************************************************/
// region Menu

const SPACER = '\r\n\t';
const COL_WIDTH = 45;

const formatLine = (left: (string | undefined)[], caption: string | string[]) => {
  const paramCaption = Array.isArray(caption) && caption[0];
  const mainCaption = paramCaption ? caption[1] : caption;
  const leftColumn = left.filter(Boolean).join(chalk.blue(', ')) + (paramCaption ? ` ${chalk.yellow(paramCaption)} ` : ' ');

  return leftColumn + chalk.grey('.'.repeat(COL_WIDTH - stripAnsi(leftColumn).length)) + ' ' + mainCaption;
};

const menu =
  SPACER + chalk.bold.blue('ts-patch [command] ') + chalk.blue('<options>') + '\r\n' + SPACER +

  // Commands
  Object
    .entries(cliCommands)
    .map(([cmd, {short, caption}]) => formatLine([cmd, short], caption))
    .join(SPACER) +

  // Options
  '\r\n' + SPACER + chalk.bold('Options') + SPACER +
  Object
    .entries(<CLIOptions>cliOptions)
    .map(([long, {flag, inverse, caption}]) => formatLine([
      flag && `${chalk.cyanBright('-' + flag)}`,
      long && `${chalk.cyanBright(`${inverse ? '--no-' : '--'}${long}`)}`
    ], caption))
    .join(SPACER);


// endregion


/* ********************************************************************************************************************
 * App
 * ********************************************************************************************************************/
// region App

const instanceIsCLI = (require.main === module);

if (instanceIsCLI) run();

export function run() {
  let args = minimist(process.argv.slice(2));
  let cmd:string | undefined = args._[0] ? args._[0].toLowerCase() : void 0;

  try {
    /* Select command by short or full code */
    if (cmd) cmd = (Object.keys(cliCommands).includes(cmd)) ? cmd :
      (Object.entries(cliCommands).find(([n, {short}]) => n && (short == cmd)) || [])[0];

    /* Parse options (convert short-code to long) */
    const opts = Object
      .entries(<CLIOptions>cliOptions)
      .reduce((p, [key, {flag}]) => ({
        ...p,
        ...(args.hasOwnProperty(key) && { [key]: args[key] }),
        ...(flag && args.hasOwnProperty(flag) && { [key]: args[flag] })
      }), <TSPOptions>{});

    /* Handle special cases */
    if ((args.v) && (!cmd)) cmd = 'version';
    if (args.h || !cmd) cmd = 'help';
    if (args.colour !== undefined) opts.color = args.colour;

    /* Build & Handle options */
    parseOptions({ instanceIsCLI, ...opts });

    /* Handle commands */
    (() => {
      switch (cmd) {
        case 'help': return Log(menu, Log.system);

        case 'version':
          const {version: tsVersion, packageDir} = getTSInfo(appOptions.basedir);
          return Log('\r\n' +
            chalk.bold.blue('ts-patch:    ') + require('../package.json').version + '\r\n' +
            chalk.bold.blue('typescript:  ') + tsVersion + chalk.gray(`   [${packageDir}]`),
            Log.system
          );

        case 'install': return actions.install();

        case 'uninstall': return actions.uninstall();

        case 'patch': return actions.patch(args._.slice(1).join(' '));

        case 'check': return actions.check();

        default: return Log('Invalid command. Try ts-patch /? for more info', Log.system);
      }
    })();
  } catch (e) {
    Log(['!', chalk.bold.yellow(e.name && (e.name !== 'Error') ? `[${e.name}]: ` : 'Error: ') + chalk.red(e.message)]);
  }

  // Output for analysis by tests
  return (!require.main) ? ({cmd, args, options: appOptions}) : void 0;
}

// endregion