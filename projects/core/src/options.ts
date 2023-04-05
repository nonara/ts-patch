import { createLogger, Logger, LogLevel } from './system';
import { PartialSome } from "./utils";


/* ****************************************************************************************************************** */
// region: Locals
/* ****************************************************************************************************************** */

type PreAppOptions = PartialSome<InstallerOptions, 'logger'>

// endregion


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

export interface InstallerOptions {
  logLevel: LogLevel;
  useColor: boolean;
  dir: string;
  silent: boolean;
  logger: Logger;
  skipCache: boolean;
}

export namespace InstallerOptions {
  export function getDefaults() {
    return {
      logLevel: LogLevel.normal,
      useColor: true,
      dir: process.cwd(),
      silent: false,
      skipCache: false
    } satisfies PreAppOptions
  }
}

// endregion


/* ********************************************************************************************************************
 * Parser
 * ********************************************************************************************************************/

export function getInstallerOptions(options?: Partial<InstallerOptions>): InstallerOptions {
  if (Object.isSealed(options)) return options as InstallerOptions;

  const res = { ...InstallerOptions.getDefaults(), options } as PreAppOptions;

  return Object.seal({
    ...res,
    logger: res.logger ?? createLogger(res.logLevel, res.useColor)
  });
}
