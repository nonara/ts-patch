import minimist from 'minimist';
import type { CliConfig } from './cli';
import { LogLevel, OptionsError } from '../system';
import { getInstallerOptions, InstallerOptions } from "../options";
import { getGlobalTsDir } from "../utils";


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface CliOptions {
  silent: boolean;
  global: boolean;
  verbose: boolean;
  dir: string;
  color: boolean;
}

// endregion


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

/** @internal */
export const cliOptionsConfig: CliConfig = {
  silent: { short: 's', caption: 'Run silently' },
  global: { short: 'g', caption: 'Target global TypeScript installation' },
  verbose: { short: 'v', caption: 'Chat it up' },
  cache: { inverse: true, caption: 'Skip cache' },
  dir: {
    short: 'd',
    paramCaption: '<dir>',
    caption: 'TypeScript directory or directory to resolve typescript package from'
  },
  color: { inverse: true, caption: 'Strip ansi colours from output' }
};


// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getCliOptions(args: minimist.ParsedArgs) {
  let res: CliOptions = <CliOptions>{};

  for (const [ key, { short } ] of Object.entries(cliOptionsConfig)) {
    if (args.hasOwnProperty(key) || (short && args.hasOwnProperty(short))) {
      (<any>res)[key] = args.hasOwnProperty(key) ? args[key] : args[short!];
    }
  }

  return res;
}

export function getInstallerOptionsFromCliOptions(cliOptions: CliOptions): InstallerOptions {
  let partialOptions: Partial<InstallerOptions> = {};

  /* Dir option */
  if (cliOptions.global && cliOptions.dir) throw new OptionsError(`Cannot specify both --global and --dir`);
  if ('dir' in cliOptions) partialOptions.dir = cliOptions.dir;
  if ('global' in cliOptions) partialOptions.dir = getGlobalTsDir();

  /* LogLevel option */
  if (cliOptions.silent && cliOptions.verbose) throw new OptionsError(`Cannot specify both --silent and --verbose`);
  if (cliOptions.silent) {
    partialOptions.logLevel = LogLevel.system;
    partialOptions.silent = true;
  }
  else if (cliOptions.verbose) partialOptions.logLevel = LogLevel.verbose;

  /* Color option */
  if (cliOptions.color) partialOptions.useColor = cliOptions.color;

  return getInstallerOptions(partialOptions);
}

// endregion
