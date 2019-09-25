import path from 'path';
import fs from 'fs';
import shell from 'shelljs';
import { expect } from 'chai';
import { getTSPackage, install, patch, setOptions, uninstall } from '../src';
import {
  SRC_FILES, BACKUP_DIRNAME, check, parseFiles, enablePersistence, disablePersistence
} from '../src/lib/actions';
import {
  backupDir, createTSInstallation, destDir, installFakePackage, installTSPatch, libDir, removeTSInstallation,
  removeTSPatch, tmpDir
} from './lib/helpers';


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
  createTSInstallation(tsVersion);
  patch(files, TSP_OPTIONS);
};

/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/
describe(`Actions`, () => {
  it(`Set Options`, () => expect(setOptions(TSP_OPTIONS)).to.include(TSP_OPTIONS));

  describe(`Install`, () => {
    before(() => {
      createTSInstallation();
      install(TSP_OPTIONS);
    });

    it(`Original modules backed up`, () => checkModules(undefined, backupDir));

    it(`All modules patched`, () => checkModules(tspVersion, libDir));

    it(`Backs up and patches typescript.d.ts`, () => {
      const backupSrc = fs.readFileSync(path.join(backupDir, 'typescript.d.ts'));
      expect(backupSrc).to.match(/declare\snamespace\sts\s{/);
      expect(backupSrc).to.not.match(/const\stspVersion:/);

      const patchSrc = fs.readFileSync(path.join(libDir, 'typescript.d.ts'));
      expect(patchSrc).to.match(/declare\snamespace\sts\s{/);
      expect(patchSrc).to.match(/const\stspVersion:/);
    });

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
    after(removeTSInstallation);

    it(`Removes backup directory`, () => expect(fs.existsSync(path.join(destDir, BACKUP_DIRNAME))).to.be.false);

    it(`Restores original modules`, () => checkModules(undefined, libDir));

    it(`Restores typescript.d.ts`, () => {
      const patchSrc = fs.readFileSync(path.join(libDir, 'typescript.d.ts'));
      expect(patchSrc).to.match(/declare\snamespace\sts\s{/);
      expect(patchSrc).to.not.match(/const\stspVersion:/);
    });

    it(`check() is accurate`, () => {
      const modules = check(SRC_FILES);
      expect(modules.map(m => m.filename)).to.eql(SRC_FILES);
      expect(modules.alreadyPatched.length).to.eql(0);
      expect(modules.unPatchable.length).to.eql(0);
      expect(modules.patchable.length).to.eql(SRC_FILES.length);
    });
  });

  describe(`Patch`, () => {
    afterEach(removeTSInstallation);

    it(`Patches single file`, () => {
      callPatch(SRC_FILES[0]);
      checkModules(tspVersion, libDir, [SRC_FILES[0]]);
    });

    it(`Patches array of files`, () => {
      callPatch(SRC_FILES);
      checkModules(tspVersion, libDir);
    });

    it(`Patches glob`, () => {
      callPatch(path.join(libDir,'*.js'));
      checkModules(tspVersion, libDir);
    });

    it(`Throws with TS version < 2.7`, () => {
      let err: Error | undefined;
      try { callPatch(SRC_FILES, '2.6.0'); } catch (e) { err = e; }
      expect(err && err.name).to.eq('WrongTSVersion');
    });
  });

  describe(`Persistence`, () => {
    before(() => {
      createTSInstallation();
      install(TSP_OPTIONS);
      installTSPatch();
      enablePersistence();
    });
    after(removeTSInstallation);

    describe(`Enable`, () => {
      it(`Copies hooks`, () => {
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall'))).to.be.true;
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall.cmd'))).to.be.true;
      });

      it(`Config file shows persist=true`, () => expect(getTSPackage(destDir).config.persist).to.be.true);
    });

    describe(`Hooks`, () => {
      let installLog: string;
      let modules: ReturnType<typeof parseFiles>;
      let skippedFilename: string;
      before(() => {
        /* Unpatch */
        shell.cp(path.join(backupDir, '*'), path.join(libDir, '/'));
        modules = parseFiles(SRC_FILES, libDir);
        expect(modules.patchable.length).to.eq(modules.length);

        /* Mark one to skip */
        const {config} = getTSPackage(destDir);
        skippedFilename = modules[0].filename;
        config.modules[skippedFilename] += 5 * (60000);
        config.save();

        // Trigger hook
        installLog = installFakePackage();

        modules = parseFiles(SRC_FILES, libDir);
      });

      it(`Invokes hooks after new package install`, () =>
        expect(/\.hooks[\\/]postinstall/g.test(installLog)).to.be.true
      );

      it(`Re-patches modules after hook invoked`, () =>
        expect(modules.alreadyPatched.length >= modules.length-1).to.true
      );

      it(`Skips patching non-modified module`, () => {
        expect(modules.patchable.length).to.eq(1);
        expect(modules.patchable[0].filename).to.eq(skippedFilename);
      });
    });

    describe(`Disable`, () => {
      before(() => disablePersistence());

      it(`Removes hooks files`, () => {
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall'))).to.be.false;
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall.cmd'))).to.be.false;
      });

      it(`Config file shows persist=false`, () => expect(getTSPackage(destDir).config.persist).to.be.false);
    });

    describe(`Auto-remove`, () => {
      before(() => {
        enablePersistence();
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall'))).to.be.true;
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall.cmd'))).to.be.true;

        removeTSPatch();
        installFakePackage();
      });

      it(`Removes hooks files if ts-patch is uninstalled`, () => {
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall'))).to.be.false;
        expect(fs.existsSync(path.join(tmpDir, 'node_modules/.hooks/postinstall.cmd'))).to.be.false;
      });
    });
  });
});