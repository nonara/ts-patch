import { LogLevel, PatchError } from '../system';
import chalk from 'chalk';
import { getTsPackage } from '../ts-package';
import { PatchDetail } from "../patch/patch-detail";
import { getTsModule } from "../module";
import { getInstallerOptions, InstallerOptions } from "../options";


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

interface CheckResult {
  [moduleName: string]: PatchDetail | undefined;
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

/**
 * Check if files can be patched
 */
export function check(moduleName?: string | string[], opts?: Partial<InstallerOptions>): CheckResult
export function check(moduleNames?: string[], opts?: Partial<InstallerOptions>): CheckResult
export function check(moduleNameOrNames?: string | string[], opts?: Partial<InstallerOptions>): CheckResult {
  let targetModuleNames = moduleNameOrNames ? [ moduleNameOrNames ].flat() : undefined;
  const options = getInstallerOptions(opts);
  const { logger: log, dir } = options;

  /* Load Package */
  const tsPackage = getTsPackage(dir);
  const { packageDir, version } = tsPackage;


  targetModuleNames ??= tsPackage.moduleNames;

  /* Check Modules */
  log(`Checking TypeScript ${chalk.blueBright(`v${version}`)} installation in ${chalk.blueBright(packageDir)}\r\n`);

  let res: CheckResult = {};
  for (const moduleName of targetModuleNames) {
    /* Validate */
    if (!tsPackage.moduleNames.includes(moduleName))
      throw new PatchError(`${moduleName} is not a valid TypeScript module in ${packageDir}`);

    /* Report */
    const tsModule = getTsModule(tsPackage, moduleName, { skipCache: options.skipCache });
    const { patchDetail } = tsModule.moduleFile;

    if (patchDetail !== undefined) {
      const { isOutdated } = patchDetail;
      log([ '+',
        `${chalk.blueBright(moduleName)} is patched with ts-patch version ` +
        `${chalk[isOutdated ? 'redBright' : 'blueBright'](patchDetail.tspVersion)} ${isOutdated ? '(out of date)' : ''}`
      ]);
    } else log([ '-', `${chalk.blueBright(moduleName)} is not patched.` ]);

    res[moduleName] = patchDetail;

    log('', LogLevel.verbose);
  }

  return res;
}

// endregion
