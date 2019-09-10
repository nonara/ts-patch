#!/usr/bin/env node

import { getTSInfo, parseOptions, Log, defaultOptions, TSPOptions } from './system';
import minimist from 'minimist';
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
  patch: { short: void 0, caption: ['<module_file> | <glob>', 'Patch specific module(s)'] },
  version: { short: 'v', caption: 'Show version' },
  help: { short: '/?', caption: 'Show help menu' },
};


/* ********************************************************************************************************************
 * Menu
 * ********************************************************************************************************************/
// region Menu

const COL_WIDTH = 45;

const formatLine = (left: (string | undefined)[], caption: string | string[]) => {
  const paramCaption = Array.isArray(caption) && caption[0];
  const mainCaption = paramCaption ? caption[1] : caption;
  const col1 = left.filter(Boolean).join(', ') + (paramCaption ? ` ${paramCaption} ` : ' ');

  return col1 + '.'.repeat(COL_WIDTH - col1.length) + ' ' + mainCaption;
};

const menu =
  `\r\n\tts-patch [command] <options>\r\n\r\n\t` +

  // Commands
  Object
    .entries(cliCommands)
    .map(([cmd, {short, caption}]) => formatLine([cmd, short], caption))
    .join('\r\n\t') +

  // Options
  `\r\n\r\n\tOptions:\r\n\t`+
  Object
    .entries(cliOptions)
    .map(([long, {flag, caption}]) => formatLine([flag && `-${flag}`, long && `--${long}`], caption))
    .join('\r\n\t');


// endregion


/* ********************************************************************************************************************
 * App
 * ********************************************************************************************************************/
// region App

(function run() {
  const args = minimist(process.argv.slice(2));

  /* Select command by short or full code */
  let cmd:string | undefined = args._[0] ? args._[0].toLowerCase() : void 0;
  if (cmd) cmd = (cmd in cliOptions) ?
    cmd : (Object.entries(cliCommands).find(([n, {short}]) => n && (short == cmd)) || [])[0];

  /* Build & Handle options */
  const options = parseOptions(
    (Object.keys(cliOptions) as (keyof typeof cliOptions)[]).reduce((p, name) => ({
      ...p, [name]: args[name] || args[cliOptions[name].flag] || defaultOptions[name]
    }), <TSPOptions>{})
  );

  /* Handle special arguments */
  if ((args.v) && (!cmd)) cmd = 'version';
  if (args.help || args.h) cmd = 'help';

  /* Handle commands */
  switch (cmd) {
    case 'help': return Log(menu, Log.system);

    case 'version':
      return Log(
        `ts-patch: ${require('../../package.json').version}    typescript: ${getTSInfo(options.basedir).version}`
      , Log.system);

    case 'install': return actions.install(options);

    case 'uninstall': return actions.uninstall(options);

    case 'patch': return actions.patch(args._.slice(1).join(' '), options);

    default: return Log('Invalid command. Try ts-patch /? for more info', Log.system);
  }
})();

// endregion