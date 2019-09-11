import { getKeys, Log, pick } from './helpers';


/* ********************************************************************************************************************
 * Default Options & Type
 * ********************************************************************************************************************/
export type TSPOptions = { [K in keyof typeof defaultOptions]: (typeof defaultOptions)[K] }

export const defaultOptions = {
  silent: true,
  verbose: false,
  basedir: process.cwd()
};


/* ********************************************************************************************************************
 * Parse
 * ********************************************************************************************************************/

/**
 * Handles options & returns a full options object (pre-filled with defaults)
 */
export const parseOptions = (options: Partial<TSPOptions>): TSPOptions => {
  options = { ...defaultOptions, ...pick(options, ...getKeys(defaultOptions)) };

  Log.appLogLevel = (options.silent) ? Log.system :
    (options.verbose) ? Log.verbose :
      Log.appLogLevel;

  return (options as TSPOptions);
};