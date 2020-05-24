import path from 'path';
import fs from 'fs';
import shell from 'shelljs';
import { getTSPackage, install, patch, setOptions, uninstall } from '../../src/installer';
import {
  BACKUP_DIRNAME, check, disablePersistence, enablePersistence, parseFiles, SRC_FILES
} from '../../src/installer/lib/actions';
import { mockFs, resetFs, restoreFs } from '../lib/mock-utils';
import resolve from 'resolve';
import { tsInstallationDirs } from '../lib/config';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const tspVersion = require('../../package.json').version;
const baseDir = tsInstallationDirs.get('latest')!;

export const destDir = path.join(baseDir, 'node_modules', 'typescript');
export const libDir = path.join(destDir, 'lib');
export const backupDir = path.join(destDir, BACKUP_DIRNAME);

/* Options to use with install/uninstall */
const TSP_OPTIONS = { silent: true, basedir: baseDir };

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function checkModules(
  expectedPatchVersion: string | undefined,
  dir: string,
  filenames: string[] = SRC_FILES
)
{
  const modules = parseFiles(filenames, dir);
  expect(modules.map(m => m.filename)).toEqual(filenames);
  for (let { canPatch, patchVersion } of modules)
    expect({ canPatch, patchVersion }).toEqual({ canPatch: true, patchVersion: expectedPatchVersion });
}

