#!/usr/bin/env node

import minimist from 'minimist';
import * as patch from './actions';

const { version } = require('../package.json');
const { version: TSVersion } = require ("typescript/package.json");


/* ********************************************************************************************************************
 * Options & Menu
 * ********************************************************************************************************************/
// region TSPOptions & Menu

export type TSPOptions = typeof defaultOptions;

const defaultOptions = {
  /**
   * Run silently
   */
  silent: false
};

const menu = `
    ts-patch [command] <options>
    
    i, install ............... Installs ts-patch
    u, uninstall ............. Restores original typescript files
    -v, version .............. Show version
    -h, help  ................ Show help menu
    
    options:
    -s, --silent             Do not output log info (still reports errors)
`;

// endregion


/* ********************************************************************************************************************
 * App
 * ********************************************************************************************************************/
// region App

(function run() {
  const args = minimist(process.argv.slice(2));

  const options = {
    silent: args.silent || args.s || defaultOptions.silent
  };

  let cmd = args._[0] || 'help';

  if (args.version || args.v) cmd = 'version';
  if (args.help || args.h || cmd === '/?' || cmd === '?') cmd = 'help';

  switch (cmd) {
    case 'help':
      return console.log(menu);

    case 'version':
      return console.log(`ts-patch: v${version}    typescript: ${TSVersion}`);

    case 'install': case 'i':
      return patch.install(options);

    case 'uninstall': case 'u':
      return patch.uninstall(options);

    default:
      return console.log('Invalid command. Try ts-patch /? for more info');
  }
})();

// endregion