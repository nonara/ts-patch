import path from 'path';
import fs from 'fs';
import { expect } from 'chai';
import { getTSModule, install, patch, setOptions, uninstall } from '../src';
import { SRC_FILES, BACKUP_DIRNAME, check } from '../src/actions';
import { backupDir, createFakeTSInstallation, destDir, libDir, removeFakeInstallation, tmpDir } from './lib';


/* ********************************************************************************************************************
 * Config & Helpers
 * ********************************************************************************************************************/
const tspVersion = require('../package.json').version;

/* Options to use with install/uninstall */
const TSP_OPTIONS = { silent: true, basedir: tmpDir };

/**
 * Iterate each file in SRC_FILES in dir and call a callback with getTSModule
 */
const iterateFiles = (dir: string, callback: Function) => {
  for (let filename of SRC_FILES) {
    const file = path.join(dir, `${filename}.js`);
    expect(fs.existsSync(file)).to.be.true;

    callback(getTSModule(file));
  }
};

const checkExpected = (files: string[], isPatched: boolean) =>
  files.reduce((p, k) => ({
    ...p,
    [`${path.basename(k, path.extname(k))}.js`]: { canPatch: true, patchVersion: isPatched ? tspVersion : undefined }
  }), {});


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

    it(`Original files backed up`, () => iterateFiles(
      backupDir,
      ({ canPatch, patchVersion }: ReturnType<typeof getTSModule>) => {
        expect(canPatch).to.be.true;
        expect(patchVersion).to.be.undefined;
      }
    ));

    it(`All files patched`, () => iterateFiles(
      libDir,
      ({ canPatch, patchVersion }: ReturnType<typeof getTSModule>) => {
        expect(canPatch).to.be.true;
        expect(patchVersion).to.eq(tspVersion);
      }
    ));

    it(`check() is accurate`, () => expect(check(SRC_FILES)).to.include(checkExpected(SRC_FILES, true)));
  });

  describe(`Uninstall`, () => {
    before(() => uninstall(TSP_OPTIONS));
    after(removeFakeInstallation);

    it(`Removes backup directory`, () => expect(fs.existsSync(path.join(destDir, BACKUP_DIRNAME))).to.be.false);

    it(`Restores original files`, () => iterateFiles(
      libDir,
      ({ canPatch, patchVersion }: ReturnType<typeof getTSModule>) => {
        expect(canPatch).to.be.true;
        expect(patchVersion).to.be.undefined;
      }
    ));

    it(`check() is accurate`, () => expect(check(SRC_FILES)).to.include(checkExpected(SRC_FILES, false)));
  });

  describe(`Patch`, () => {
    afterEach(removeFakeInstallation);
    const callPatch = (files: any, tsVersion?: string) => {
      createFakeTSInstallation(tsVersion);
      patch(files, TSP_OPTIONS);
    };

    it(`Patches single file`, () => {
      callPatch(SRC_FILES[0]);
      expect(check(SRC_FILES[0])).to.include(checkExpected([SRC_FILES[0]], true))
    });

    it(`Patches array of files`, () => {
      callPatch(SRC_FILES);
      expect(check(SRC_FILES)).to.include(checkExpected(SRC_FILES, true))
    });

    it(`Patches glob`, () => {
      callPatch(path.join(libDir,'*.*'));
      expect(check(SRC_FILES)).to.include(checkExpected(SRC_FILES, true))
    });

    it(`Throws with TS version < 2.7`, () => {
      setOptions({ cacheTSInfo: false });

      let err: Error | undefined;
      try { callPatch(SRC_FILES, '2.6.0'); } catch (e) { err = e; }
      expect(err && err.name).to.eq('WrongTSVersion');
    });
  });
});