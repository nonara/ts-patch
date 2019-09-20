import path from 'path';
import fs from 'fs';
import { expect } from 'chai';
import { getTSPackage, install, patch, setOptions, uninstall } from '../src';
import { SRC_FILES, BACKUP_DIRNAME, check, parseFiles } from '../src/lib/actions';
import { backupDir, createFakeTSInstallation, destDir, libDir, removeFakeInstallation, tmpDir } from './lib';


/* ********************************************************************************************************************
 * Config
 * ********************************************************************************************************************/
const tspVersion = require('../package.json').version;

/* Options to use with install/uninstall */
const TSP_OPTIONS = { silent: true, basedir: tmpDir };


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

function checkModules(
  expectedPatchVersion: string | undefined,
  dir: string,
  filenames: string[] = SRC_FILES
) {
  const modules = parseFiles(filenames, dir);
  expect(modules.map(m => m.filename)).to.eql(filenames);
  for (let {canPatch, patchVersion} of modules)
    expect({canPatch, patchVersion}).to.eql({ canPatch: true, patchVersion: expectedPatchVersion });
}

const callPatch = (files: any, tsVersion?: string) => {
  createFakeTSInstallation(tsVersion);
  patch(files, TSP_OPTIONS);
};

/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/
describe(`Actions`, () => {
  it(`Set Options`, () => expect(setOptions(TSP_OPTIONS)).to.include(TSP_OPTIONS));

  describe(`Install`, () => {
    before(() => {
      createFakeTSInstallation();
      install(TSP_OPTIONS);
    });

    it(`Original files backed up`, () => checkModules(undefined, backupDir));

    it(`All files patched`, () => checkModules(tspVersion, libDir));

    it(`Config file is correct`, () => {
      const file = path.join(destDir, 'ts-patch.json');
      expect(fs.existsSync(file)).to.be.true;

      const config = getTSPackage(destDir).config;

      expect(config).to.include({ version: tspVersion, persist: false });

      expect(Object
        .entries(config.modules)
        .filter(([filename, timestamp]) =>
          SRC_FILES.includes(filename) &&         // Filename must be valid
          !isNaN(parseFloat(<any>timestamp))    // Timestamp must be valid
        )
        .length
      ).to.eq(SRC_FILES.length);
    });

    it(`check() is accurate`, () => {
      const modules = check(SRC_FILES);
      expect(modules.map(({filename}) => filename)).to.eql(SRC_FILES);
      expect(modules.unPatchable.length).to.eql(0);
      expect(modules.patchable.length).to.eql(0);
      expect(modules.alreadyPatched.length).to.eql(SRC_FILES.length);
    });
  });

  describe(`Uninstall`, () => {
    before(() => uninstall(TSP_OPTIONS));
    after(removeFakeInstallation);

    it(`Removes backup directory`, () => expect(fs.existsSync(path.join(destDir, BACKUP_DIRNAME))).to.be.false);

    it(`Restores original files`, () => checkModules(undefined, libDir));

    it(`check() is accurate`, () => {
      const modules = check(SRC_FILES);
      expect(modules.map(m => m.filename)).to.eql(SRC_FILES);
      expect(modules.alreadyPatched.length).to.eql(0);
      expect(modules.unPatchable.length).to.eql(0);
      expect(modules.patchable.length).to.eql(SRC_FILES.length);
    });
  });

  describe(`Patch`, () => {
    afterEach(removeFakeInstallation);

    it(`Patches single file`, () => {
      callPatch(SRC_FILES[0]);
      checkModules(tspVersion, libDir, [SRC_FILES[0]]);
    });

    it(`Patches array of files`, () => {
      callPatch(SRC_FILES);
      checkModules(tspVersion, libDir);
    });

    it(`Patches glob`, () => {
      callPatch(path.join(libDir,'*.*'));
      checkModules(tspVersion, libDir);
    });

    it(`Throws with TS version < 2.7`, () => {
      let err: Error | undefined;
      try { callPatch(SRC_FILES, '2.6.0'); } catch (e) { err = e; }
      expect(err && err.name).to.eq('WrongTSVersion');
    });
  });
});