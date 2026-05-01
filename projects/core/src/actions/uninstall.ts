import chalk from 'chalk';
import { TsModule } from '../module';
import { getInstallerOptions, InstallerOptions } from "../options";
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

  const ret = unpatch([ ...TsModule.patchableNames ], options);
  if (ret) log([ '-', chalk.green(`ts-patch removed!`) ]);

  return ret;
}

// endregion
