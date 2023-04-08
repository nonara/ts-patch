import fs from 'fs';
import { check } from '../../../dist/actions';
import { TsModule } from '../../../dist/module';
import { defaultInstallLibraries } from '../../../dist/config';
import { getTsPackage, TsPackage } from '../../../dist/ts-package';
import { PackageManager } from '../../src/config';
import { prepareTestProject } from '../../src/project';
import path from 'path';
import { InstallerOptions } from '../../../dist';
import { LogLevel } from '../../../dist/system';
import { execSync } from 'child_process';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

/* Options to use with install/uninstall */
const testingPackageManagers = [
  'npm',
  'yarn',
  // 'pnpm',
  // 'yarn3'
] satisfies PackageManager[];

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function getModulesSources(tsPackage: TsPackage, moduleNames?: string[]) {
  moduleNames ??= defaultInstallLibraries;
  return new Map(moduleNames.map(name => {
    const modulePath = tsPackage.getModulePath(name);
    const dtsPath = modulePath.replace(/\.js$/, '.d.ts');
    const js = fs.readFileSync(modulePath, 'utf-8');
    const dts = fs.existsSync(dtsPath) ? fs.readFileSync(dtsPath, 'utf-8') : undefined;

    return [ name, { js, dts } ];
  }));
}

function updatePackageJson(pkgPath: string, cb: (pkgJson: any) => void) {
  let pkgJson = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  cb(pkgJson);
  fs.writeFileSync(pkgPath, JSON.stringify(pkgJson, null, 2));
}

function resetRequireCache(dir: string) {
  dir = path.dirname(require.resolve(dir));
  for (const key in require.cache) {
    if (key.startsWith(dir)) {
      delete require.cache[key];
    }
  }
}

function runAction(tspDir: string, kind: 'api' | 'cli', cmd: string) {
  switch (kind) {
    case 'api':
      const scriptCode = `
        require('ts-patch').${cmd}
      `;

      fs.writeFileSync(path.join(tspDir, 'run-cmd.js'), scriptCode, 'utf-8');
      execSync(`node run-cmd.js`, { cwd: tspDir });
      break;
    case 'cli':
      const flags = `--verbose`;
      execSync(`ts-patch ${cmd}`, { cwd: tspDir });
  }

  resetRequireCache(tspDir);
  const { getTsPackage } = require(path.join(tspDir, 'ts-package.js'));
  const { getTsModule } = require(path.join(tspDir, 'module'));
  const tsPackage = getTsPackage();
  const modules = defaultInstallLibraries.map((m: any) => getTsModule(tsPackage, m));

  return { modules, tsPackage };
}

function runInstall(tspDir: string, kind: 'api' | 'cli') {
  let cmd: string;
  if (kind === 'api') {
    const tspOptions: Partial<InstallerOptions> = {
      logLevel: LogLevel.verbose,
    };
    cmd = `install(${JSON.stringify(tspOptions)})`;
  } else {
    cmd = `install --verbose`;
  }

  return runAction(tspDir, kind, cmd);
}

function runUninstall(tspDir: string, kind: 'api' | 'cli') {
  let cmd: string;
  if (kind === 'api') {
    const tspOptions: Partial<InstallerOptions> = {
      logLevel: LogLevel.verbose,
    };
    cmd = `uninstall(${JSON.stringify(tspOptions)})`;
  } else {
    cmd = `uninstall --verbose`;
  }

  return runAction(tspDir, kind, cmd);
}