// endregion


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/
describe(`Actions`, () => {
  let shellExecSpy: jest.SpyInstance;
  beforeAll(() => {
    mockFs();

    /* Remove dependencies */
    const pkgPath = path.join(baseDir, 'package.json');
    const pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    delete pkgJson.dependencies?.['ts-node'];
    fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
    shell.rm('-rf', path.join(path.dirname(pkgPath), 'node_modules/ts-node'));

    shellExecSpy = jest.spyOn(shell, 'exec').mockImplementation();
  });

  afterAll(() => {
    restoreFs();
    jest.restoreAllMocks();
  });

  test(`Set Options`, () => expect(setOptions(TSP_OPTIONS)).toMatchObject(TSP_OPTIONS));

  describe(`Install`, () => {
    beforeAll(() => install(TSP_OPTIONS));

    test(`Original modules backed up`, () => checkModules(undefined, backupDir));

    test(`All modules patched`, () => checkModules(tspVersion, libDir));

    test(`Backs up and patches typescript.d.ts`, () => {
      const backupSrc = fs.readFileSync(path.join(backupDir, 'typescript.d.ts'), 'utf-8');
      expect(backupSrc).toMatch(/declare\snamespace\sts\s{/);
      expect(backupSrc).not.toMatch(/const\stspVersion:/);

      const patchSrc = fs.readFileSync(path.join(libDir, 'typescript.d.ts'), 'utf-8');
      expect(patchSrc).toMatch(/declare\snamespace\sts\s{/);
      expect(patchSrc).toMatch(/const\stspVersion:/);
    });

    test(`Config file is correct`, () => {
      const file = path.join(destDir, 'ts-patch.json');
      expect(fs.existsSync(file)).toBe(true);

      const config = getTSPackage(destDir).config;

      expect(config).toMatchObject({ version: tspVersion, persist: false });

      expect(Object
        .entries(config.modules)
        .filter(([ filename, timestamp ]) =>
          SRC_FILES.includes(filename) &&         // Filename must be valid
          !isNaN(parseFloat(<any>timestamp))      // Timestamp must be valid
        )
        .length
      ).toBe(SRC_FILES.length);
    });

    test(`check() is accurate`, () => {
      const modules = check(SRC_FILES);
      expect(modules.map(({ filename }) => filename)).toEqual(SRC_FILES);
      expect(modules.unPatchable.length).toEqual(0);
      expect(modules.canUpdateOrPatch.length).toEqual(0);
      expect(modules.patched.length).toEqual(SRC_FILES.length);
      expect(modules.patchable.length).toEqual(SRC_FILES.length);
    });

    test(`Calls npm to install dependencies`, () => {
      expect(shellExecSpy).toHaveBeenCalled();
      expect(shellExecSpy.mock.calls.pop()[0]).toMatch(/^npm i/);
    });
  });

  describe(`Uninstall`, () => {
    beforeAll(() => uninstall(TSP_OPTIONS));

    test(
      `Removes backup directory`,
      () => expect(fs.existsSync(path.join(destDir, BACKUP_DIRNAME))).toBe(false)
    );

    test(`Restores original modules`, () => checkModules(undefined, libDir));

    test(`Restores typescript.d.ts`, () => {
      const patchSrc = fs.readFileSync(path.join(libDir, 'typescript.d.ts'), 'utf-8');
      expect(patchSrc).toMatch(/declare\snamespace\sts\s{/);
      expect(patchSrc).not.toMatch(/const\stspVersion:/);
    });

    test(`check() is accurate`, () => {
      const modules = check(SRC_FILES);
      expect(modules.unPatchable.length).toEqual(0);
      expect(modules.canUpdateOrPatch.length).toEqual(SRC_FILES.length);
      expect(modules.patched.length).toEqual(0);
      expect(modules.patchable.length).toEqual(SRC_FILES.length);
    });
  });

  describe(`Patch`, () => {
    beforeEach(resetFs);

    test(`Patches single file`, () => {
      patch(SRC_FILES[0], TSP_OPTIONS);
      checkModules(tspVersion, libDir, [ SRC_FILES[0] ]);
    });

    test(`Patches array of files`, () => {
      patch(SRC_FILES, TSP_OPTIONS);
      checkModules(tspVersion, libDir);
    });

    test(`Patches glob`, () => {
      patch(path.join(libDir, '*.js'), TSP_OPTIONS);
      checkModules(tspVersion, libDir);
    });

    test(`Throws with TS version < 2.7`, () => {
      const pkgPath = resolve.sync('typescript/package.json', { basedir: baseDir });
      fs.writeFileSync(pkgPath,
        fs.readFileSync(pkgPath, 'utf-8')
          .replace(/"version": ".+?"/, `"version": "2.6.0"`)
      );
      let err: Error | undefined;
      try { patch(SRC_FILES, TSP_OPTIONS); }
      catch (e) { err = e; }
      expect(err && err.name).toBe('WrongTSVersion');
    });
  });

  describe(`Persistence`, () => {
    beforeAll(() => {
      resetFs();
      install(TSP_OPTIONS);
    });

    describe(`Enable`, () => {
      beforeAll(() => enablePersistence());

      test(`Copies hooks`, () => {
        expect(fs.existsSync(path.join(baseDir, 'node_modules/.hooks/postinstall'))).toBe(true);
        expect(fs.existsSync(path.join(baseDir, 'node_modules/.hooks/postinstall.cmd'))).toBe(true);
      });

      test(`Hooks have direct path to persist.js`, () => {
        const tspDir = path.join(baseDir, 'node_modules/ts-patch');
        const regex = /(?<=^(@SET\s)?tspdir\s*=\s*").+?(?="$)/m;

        const unixSrc = fs.readFileSync(path.join(baseDir, 'node_modules/.hooks/postinstall'), 'utf-8');
        const winSrc = fs.readFileSync(path.join(baseDir, 'node_modules/.hooks/postinstall.cmd'), 'utf-8');

        expect(unixSrc.match(regex)).toEqual(expect.arrayContaining([ tspDir.split(path.sep).join('/') ]));
        expect(winSrc.match(regex)).toEqual(expect.arrayContaining([ tspDir.split(path.sep).join('\\') ]));
      });

      test(
        `Config file shows persist=true`,
        () => expect(getTSPackage(destDir).config.persist).toBe(true)
      );
    });

    describe(`Disable`, () => {
      beforeAll(() => disablePersistence());

      test(`Removes hooks files`, () => {
        expect(fs.existsSync(path.join(baseDir, 'node_modules/.hooks/postinstall'))).toBe(false);
        expect(fs.existsSync(path.join(baseDir, 'node_modules/.hooks/postinstall.cmd'))).toBe(false);
      });

      test(
        `Config file shows persist=false`,
        () => expect(getTSPackage(destDir).config.persist).toBe(false)
      );
    });
  });
});
