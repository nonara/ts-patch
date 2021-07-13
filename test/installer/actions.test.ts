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
import ts from 'typescript';
import { tspPackageJSON } from '../../src/installer/lib/system';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const baseDir = tsInstallationDirs.get('latest')!;

export const destDir = path.join(baseDir, 'node_modules', 'typescript');
export const tspDir = path.join(baseDir, 'node_modules', 'ts-patch');
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

function updatePackageJson(pkgPath: string, cb: (pkgJson: any) => void) {
  let pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  cb(pkgJson);
  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
}

// endregion


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/
describe(`Actions`, () => {
  let shellExecSpy: jest.SpyInstance;
  beforeAll(() => {
    shellExecSpy = jest.spyOn(shell, 'exec').mockImplementation();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test(`Set Options`, () => expect(setOptions(TSP_OPTIONS)).toMatchObject(TSP_OPTIONS));

  describe.each([ [ '', '0.0.0' ], [ ' (overwrite w/ higher version)', '1.1.1' ] ])
  (`Install%s`, (caption, version) => {
    let originalVersion: string;
    beforeAll(() => {
      mockFs();

      /* Set version */
      updatePackageJson(path.join(tspDir, 'package.json'), (pkgData) => pkgData.version = version);
      originalVersion = tspPackageJSON.version;
      tspPackageJSON.version = version;

      /* Install */
      install(TSP_OPTIONS);
    });

    afterAll(() => {
      restoreFs();
      tspPackageJSON.version = originalVersion
    });

    test(`Original modules backed up`, () => checkModules(undefined, backupDir));
    test(`All modules patched`, () => checkModules(version, libDir));
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

      expect(config).toMatchObject({ version: version, persist: false });

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

    // Leave this as the final test, as it resets the virtual FS
    test(`No semantic errors in typescript.d.ts`, () => {
      const tsDtsFileSrc = fs.readFileSync(path.join(libDir, 'typescript.d.ts'), 'utf-8');
      restoreFs();

      const compilerOptions = Object.assign(ts.getDefaultCompilerOptions(), { target: 'ES5', "lib": [ "es2015" ] });
      const host = ts.createCompilerHost(compilerOptions, false);
      const originalReadFile = host.readFile;
      host.readFile = fileName => (fileName === 'typescript.d.ts') ? tsDtsFileSrc : originalReadFile(fileName);

      const program = ts.createProgram([ 'typescript.d.ts' ], compilerOptions, host);
      const diagnostics = program.getSemanticDiagnostics();

      // Using toHaveLength causes indefinite hang
      expect(diagnostics.length).toBe(0);
    });
  });

  describe(`Uninstall`, () => {
    beforeAll(() => {
      mockFs();
      install(TSP_OPTIONS);
      uninstall(TSP_OPTIONS);
    });
    afterAll(restoreFs);

    test(
      `Removes backup directory`,
      () => expect(fs.existsSync(path.join(destDir, BACKUP_DIRNAME))).toBe(false)
    );

    test(`Restores original modules`, () => checkModules(undefined, libDir));

    test(`Restores typescript.d.ts`, () => {
      const patchSrc = fs.readFileSync(path.join(libDir, 'typescript.d.ts'), 'utf-8');
      expect(patchSrc).toMatch(/declare\snamespace\sts\s{/);
      expect(patchSrc).not.toMatch(/const\stspPackageJSON.version:/);
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
    beforeAll(() => mockFs());
    afterAll(restoreFs);
    beforeEach(resetFs);

    test(`Patches single file`, () => {
      patch(SRC_FILES[0], TSP_OPTIONS);
      checkModules(tspPackageJSON.version, libDir, [ SRC_FILES[0] ]);
    });

    test(`Patches array of files`, () => {
      patch(SRC_FILES, TSP_OPTIONS);
      checkModules(tspPackageJSON.version, libDir);
    });

    test(`Patches glob`, () => {
      patch(path.join(libDir, '*.js'), TSP_OPTIONS);
      checkModules(tspPackageJSON.version, libDir);
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
      mockFs();
      install(TSP_OPTIONS);
    });
    afterAll(restoreFs);

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
