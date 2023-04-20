import minimist from 'minimist';
import { createLogger, getCacheRoot, getLockFilePath, LogLevel } from '../system';
import { getTsPackage } from '../ts-package';
import chalk from 'chalk';
import * as actions from '../actions';
import { getCliOptions, getInstallerOptionsFromCliOptions } from './options';
import { getCliCommand } from './commands';
import { getHelpMenu } from './help-menu';
import { tspPackageJSON } from '../config';
import fs from 'fs';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export type CliConfig = Record<string, { short?: string, caption: string, paramCaption?: string, inverse?: boolean }>

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function run(opt?: { cmdArgs?: string }) {
  /* Parse Input */
  const args = minimist(opt?.cmdArgs?.split(' ') ?? process.argv.slice(2));
  const cliOptions = getCliOptions(args);
  const cmd = getCliCommand(args);

  /* Setup */
  const options = getInstallerOptionsFromCliOptions(cliOptions);
  const log = createLogger(options.logLevel, options.useColor, options.silent);

  try {
    /* Handle commands */
    (() => {
      switch (cmd) {
        case 'help':
          return log(getHelpMenu(), LogLevel.system);

        case 'version':
          const { version: tsVersion, packageDir } = getTsPackage(options.dir);
          return log('\r\n' +
            chalk.bold.blue('ts-patch:    ') + tspPackageJSON.version + '\r\n' +
            chalk.bold.blue('typescript:  ') + tsVersion + chalk.gray(`   [${packageDir}]`),
            LogLevel.system
          );

        case 'install':
          return actions.install(options);

        case 'uninstall':
          return actions.uninstall(options);

        case 'patch':
          return actions.patch(args._.slice(1).join(' '), options);

        case 'unpatch':
          return actions.unpatch(args._.slice(1).join(' '), options);

        case 'check':
          return actions.check(undefined, options);

        case 'clear-cache':
          const cacheRoot = getCacheRoot();

          /* Clear dir */
          fs.rmSync(cacheRoot, { recursive: true, force: true });

          /* Recreate Dirs */
          getCacheRoot();
          getLockFilePath('');

          return log([ '+', 'Cleared cache & lock-files' ], LogLevel.system);

        default:
          log([ '!', 'Invalid command. Try ts-patch /? for more info' ], LogLevel.system)
      }
    })();
  }
  catch (e) {
    log([
      '!',
      chalk.bold.yellow(e.name && (e.name !== 'Error') ? `[${e.name}]: ` : 'Error: ') + chalk.red(e.message)
    ], LogLevel.system);
  }

  // Output for analysis by tests
  return ({ cmd, args, options });
}

// endregion
