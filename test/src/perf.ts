import { getTsPackage, TsPackage } from '../../projects/core/src/ts-package';
import { getTsModule, GetTsModuleOptions, TsModule } from '../../projects/core/src/module';
import { getPatchedSource, GetPatchedSourceOptions } from '../../projects/core/src/patch/get-patched-source';
import child_process from 'child_process';
import path from 'path';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const tsLatestPath = path.dirname(require.resolve('ts-latest/package.json'));

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function perf(name: string, opt: any = {}, fn: () => any) {
  const start = performance.now();
  const res = fn();
  const end = performance.now();
  console.log(`${name} (${JSON.stringify(opt)}): \n  — duration: ${end - start} ms\n`);
  return res;
}

function printOpt(opt: any) {
  const printOpt = { ...opt };
  if (printOpt.tsPackage) printOpt.tsPackage = printOpt.tsPackage.packageDir;
  if (printOpt.tsModule) printOpt.tsModule = printOpt.tsModule.moduleName;
  return printOpt;
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function perfTsPackage(opt: { tsPath?: string } = {}) {
  opt.tsPath ??= tsLatestPath;
  perf(`tsPackage`, printOpt(opt), () => getTsPackage(opt.tsPath));
}

export function perfTsModule(opt: { moduleName?: TsModule.Name, tsPackage?: TsPackage } & GetTsModuleOptions = {}) {
  opt.tsPackage ??= getTsPackage(tsLatestPath);
  opt.moduleName ??= 'typescript.js';
  perf(`tsModule`, printOpt(opt), () => getTsModule(opt.tsPackage!, opt.moduleName!, opt));
}

export function perfGetPatchedSource(opt: { tsModule?: TsModule } & GetPatchedSourceOptions = {}) {
  opt.tsModule ??= getTsModule(getTsPackage(tsLatestPath), 'typescript.js');
  perf(`getPatchedSource`, printOpt(opt), () => getPatchedSource(opt.tsModule!, opt));
}

export function perfTspc(opt: { skipCache?: boolean } = {}) {
  opt.skipCache ??= false;
  perf(
    `tsc`,
    printOpt(opt),
    () => {
      // Execute tspc command with node in a child process
      child_process.execSync(`node ${path.resolve(__dirname, '../../dist/bin/tspc.js --help')}`, {
        env: {
          ...process.env,
          TSP_SKIP_CACHE: opt.skipCache ? 'true' : 'false',
          TSP_TS_PATH: tsLatestPath,
        }
      });
    }
  );
}

export function perfTsc() {
  perf(
    `tsc`,
    {},
    () => {
      child_process.execSync(`node ${path.join(tsLatestPath, 'lib/tsc.js')} --help`, {
        env: {
          ...process.env,
          TSP_TS_PATH: tsLatestPath,
        }
      });
    }
  );
}

export function perfAll() {
  perfTsPackage();
  perfTsModule();
  perfGetPatchedSource();
  perfTsc();
  perfTspc({ skipCache: true });
  perfTspc({ skipCache: false });
}

// endregion


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

if (require.main === module) perfAll();
