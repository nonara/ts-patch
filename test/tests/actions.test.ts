import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { check, install, patch, uninstall, unpatch } from '../../dist/actions';
import { getModuleFile, getTsModule, TsModule } from '../../dist/module';
import { getTsPackage, TsPackage } from '../../dist/ts-package';
import { LogLevel, PatchError } from '../../dist/system';
import { InstallerOptions } from '../../dist';
import { PackageManager } from '../src/config';
import { prepareTestProject } from '../src/project';
import { execSync } from 'child_process';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const verboseMode = !!process.env.VERBOSE;

const testingPackageManagers = [
  'npm',
  'yarn',
  'pnpm',
  // 'yarn3'
] satisfies PackageManager[];

const tspOptions: Partial<InstallerOptions> = {
  logLevel: verboseMode ? LogLevel.verbose : LogLevel.system,
  silent: !verboseMode
};

const patchableModuleNames = [ ...TsModule.patchableNames ];

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function getModulesSources(tsPackage: TsPackage, moduleNames = patchableModuleNames) {
  return new Map(moduleNames.map(name => {
    const modulePath = tsPackage.getModulePath(name);
    const dtsPath = modulePath.replace(/\.js$/, '.d.ts');
    const moduleContentPath = TsModule.getContentFilePathForModulePath(modulePath);

    const js = fs.readFileSync(moduleContentPath, 'utf-8');
    const dts = fs.existsSync(dtsPath) ? fs.readFileSync(dtsPath, 'utf-8') : undefined;

    return [ name, { js, dts } ];
  }));
}

function getModules(tsPackage: TsPackage, moduleNames = patchableModuleNames) {
  return moduleNames.map(name => getTsModule(tsPackage, name, { skipCache: true }));
}

function getOptions(tsDir: string): Partial<InstallerOptions> {
  return { ...tspOptions, dir: tsDir };
}

function expectUnsupportedTarget(fn: () => unknown) {
  try {
    fn();
    throw new Error('Expected unsupported target error');
  } catch (e) {
    expect(e).toBeInstanceOf(PatchError);
    expect((e as PatchError).code).toBe('PATCH_TARGET_UNSUPPORTED');
  }
}

