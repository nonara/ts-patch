#!/usr/bin/env node

import { getTSInfo, parseOptions, Log, defaultOptions, TSPOptions, getKeys } from './system';
import minimist from 'minimist';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import * as actions from './actions'


/* ********************************************************************************************************************
 * Commands & Options
 * ********************************************************************************************************************/

const cliOptions: Record<keyof TSPOptions, { flag: string, caption: string | string[] }> = {
  silent: { flag: 's', caption: 'Run silently' },
  verbose: { flag: 'v', caption: 'Chat it up' },
  basedir: { flag: 'd', caption: ['<dir>', 'Base directory to resolve package from'] }
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
    .entries(cliOptions)
    .map(([long, {flag, caption}]) => formatLine(
      [flag && `${chalk.cyanBright('-' + flag)}`, long && `${chalk.cyanBright('--' + long)}`], caption))
    .join(SPACER);


// endregion


/* ********************************************************************************************************************
 * App
 * ********************************************************************************************************************/
// region App

// Set default Log level to Log.normal for CLI
Log.appLogLevel = Log.normal;

export function run() {
  const args = minimist(process.argv.slice(2));

  /* Select command by short or full code */
  let cmd:string | undefined = args._[0] ? args._[0].toLowerCase() : void 0;
  if (cmd) cmd = (Object.keys(cliCommands).includes(cmd)) ? cmd :
    (Object.entries(cliCommands).find(([n, {short}]) => n && (short == cmd)) || [])[0];

  if (!args.s && !args.silent) args.silent = false;

  /* Build & Handle options */
  const options = parseOptions(
    getKeys(cliOptions).reduce((p, name) => ({
      ...p, [name]:
        (name in args) ? args[name] :
        (cliOptions[name].flag in args) ? args[cliOptions[name].flag] :
          defaultOptions[name]
    }), <TSPOptions>{})
  );

  /* Handle special arguments */
  if ((args.v) && (!cmd)) cmd = 'version';
  if (args.help || args.h) cmd = 'help';

  /* Handle commands */
  try {
    (() => {
      switch (cmd) {
      case 'help': return Log(menu, Log.system);

      case 'version':
        const {version: tsVersion, packageDir} = getTSInfo(options.basedir);
        return Log('\r\n' +
          chalk.bold.blue('ts-patch:    ') + require('../package.json').version + '\r\n' +
          chalk.bold.blue('typescript:  ') + tsVersion + chalk.gray(`   [${packageDir}]`),
          Log.system
        );

      case 'install': return actions.install(options);

      case 'uninstall': return actions.uninstall(options);

      case 'patch': return actions.patch(args._.slice(1).join(' '), options);

      case 'check': return actions.check(options);

      default: return Log('Invalid command. Try ts-patch /? for more info', Log.system);
      }
    })();
  } catch (e) {
    Log(['=', chalk.bold.red(`Error ${e.constructor.name} - ${e.message}`)]);
  }

  // Output for analysis by tests
  return (!require.main) ? ({cmd, args, options}) : void 0;
}

/* Execute if CLI */
if (require.main === module) run();

// endregion