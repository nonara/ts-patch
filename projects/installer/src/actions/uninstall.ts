import { getInstallerOptions, InstallerOptions } from '../system';
import chalk from 'chalk';
import { defaultInstallLibraries } from '../config';
import { unpatch } from './unpatch';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

/**
 * Remove patches from TypeScript modules
 */
export function uninstall(opts?: Partial<InstallerOptions>) {
  const options = getInstallerOptions(opts);
  const { logger: log } = options;

  const ret = unpatch(defaultInstallLibraries, opts);
  if (ret) log([ '-', chalk.green(`ts-patch removed!`) ]);

  return ret;
}

// endregion
