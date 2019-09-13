import shell from 'shelljs';
import path from 'path';
import os from 'os';
import fs from 'fs';
import resolve from 'resolve';
import { expect } from 'chai';
import { getModuleInfo, install, patch, setOptions, uninstall } from '../src';
import { SRC_FILES, BACKUP_DIRNAME, check } from '../src/actions';
import { WrongVersionError } from '../src/system';


/* ********************************************************************************************************************
 * Config & Helpers
 * ********************************************************************************************************************/
const tspVersion = require('../package.json').version;
const tmpDir = path.join(os.tmpdir(), 'tmpTSDir');

/* Options to use with install/uninstall */
const TSP_OPTIONS = { silent: true, basedir: tmpDir };

/**
 * Iterate each file in SRC_FILES in dir and call a callback with getModuleInfo
 */
const iterateFiles = (dir: string, callback: Function) => {
  for (let filename of SRC_FILES) {
    const file = path.join(dir, `${filename}.js`);
    expect(fs.existsSync(file)).to.be.true;

    callback(getModuleInfo(file));
  }
};

const checkExpected = (files: string[], isPatched: boolean) =>
  files.reduce((p, k) => ({
    ...p,
    [`${path.basename(k, path.extname(k))}.js`]: { canPatch: true, patchVersion: isPatched ? tspVersion : undefined }
  }), {});

/* ********************************************************************************************************************
 * Fake Installation
 * ********************************************************************************************************************/

const tsModuleDir = path.dirname(resolve.sync('typescript/package.json'));
const destDir = path.join(tmpDir, 'node_modules', 'typescript');
const backupDir = path.join(destDir, BACKUP_DIRNAME);
const libDir = path.join(destDir, 'lib');

function createFakeTSInstallation(tsVersion: string = '2.7.1') {
  const pkgJSON = `{ "name": "fake-module", "version": "1.0.0", "dependencies": { "typescript": "${tsVersion}" } }`;

  const files = SRC_FILES.map(f => path.join(tsModuleDir,'lib',`${f}.js`));

  /* Setup temp dir */
  removeFakeInstallation();
  if (shell.mkdir('-p', path.join(destDir,'lib')) && shell.error())
    throw new Error(`Could not create temp directory! ${shell.error()}`);

  // Write fake module package JSON file
  fs.writeFileSync(path.join(tmpDir, 'package.json'), pkgJSON);

  // Write typescript package JSON file
  fs.writeFileSync(path.join(destDir, 'package.json'), shell.sed(
    /(?<="version":\s*?").+?(?=")/,
    tsVersion,
    path.join(tsModuleDir,'package.json')
  ));

   // Copy relevant typescript files
  for (let srcFile of files) {
    if (shell.cp(srcFile, libDir) && shell.error())
      throw new Error(`Error copying file ${path.basename(srcFile)}. ${shell.error()}`);
  }
}

function removeFakeInstallation() {
  if (shell.rm('-rf', tmpDir) && shell.error()) throw Error(`Could not remove tmpDir! ${shell.error()}`);
}


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
      ({ canPatch, patchVersion }: ReturnType<typeof getModuleInfo>) => {
        expect(canPatch).to.be.true;
        expect(patchVersion).to.be.undefined;
      }
    ));

    it(`All files patched`, () => iterateFiles(
      libDir,
      ({ canPatch, patchVersion }: ReturnType<typeof getModuleInfo>) => {
        expect(canPatch).to.be.true;
        expect(patchVersion).to.eq(tspVersion);
      }
    ));

    it(`check() is accurate`, () => expect(check(SRC_FILES)).to.eql(checkExpected(SRC_FILES, true)));
  });

  describe(`Uninstall`, () => {
    before(() => uninstall(TSP_OPTIONS));
    after(removeFakeInstallation);

    it(`Removes backup directory`, () => expect(fs.existsSync(path.join(destDir, BACKUP_DIRNAME))).to.be.false);

    it(`Restores original files`, () => iterateFiles(
      libDir,
      ({ canPatch, patchVersion }: ReturnType<typeof getModuleInfo>) => {
        expect(canPatch).to.be.true;
        expect(patchVersion).to.be.undefined;
      }
    ));

    it(`check() is accurate`, () => expect(check(SRC_FILES)).to.eql(checkExpected(SRC_FILES, false)));
  });

  describe(`Patch`, () => {
    afterEach(removeFakeInstallation);
    const callPatch = (files: any, tsVersion?: string) => {
      createFakeTSInstallation(tsVersion);
      patch(files, TSP_OPTIONS);
    };

    it(`Patches single file`, () => {
      callPatch(SRC_FILES[0]);
      expect(check(SRC_FILES[0])).to.eql(checkExpected([SRC_FILES[0]], true))
    });

    it(`Patches array of files`, () => {
      callPatch(SRC_FILES);
      expect(check(SRC_FILES)).to.eql(checkExpected(SRC_FILES, true))
    });

    it(`Patches glob`, () => {
      callPatch(path.join(libDir,'*.*'));
      expect(check(SRC_FILES)).to.eql(checkExpected(SRC_FILES, true))
    });

    it(`Throws with TS version < 2.7`, () => {
      setOptions({ cacheTSInfo: false });

      let err: Error | undefined;
      try { callPatch(SRC_FILES, '2.6.0'); } catch (e) { err = e; }
      expect(err && err.name).to.eq('WrongVersionError');
    });
  });
});