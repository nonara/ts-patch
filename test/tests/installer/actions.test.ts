import fs from 'fs';
import {
  check, defaultInstallLibraries, install, parseFiles, patch, setOptions, SRC_FILES, uninstall
} from '../../../src/installer/lib/actions';
import { joinPaths, mockFs, resetFs, restoreFs } from '../../src/utils';
import ts from 'typescript';
import { tspPackageJSON } from '../../../src/installer/lib/system';
// noinspection ES6PreferShortImport
import { getTSPackage } from '../../../src/installer/lib/file-utils';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

/* Options to use with install/uninstall */
const TSP_OPTIONS = { silent: true };

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
  const { tsDir, tspDir, mockRootDir, tsLibDir, tsBackupDir, nodeModulesDir } = mockFs;
  beforeAll(() => {
    mockFs();
  });
  afterAll(() => {
    jest.restoreAllMocks();
    restoreFs();
  });

  test(`Set Options`, () => {
    expect(setOptions(TSP_OPTIONS)).toMatchObject(TSP_OPTIONS)
  });

  describe.each([ [ '', '0.0.0' ], [ ' (overwrite w/ higher version)', '1.1.1' ] ])
  (`Install%s`, (caption, version) => {
    let originalVersion: string;
    beforeAll(() => {
      resetFs();

      /* Set version */
      updatePackageJson(joinPaths(tspDir, 'package.json'), (pkgData) => pkgData.version = version);
      originalVersion = tspPackageJSON.version;
      tspPackageJSON.version = version;

      /* Install */
      install(TSP_OPTIONS);
    });
    afterAll(() => {
      tspPackageJSON.version = originalVersion
    });

    test(`Original modules backed up`, () => {
      checkModules(undefined, tsBackupDir, defaultInstallLibraries)
    });

    test(`All modules patched`, () => {
      checkModules(version, tsLibDir, defaultInstallLibraries)
    });

    test(`Backs up and patches typescript.d.ts`, () => {
      const backupSrc = fs.readFileSync(joinPaths(tsBackupDir, 'typescript.d.ts'), 'utf-8');
      expect(backupSrc).toMatch(/declare\snamespace\sts\s{/);
      expect(backupSrc).not.toMatch(/const\stspVersion:/);

      const patchSrc = fs.readFileSync(joinPaths(tsLibDir, 'typescript.d.ts'), 'utf-8');
      expect(patchSrc).toMatch(/declare\snamespace\sts\s{/);
      expect(patchSrc).toMatch(/const\stspVersion:/);
    });

    test(`Config file is correct`, () => {
      const file = joinPaths(tsDir, 'ts-patch.json');
      expect(fs.existsSync(file)).toBe(true);

      const config = getTSPackage(tsDir).config;

      expect(config).toMatchObject({ version: version });

      expect(Object
        .entries(config.modules)
        .filter(([ filename, timestamp ]) =>
          SRC_FILES.includes(filename) &&         // Filename must be valid
          !isNaN(parseFloat(<any>timestamp))      // Timestamp must be valid
        )
        .length
      ).toBe(defaultInstallLibraries.length);
    });

    test(`check() is accurate`, () => {
      const modules = check(SRC_FILES);
      expect(modules.map(({ filename }) => filename)).toEqual(SRC_FILES);
      expect(modules.unPatchable.length).toEqual(0);
      expect(modules.canUpdateOrPatch.map(m => m.filename)).toEqual(SRC_FILES.filter(s => !defaultInstallLibraries.includes(s)));
      expect(modules.patched.map(m => m.filename)).toEqual(defaultInstallLibraries);
      expect(modules.patchable.map(m => m.filename)).toEqual(SRC_FILES);
    });

    // Leave this as the final test, as it resets the virtual FS
    test(`No semantic errors in typescript.d.ts`, () => {
      const tsDtsFileSrc = fs.readFileSync(joinPaths(tsBackupDir, 'typescript.d.ts'), 'utf-8');
      restoreFs();

      const compilerOptions = Object.assign(ts.getDefaultCompilerOptions(), {
        target: 'ES5',
        lib: [ "es2015" ],
        skipDefaultLibCheck: true
      });
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
      resetFs();
      install(TSP_OPTIONS);
      uninstall(TSP_OPTIONS);
    });

    test(`Removes backup directory`, () => {
      expect(fs.existsSync(tsBackupDir)).toBe(false)
    });

    test(`Restores original modules`, () => checkModules(undefined, tsLibDir, defaultInstallLibraries));

    test(`Restores typescript.d.ts`, () => {
      const src = fs.readFileSync(joinPaths(tsLibDir, 'typescript.d.ts'), 'utf-8');
      expect(src).toMatch(/declare\snamespace\sts\s{/);
      expect(src).not.toMatch(/const\stspVersion:/);
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
    beforeEach(() => {
      resetFs();
    });

    test(`Patches single file`, () => {
      patch(SRC_FILES[0], TSP_OPTIONS);
      checkModules(tspPackageJSON.version, tsLibDir, [ SRC_FILES[0] ]);
    });

    test(`Patches array of files`, () => {
      patch(SRC_FILES, TSP_OPTIONS);
      checkModules(tspPackageJSON.version, tsLibDir);
    });

    test(`Patches glob`, () => {
      const srcFileNames = SRC_FILES.map(f => f.split('.')[0]);
      const globStr = joinPaths(tsLibDir, `{${srcFileNames.join(',')}}.js`);
      patch(globStr, TSP_OPTIONS);
      checkModules(tspPackageJSON.version, tsLibDir);
    });

    test(`Throws with TS version < 4.0`, () => {
      const pkgPath = joinPaths(tsDir, 'package.json');
      fs.writeFileSync(pkgPath,
        fs.readFileSync(pkgPath, 'utf-8')
          .replace(/"version": ".+?"/, `"version": "3.9.9"`)
      );
      let err: Error | undefined;
      try { patch(SRC_FILES, TSP_OPTIONS); }
      catch (e) { err = e; }
      expect(err && err.name).toBe('WrongTSVersion');
    });
  });
});
