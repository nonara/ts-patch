import { getInstallerOptions, InstallerOptions, LogLevel, PatchError } from '../system';
import chalk from 'chalk';
import { getTsPackage, PatchInfo } from '../ts-package';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

interface CheckResult {
  [moduleName: string]: PatchInfo | undefined;
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
  const { modulePatchInfo, packageDir, version, moduleNames } = getTsPackage(dir);

  targetModuleNames ??= moduleNames;

  /* Check Modules */
  log(`Checking TypeScript ${chalk.blueBright(`v${version}`)} installation in ${chalk.blueBright(packageDir)}\r\n`);

  for (const moduleName of targetModuleNames) {
    /* Validate */
    if (!modulePatchInfo.has(moduleName))
      throw new PatchError(`${moduleName} is not a valid TypeScript module in ${packageDir}`);

    /* Report */
    const patchInfo = modulePatchInfo.get(moduleName);

    if (patchInfo !== undefined) {
      const { isOutdated } = patchInfo;
      log([ '+',
        `${chalk.blueBright(moduleName)} is patched with ts-patch version ` +
        `${chalk[isOutdated ? 'redBright' : 'blueBright'](patchInfo.patchVer)} ${isOutdated ? '(out of date)' : ''}`
      ]);
    } else log([ '-', `${chalk.blueBright(moduleName)} is not patched.` ]);

    log('', LogLevel.verbose);
  }

  return Object.fromEntries(modulePatchInfo);
}

// endregion