// endregion


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`TSP Actions`, () => {
  describe.each(testingPackageManagers)(`%s`, (packageManager) => {
    describe(`install`, () => {
      let tsDir: string;
      let tsPackage: TsPackage;
      let modules: TsModule[];
      let originalModulesSrc: Map<string, { js: string, dts: string | undefined }>;

      beforeAll(() => {
        const { tmpProjectPath } = prepareTestProject({ projectName: 'main', packageManager });
        tsDir = path.resolve(tmpProjectPath, 'node_modules', 'typescript');
        tsPackage = getTsPackage(tsDir);
        originalModulesSrc = getModulesSources(tsPackage);

        const res = install(getOptions(tsDir));
        expect(res).toBe(true);

        tsPackage = getTsPackage(tsDir);
        modules = getModules(tsPackage);
      });

      test(`Original modules backed up`, () => {
        for (const m of modules) {
          const origSrcEntry = originalModulesSrc.get(m.moduleName)!;

          if (m.dtsPath) {
            const backupSrc = fs.readFileSync(m.backupCachePaths.dts!, 'utf-8');
            expect(backupSrc).toBe(origSrcEntry.dts);
          }

          const backupSrc = fs.readFileSync(m.backupCachePaths.js, 'utf-8');
          expect(backupSrc).toBe(origSrcEntry.js);
        }
      });

      test(`Patchable modules installed`, () => {
        modules.forEach(m => {
          expect(m.isPatched).toBe(true);
          expect(m.moduleFile.patchDetail?.moduleName).toBe(m.moduleName);
        });
      });

      test(`Service modules are not persistent patch targets`, () => {
        for (const moduleName of TsModule.legacyServiceNames) {
          const modulePath = tsPackage.getModulePath(moduleName);
          expect(getModuleFile(modulePath).patchDetail).toBeUndefined();
        }
      });

      test(`check() reports patchable modules only`, () => {
        const checkResult = check(undefined, getOptions(tsDir));
        expect(Object.keys(checkResult).sort()).toEqual([ ...patchableModuleNames ].sort());
        patchableModuleNames.forEach(m => expect(checkResult[m]?.moduleName).toBe(m));
      });

      test(`No semantic errors in typescript.d.ts`, () => {
        const dtsFilePath = path.join(tsDir, 'typescript.d.ts');

        const compilerOptions = Object.assign(ts.getDefaultCompilerOptions(), {
          target: ts.ScriptTarget.ES2018,
          lib: [ 'es2018' ],
          skipDefaultLibCheck: true
        });

        const program = ts.createProgram([ dtsFilePath ], compilerOptions);
        const diagnostics = program.getSemanticDiagnostics();

        // Using toHaveLength causes indefinite hang
        expect(diagnostics.length).toBe(0);
      });
    });

    describe(`uninstall`, () => {
      let tsDir: string;
      let tsPackage: TsPackage;
      let modules: TsModule[];
      let originalModulesSrc: Map<string, { js: string, dts: string | undefined }>;

      beforeAll(() => {
        const { tmpProjectPath } = prepareTestProject({ projectName: 'main', packageManager });
        tsDir = path.resolve(tmpProjectPath, 'node_modules', 'typescript');
        tsPackage = getTsPackage(tsDir);
        originalModulesSrc = getModulesSources(tsPackage);

        expect(install(getOptions(tsDir))).toBe(true);
        expect(uninstall(getOptions(tsDir))).toBe(true);

        tsPackage = getTsPackage(tsDir);
        modules = getModules(tsPackage);
      });

      test(`Patchable modules uninstalled`, () => {
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

          const contentFilePath = TsModule.getContentFilePathForModulePath(m.modulePath);
          const src = fs.readFileSync(contentFilePath, 'utf-8');
          expect(src).toBe(origSrcEntry.js);
        }
      });

      test(`check() is accurate`, () => {
        const checkResult = check(undefined, getOptions(tsDir));
        patchableModuleNames.forEach(m => expect(checkResult[m]).toBeUndefined());
      });
    });
  });

  test(`CLI install and uninstall patch only patchable modules`, () => {
    const { tmpProjectPath } = prepareTestProject({ projectName: 'main', packageManager: 'npm' });
    const tsDir = path.resolve(tmpProjectPath, 'node_modules', 'typescript');
    const binPath = path.resolve(tmpProjectPath, 'node_modules', '.bin', 'ts-patch');

    execSync(`${binPath} install --silent`, { cwd: tmpProjectPath });

    let tsPackage = getTsPackage(tsDir);
    for (const moduleName of patchableModuleNames) {
      expect(getTsModule(tsPackage, moduleName, { skipCache: true }).isPatched).toBe(true);
    }
    for (const moduleName of TsModule.legacyServiceNames) {
      expect(getModuleFile(tsPackage.getModulePath(moduleName)).patchDetail).toBeUndefined();
    }

    execSync(`${binPath} uninstall --silent`, { cwd: tmpProjectPath });

    tsPackage = getTsPackage(tsDir);
    for (const moduleName of patchableModuleNames) {
      expect(getTsModule(tsPackage, moduleName, { skipCache: true }).isPatched).toBe(false);
    }
  });

  test(`service modules are rejected by patch APIs`, () => {
    expectUnsupportedTarget(() => patch('tsserver', tspOptions));
    expectUnsupportedTarget(() => patch('tsserverlibrary', tspOptions));
    expectUnsupportedTarget(() => unpatch('tsserver', tspOptions));
    expectUnsupportedTarget(() => check('tsserver', tspOptions));
  });
});
