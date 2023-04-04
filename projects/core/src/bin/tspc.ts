import * as path from 'path';
import { runInThisContext } from 'vm';
import { getTsPackage } from "../ts-package";
import { patchModule } from "../patch/patch-module";
import { getTsModule } from "../module";


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

// Run if main module cli
if (require.main === module) {
  const skipCache = process.env.TSP_SKIP_CACHE === 'true';
  const tsPath = process.env.TSP_TS_PATH ? path.resolve(process.env.TSP_TS_PATH) : require.resolve('typescript');

  /* Open the TypeScript module */
  const tsPackage = getTsPackage(tsPath);
  const tsModule = getTsModule(tsPackage, 'tsc.js', { skipCache });

  /* Get patched version */
  const { js } = patchModule(tsModule, true);

  /* Run the patched version */
  const script = runInThisContext(`
    (function (exports, require, module, __filename, __dirname) {
      ${js}
    });
  `);

  script.call(exports, exports, require, module, tsModule.modulePath, path.dirname(tsModule.modulePath));
} else {
  throw new Error('tspc must be run as a CLI');
}
