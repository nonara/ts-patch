import minimist from 'minimist';
import { createLogger, LogLevel, tspPackageJSON } from '../system';
import { getTsPackage } from '../ts-package';
import chalk from 'chalk';
import * as actions from '../actions';
import { getCliOptions, getInstallerOptionsFromCliOptions } from './options';
import { getCliCommand } from './commands';
import { getHelpMenu } from './help-menu';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export type CliConfig = Record<string, { short?: string, caption: string, paramCaption?: string, inverse?: boolean }>

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function run(argStr?: string) {
  /* Parse Input */
  const args = minimist(instanceIsCLI ? process.argv.slice(2) : argStr!.split(' '));
  const cliOptions = getCliOptions(args);
  const cmd = getCliCommand(args);

  /* Setup */
  const options = getInstallerOptionsFromCliOptions(cliOptions);
  const log = createLogger(options.logLevel, options.useColor);

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

        default:
          log('Invalid command. Try ts-patch /? for more info', LogLevel.system)
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
  return (!instanceIsCLI) ? ({ cmd, args, options }) : void 0;
}

// endregion


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

const instanceIsCLI = (require.main === module);
if (instanceIsCLI) run();
