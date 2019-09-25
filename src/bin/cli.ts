#!/usr/bin/env node

import minimist from 'minimist';
import chalk from 'chalk';
import stripAnsi from 'strip-ansi';
import * as actions from '../lib/actions'
import { parseOptions, Log, TSPOptions, appOptions, tspPackageJSON } from '../lib/system';
import { getTSPackage } from '..';


/* ********************************************************************************************************************
 * Commands & Options
 * ********************************************************************************************************************/
// region Commands & Options

type MenuData = Record<string, { short?: string, caption: string, paramCaption?: string, inverse?: boolean }>;

const cliOptions:MenuData = {
  silent: { short: 's', caption: 'Run silently' },
  global: { short: 'g', caption: 'Target global TypeScript installation' },
  verbose: { short: 'v', caption: 'Chat it up' },
  basedir: { short: 'd', paramCaption: '<dir>', caption: 'Base directory to resolve package from' },
  color: { inverse: true, caption: 'Strip ansi colours from output' },
  persist: { caption:
      'Enable automatic persistence. (If TypeScript is updated/reinstalled, it will automatically re-patch)'
  },
  'no-persist': { caption: 'Disable automatic persistence.' }
};

const cliCommands:MenuData = {
  install: { short: 'i', caption: `Installs ts-patch` },
  uninstall: { short: 'u', caption: 'Restores original typescript files' },
  check: { short: 'c', caption:
      `Check patch status (use with ${chalk.cyanBright('--basedir')} to specify TS package location)`
  },
  patch: { short: void 0, paramCaption: '<module_file> | <glob>', caption:
      'Patch specific module(s) ' + chalk.yellow('(Not recommended. Use install instead)')
  },
  unpatch: { short: void 0, paramCaption: '<module_file> | <glob>', caption:
      'Un-patch specific module(s) ' + chalk.yellow('(Not recommended. Use uninstall instead)')
  },
  version: { short: 'v', caption: 'Show version' },
  help: { short: '/?', caption: 'Show help menu' },
};

// endregion


/* ********************************************************************************************************************
 * Menu
 * ********************************************************************************************************************/
// region Menu

const LINE_INDENT = '\r\n\t';
const COL_WIDTH = 45;

const formatLine = (left: (string | undefined)[], caption: string, paramCaption: string = '') => {
  const leftCol = left.filter(Boolean).join(chalk.blue(', ')) + ' ' + chalk.yellow(paramCaption);
  const dots = chalk.grey('.'.repeat(COL_WIDTH - stripAnsi(leftCol).length));
  return `${leftCol} ${dots} ${caption}`;
};

const menuText =
  LINE_INDENT + chalk.bold.blue('ts-patch [command] ') + chalk.blue('<options>') + '\r\n' + LINE_INDENT +

  // Commands
  Object
    .entries(cliCommands)
    .map(([cmd, {short, caption, paramCaption}]) => formatLine([cmd, short], caption, paramCaption))
    .join(LINE_INDENT) +

  // Options
  '\r\n' + LINE_INDENT + chalk.bold('Options') + LINE_INDENT +
  Object
    .entries(cliOptions)
    .map(([long, {short, inverse, caption, paramCaption}]) => formatLine([
      short && `${chalk.cyanBright('-' + short)}`,
      long && `${chalk.cyanBright(`${inverse ? '--no-' : '--'}${long}`)}`
    ], caption, paramCaption))
    .join(LINE_INDENT);


// endregion


/* ********************************************************************************************************************
 * App
 * ********************************************************************************************************************/
// region App

const instanceIsCLI = (require.main === module);

if (instanceIsCLI) run();

export function run() {
  let args = minimist(instanceIsCLI ? process.argv.slice(2) : arguments[0].split(' '));
  let cmd:string | undefined = args._[0] ? args._[0].toLowerCase() : void 0;

  try {
    /* Select command by short or full code */
    if (cmd) cmd = (Object.keys(cliCommands).includes(cmd)) ? cmd :
      (Object.entries(cliCommands).find(([n, {short}]) => n && (short == cmd)) || [])[0];

    /* Parse options (convert short-code to long) */
    const opts = Object
      .entries(cliOptions)
      .reduce((p, [key, {short}]) => ({
        ...p,
        ...(args.hasOwnProperty(key) && { [key]: args[key] }),
        ...(short && args.hasOwnProperty(short) && { [key]: args[short] })
      }), <TSPOptions>{});

    /* Handle special cases */
    if ((args.v) && (!cmd)) cmd = 'version';
    if (args.h) cmd = 'help';
    if (args.colour !== undefined) opts.color = args.colour;

    /* Build & Handle options */
    parseOptions({ instanceIsCLI, ...opts });

    /* Handle commands */
    (() => {
      switch (cmd) {
        case 'help': return Log(menuText, Log.system);

        case 'version':
          const {version: tsVersion, packageDir} = getTSPackage(appOptions.basedir);
          return Log('\r\n' +
            chalk.bold.blue('ts-patch:    ') + tspPackageJSON.version + '\r\n' +
            chalk.bold.blue('typescript:  ') + tsVersion + chalk.gray(`   [${packageDir}]`),
            Log.system
          );

        case 'install': return actions.install();

        case 'uninstall': return actions.uninstall();

        case 'patch': return actions.patch(args._.slice(1).join(' '));

        case 'unpatch': return actions.unpatch(args._.slice(1).join(' '));

        case 'check': return actions.check();

        default: return (args.persist === undefined) ?
          Log('Invalid command. Try ts-patch /? for more info', Log.system) : {}
      }
    })();

    /* Handle persist option */
    if (args.persist !== undefined) (args.persist) ? actions.enablePersistence() : actions.disablePersistence();
  } catch (e) {
    Log([
      '!',
      chalk.bold.yellow(e.name && (e.name !== 'Error') ? `[${e.name}]: ` : 'Error: ') + chalk.red(e.message)
    ], Log.system);
  }

  // Output for analysis by tests
  return (!instanceIsCLI) ? ({cmd, args, options: appOptions}) : void 0;
}

// endregion