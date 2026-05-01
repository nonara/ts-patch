import type { TsPackage } from '../ts-package';
import { PatchError } from './errors';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function assertSupportedTypeScript(tsPackage: TsPackage): void {
  if (tsPackage.majorVer < 6) {
    throw new PatchError(
      `ts-patch v4 requires TypeScript >= 6. Found ${tsPackage.version}. ` +
      `Use the previous ts-patch major for older TypeScript versions.`,
      { code: 'TS_VERSION_UNSUPPORTED' }
    );
  }
}

// endregion
