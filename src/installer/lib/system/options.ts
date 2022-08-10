import { Log } from './logger';
import { OptionsError } from './errors';
import { getKeys, pick } from './helpers';
import { getGlobalTSDir } from '../file-utils';


/* ********************************************************************************************************************
 * Options & Type
 * ********************************************************************************************************************/

export type TSPOptions = typeof defaultOptions & {
  /** @deprecated Use 'dir' */
  basedir?: string
}

export const defaultOptions = {
  logLevel: Log.normal,
  color: true,
  silent: false,
  verbose: false,
  dir: process.cwd(),
  instanceIsCLI: false
};

/** App-wide options storage */
export let appOptions = { ...defaultOptions };


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

  if (has('basedir')) {
    console.warn(`--basedir is deprecated and will be removed in the future. Use --dir instead.`)
    options.dir = options.dir || options.basedir;
  }

  if (has('persist')) console.warn(`--persist has been removed. Please use prepare script instead!`);

  if (has('global') && has('dir')) throw new OptionsError(`Cannot specify both --global and --dir`);
  if (has('global')) options.dir = getGlobalTSDir();

  Object.assign(appOptions, pick(options, ...getKeys(defaultOptions)));

  appOptions.logLevel =
    (appOptions.silent) ? Log.system :
    (appOptions.verbose) ? Log.verbose :
    (appOptions.instanceIsCLI) ? Log.normal :
    defaultOptions.logLevel;

  return appOptions;
};

export const resetOptions = (options?: Partial<TSPOptions>) => parseOptions({ ...defaultOptions, ...options });