// endregion


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`Actions`, () => {
  // TODO - Parallelize
  describe.each(testingPackageManagers)(`%s`, (packageManager) => {
    /* Install */
    describe(`Install`, () => {
      let projectPath: string;
      let tmpProjectPath: string;
      let tspDir: string;
      let tsDir: string;
      let cachePath: string;
      let originalModulesSrc: Map<string, { js: string, dts: string | undefined }>;
      beforeAll(() => {
        const prepRes = prepareTestProject({ projectName: 'main', packageManager });
        projectPath = prepRes.projectPath;
        tmpProjectPath = prepRes.tmpProjectPath;

        const tsPackage = getTsPackage(tsDir);
        originalModulesSrc = getModulesSources(tsPackage);

        tspDir = path.resolve(tmpProjectPath, 'node_modules', 'ts-patch');
        tsDir = path.resolve(tmpProjectPath, 'node_modules', 'typescript');
        cachePath = path.resolve(tspDir, '../.cache/ts-patch');
      });

      describe.each([ [ '', '0.0.0' ], [ ' (overwrite w/ higher version)', '1.1.1' ] ])(`Install %s`, (caption, installedTspVersion) => {
        let tsPackage: TsPackage;
        let modules: TsModule[];
        beforeAll(() => {
          /* Set version */
          updatePackageJson(path.join(tspDir, 'package.json'), (pkgData) => pkgData.version = installedTspVersion);

          tsPackage = getTsPackage(tsDir);

          /* Install */
          const runRes = runInstall(tspDir, 'api');

          modules = runRes.modules;
        });

        test(`Original modules backed up`, () => {
          for (const m of modules) {
            const origSrcEntry = originalModulesSrc.get(m.moduleName)!;
            if (m.dtsPath) {
              const backupSrc = fs.readFileSync(m.backupCachePaths.dts!, 'utf-8');
              expect(backupSrc).toBe(origSrcEntry.dts);
            }

            const backupSrc = fs.readFileSync(m.backupCachePaths.js!, 'utf-8');
            expect(backupSrc).toBe(origSrcEntry.js);
          }
        });

        test(`All modules patched`, () => {
          modules.forEach(m => {
            expect(m.isPatched).toBe(true);
            expect(m.moduleFile.patchDetail?.tspVersion).toBe(installedTspVersion);
          })
        });

        test(`check() is accurate`, () => {
          const checkResult = check();
          const unpatchedModuleNames = tsPackage.moduleNames.filter(m => !defaultInstallLibraries.includes(m));
          unpatchedModuleNames.forEach(m => expect(checkResult[m]).toBeUndefined());
          defaultInstallLibraries.forEach(m => expect(checkResult[m]?.tspVersion).toBe(installedTspVersion));
        });
      });
    });

    /* Uninstall */
    describe(`Uninstall`, () => {
      let projectPath: string;
      let tmpProjectPath: string;
      let tspDir: string;
      let tsDir: string;
      let cachePath: string;
      let modules: TsModule[];
      let originalModulesSrc: Map<string, { js: string, dts: string | undefined }>;
      let tsPackage: TsPackage;
      beforeAll(() => {
        const prepRes = prepareTestProject({ projectName: 'main', packageManager });
        projectPath = prepRes.projectPath;
        tmpProjectPath = prepRes.tmpProjectPath;

        tsPackage = getTsPackage(tsDir);
        originalModulesSrc = getModulesSources(tsPackage);

        tspDir = path.resolve(tmpProjectPath, 'node_modules', 'ts-patch');
        tsDir = path.resolve(tmpProjectPath, 'node_modules', 'typescript');
        cachePath = path.resolve(tspDir, '../.cache/ts-patch');

        /* Install */
        let runRes = runInstall(tspDir, 'api');
        modules = runRes.modules;
        modules.forEach(m => {
          expect(m.isPatched).toBe(true);
        });

        /* Uninstall */
        runRes = runUninstall(tspDir, 'api');
        modules = runRes.modules;
      });

      test(`All modules unpatched`, () => {
        modules.forEach(m => {
          expect(m.isPatched).toBe(false);
          expect(m.moduleFile.patchDetail).toBeUndefined();
        });
      });

      test(`All files match originals`, () => {
        for (const m of modules) {
          const origSrcEntry = originalModulesSrc.get(m.moduleName)!;
          if (m.dtsPath) {
            const src = fs.readFileSync(m.dtsPath, 'utf-8');
            expect(src).toBe(origSrcEntry.dts);
          }

          const src = fs.readFileSync(m.modulePath, 'utf-8');
          expect(src).toBe(origSrcEntry.js);
        }
      });

      test(`check() is accurate`, () => {
        const checkResult = check();
        tsPackage.moduleNames.forEach(m => expect(checkResult[m]).toBeUndefined());
      });
    });
  });
});


// TODO
// test(`No semantic errors in typescript.d.ts`, () => {
//   const tsDtsFileSrc = fs.readFileSync(joinPaths(tsBackupDir, 'typescript.d.ts'), 'utf-8');
//   restoreFs();
//
//   const compilerOptions = Object.assign(ts.getDefaultCompilerOptions(), {
//     target: 'ES5',
//     lib: [ "es2015" ],
//     skipDefaultLibCheck: true
//   });
//   const host = ts.createCompilerHost(compilerOptions, false);
//   const originalReadFile = host.readFile;
//   host.readFile = fileName => (fileName === 'typescript.d.ts') ? tsDtsFileSrc : originalReadFile(fileName);
//
//   const program = ts.createProgram([ 'typescript.d.ts' ], compilerOptions, host);
//   const diagnostics = program.getSemanticDiagnostics();
//
//   // Using toHaveLength causes indefinite hang
//   expect(diagnostics.length).toBe(0);
// });
// });

// describe(`Patch`, () => {
//   beforeEach(() => {
//     resetFs();
//   });
//
//   test(`Patches single file`, () => {
//     patch(SRC_FILES[0], TSP_OPTIONS);
//     getModulePatchInfo(tspPackageJSON.version, tsLibDir, [ SRC_FILES[0] ]);
//   });
//
//   test(`Patches array of files`, () => {
//     patch(SRC_FILES, TSP_OPTIONS);
//     getModulePatchInfo(tspPackageJSON.version, tsLibDir);
//   });
//
//   test(`Throws with TS version < 4.0`, () => {
//     const pkgPath = joinPaths(tsDir, 'package.json');
//     fs.writeFileSync(pkgPath,
//       fs.readFileSync(pkgPath, 'utf-8')
//         .replace(/"version": ".+?"/, `"version": "3.9.9"`)
//     );
//     let err: Error | undefined;
//     try { patch(SRC_FILES, TSP_OPTIONS); }
//     catch (e) { err = e; }
//     expect(err && err.name).toBe('WrongTSVersion');
//   });
// });
