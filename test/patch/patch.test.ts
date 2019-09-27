import path from "path";
import pluginTests from './tests/PluginCreator';
import cliTests from './tests/tsc';
import typescriptTests from './tests/typescript';
import { createTSInstallation, libDir, removeTSInstallation, tmpDir } from '../lib/helpers';
import { install } from '../../src';


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`Patched Typescript`, () => {
  before(() => {
    /* Install and patch TS */
    createTSInstallation('^3.6.0', true);
    install({ basedir: tmpDir, silent: true });

    /* Setup global ts variable */
    // noinspection ES6ConvertVarToLetConst, UnnecessaryLocalVariableJS
    var globalTs = require(path.join(libDir, 'typescript'));
    (globalThis as any).ts = globalTs;
  });

  after(() => {
    removeTSInstallation();
    delete (globalThis as any).ts;
  });

  describe(`PluginCreator`, pluginTests);
  describe(`Typescript`, typescriptTests);
  describe(`TSC`, cliTests);
});
