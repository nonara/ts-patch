import chalk from 'chalk';
import { getInstallerOptions, InstallerOptions, patch } from '..';
import { defaultInstallLibraries } from '../config';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

/**
 * Patch TypeScript modules
 */
export function install(opts?: Partial<InstallerOptions>) {
  const options = getInstallerOptions(opts);
  const { logger: log } = options;

  const ret = patch(defaultInstallLibraries, options);
  if (ret) log([ '+', chalk.green(`ts-patch installed!`) ]);

  return ret;
}

// endregion
