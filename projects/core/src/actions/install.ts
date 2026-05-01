import chalk from 'chalk';
import { TsModule } from '../module';
import { getInstallerOptions, InstallerOptions } from '../options';
import { patch } from './patch';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

/**
 * Patch TypeScript modules
 */
export function install(opts?: Partial<InstallerOptions>) {
  const options = getInstallerOptions(opts);
  const { logger: log } = options;

  const ret = patch([ ...TsModule.patchableNames ], options);
  if (ret) log([ '+', chalk.green(`ts-patch installed!`) ]);

  return ret;
}

// endregion
