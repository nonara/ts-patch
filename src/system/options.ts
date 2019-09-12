import { Log } from './logger';
import { OptionsError } from './errors';
import { getGlobalTSDir, getKeys, pick } from './helpers';


/* ********************************************************************************************************************
 * Options & Type
 * ********************************************************************************************************************/
export type TSPOptions = { [K in keyof typeof defaultOptions]: (typeof defaultOptions)[K] }

export const defaultOptions = {
  logLevel: Log.normal,
  color: true,
  silent: false,
  verbose: false,
  basedir: process.cwd(),
  instanceIsCLI: false
};

/* Exported options object */
export let appOptions = {...defaultOptions};


/* ********************************************************************************************************************
 * Parser
 * ********************************************************************************************************************/

/**
 * Create full options object using user input and assigns it to appOptions
 */
export const parseOptions = (options?: Partial<TSPOptions>): TSPOptions => {
  if (!options || (options === appOptions)) return appOptions;
  const has = (key: string) => options.hasOwnProperty(key);

  if (has('color')) appOptions.color = options['color']!;

  if (has('global') && has('basedir')) throw new OptionsError(`Cannot specify both --global and --basedir`);
  if (has('global')) options.basedir = getGlobalTSDir();

  Object.assign(appOptions, {
    ...defaultOptions,
    ...(pick(options, ...getKeys(defaultOptions))),
    logLevel:
      (options.silent) ? Log.system :
      (options.verbose) ? Log.verbose :
      (options.instanceIsCLI) ? Log.normal :
        defaultOptions.logLevel
  });

  return appOptions;
};
