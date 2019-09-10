import shell from 'shelljs';
import path from 'path';
import os from 'os';
import fs from 'fs';
import resolve from 'resolve';
import { expect } from 'chai';
import { getModuleInfo, install, uninstall } from '../src';
import { SRC_FILES, BACKUP_DIRNAME } from '../src/actions';


/* ********************************************************************************************************************
 * Config & Helpers
 * ********************************************************************************************************************/
const tmpDir = path.join(os.tmpdir(), 'tmpTSDir');

/* Options to use with install/uninstall */
const TSP_OPTIONS = {verbose: true, basedir: tmpDir};

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

/* ********************************************************************************************************************
 * Fake Installation
 * ********************************************************************************************************************/

const pkgJSON = { "name": "blah", "version": "1.0.0", "dependencies": { "typescript": "^2.7.1" } };
const tsModuleDir = path.dirname(resolve.sync('typescript/package.json'));
const destDir = path.join(tmpDir, 'node_modules', 'typescript');
const backupDir = path.join(destDir, BACKUP_DIRNAME);
const libDir = path.join(destDir, 'lib');

function createFakeTSInstallation() {
  const files = SRC_FILES.map(f => path.join(tsModuleDir,'lib',`${f}.js`));

  /* Setup temp dir */
  removeFakeInstallation();
  if (shell.mkdir('-p', path.join(destDir,'lib')) && shell.error())
    throw new Error(`Could not create temp directory! ${shell.error()}`);

  // Write fake package JSON file
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJSON));

  // Create fake package.json
  shell.cp(path.join(tsModuleDir,'package.json'), destDir);

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
describe(`Patcher`, () => {
  before(() => {
    createFakeTSInstallation();
    install(TSP_OPTIONS);
  });

  after(removeFakeInstallation);

  describe(`Install`, () => {
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
        expect(patchVersion).to.eq(require('../package.json').version);
      }
    ));
  });

  describe(`Uninstall`, () => {
    before(() => uninstall(TSP_OPTIONS));

    it(`Removes backup directory`, () => expect(fs.existsSync(path.join(destDir, BACKUP_DIRNAME))).to.be.false);

    it(`Restores original files`, () => iterateFiles(
      libDir,
      ({ canPatch, patchVersion }: ReturnType<typeof getModuleInfo>) => {
        expect(canPatch).to.be.true;
        expect(patchVersion).to.be.undefined;
      }
    ));
  });
});