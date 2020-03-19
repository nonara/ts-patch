import path from 'path';
import pluginTests from './tests/PluginCreator';
import cliTests from './tests/tsc';
import typescriptTests from './tests/typescript';
import { createTSInstallation, libDir, removeTSInstallation, tmpDir } from '../lib/helpers';
import { install } from '../../src';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
function clearRequireCache() {
  for (const path of Object.keys(require.cache))
    if (path.endsWith('.js')) delete require.cache[path];
}


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`Patched Typescript`, () => {
  before(() => {
    /* Install and patch TS */
    createTSInstallation(true);
    install({ basedir: tmpDir, silent: true });

    /* Setup global ts variable */
    clearRequireCache(); // Do not remove or comment
    (globalThis as any).ts = require(path.join(libDir, 'typescript'));
  });

  after(() => {
    removeTSInstallation();
    delete (globalThis as any).ts;
  });

  describe(`PluginCreator`, pluginTests);
  describe(`Typescript`, typescriptTests);
  describe(`TSC`, cliTests);
});
