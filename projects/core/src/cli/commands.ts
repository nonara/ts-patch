import chalk from 'chalk';
import minimist from 'minimist';
import type { CliConfig } from './cli';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

/** @internal */
export const cliCommandsConfig: CliConfig = {
  install: { short: 'i', caption: `Installs ts-patch (to main libraries)` },
  uninstall: { short: 'u', caption: 'Restores original typescript files' },
  check: {
    short: 'c', caption:
      `Check patch status (use with ${chalk.cyanBright('--dir')} to specify TS package location)`
  },
  patch: {
    short: void 0, paramCaption: '<module_file>', caption:
      'Patch specific module(s) ' + chalk.yellow('(advanced)')
  },
  unpatch: {
    short: void 0, paramCaption: '<module_file>', caption:
      'Un-patch specific module(s) ' + chalk.yellow('(advanced)')
  },
  'clear-cache': { caption: 'Clears cache and lock-files' },
  version: { short: 'v', caption: 'Show version' },
  help: { short: '/?', caption: 'Show help menu' },
};

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getCliCommand(args: minimist.ParsedArgs) {
  let cmd: string | undefined = args._[0] ? args._[0].toLowerCase() : void 0;

  /* Handle special cases */
  if ((args.v) && (!cmd)) return 'version';
  if (args.h) return 'help';

  if (!cmd) return cmd;

  /* Get long command */
  cmd = Object
    .entries(cliCommandsConfig)
    .find(([ long, { short } ]) => long === cmd || short === cmd)?.[0];

  return cmd;
}

// endregion
