#!/usr/bin/env node

import minimist from 'minimist';
import * as patch from './patch';

const { version } = require('../package.json');
const { version: TTVersion } = require("ttypescript/package.json");
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
    u, uninstall ............. Completely restores original typescript directory in node_modules
    e, enable ................ Links patched typescript library in node_modules
    d, disable ............... Links unpatched typescript in node_modules
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
      return console.log(`ts-patch: v${version}    typescript: ${TSVersion}    ttypescript: ${TTVersion}`);

    case 'enable': case 'e':
      return patch.enable(options);

    case 'disable': case 'd':
      return patch.disable(options);

    case 'install': case 'i':
      return patch.install(options);

    case 'uninstall': case 'u':
      return patch.uninstall(options);

    default:
      return console.log('Invalid command. Try ts-patch /? for more info');
  }
})();

// endregion