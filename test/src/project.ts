import path from 'path';
import { PackageManager, projectsDir, rootDir } from './config';
import fs from 'fs';
import * as os from 'os';
import shell from 'shelljs';
import { PartialSome } from './utils/general';
import { execSync } from 'child_process';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const pkgManagerInstallCmd = {
  npm: 'npm install --prefer-offline --no-audit --progress=false',
  yarn: 'yarn --prefer-offline --no-progress --check-cache --no-audit',
  pnpm: 'pnpm install --prefer-offline --no-audit --progress=false',
  yarn3: 'yarn install --immutable --mode update-lockfile --skip-builds'
} satisfies Record<PackageManager, string>;

const pkgManagerInstallerCmd = {
  npm: '',
  yarn: 'npm install --no-save --legacy-peer-deps yarn',
  yarn3: 'npm install --no-save --legacy-peer-deps yarn@3',
  pnpm: 'npm install --no-save --legacy-peer-deps pnpm'
} satisfies Record<PackageManager, string>;

// endregion


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface PrepareOptions {
  projectName: string;

  /** @default 'latest' */
  tsVersion: string;

  /** @default 'npm' */
  packageManager: PackageManager;

  dependencies?: Record<string, string>
}

export namespace PrepareOptions {
  export type Configurable = PartialSome<PrepareOptions, keyof ReturnType<typeof getDefaults>>

  export const getDefaults = () => ({
    packageManager: 'npm',
    tsVersion: 'latest'
  }) satisfies Partial<PrepareOptions>;
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getProjectTempPath(projectName?: string, packageManager?: string, wipe?: boolean) {
  const tmpProjectPath = path.join(os.tmpdir(), '.tsp-test/project', projectName ?? '', packageManager ?? '');
  if (!fs.existsSync(tmpProjectPath)) fs.mkdirSync(tmpProjectPath, { recursive: true });
  else if (wipe) shell.rm('-rf', path.join(tmpProjectPath, '*'));

  return tmpProjectPath;
}

export function getProjectPath(projectName: string) {
  return path.join(projectsDir, projectName);
}

export function prepareTestProject(opt: PrepareOptions.Configurable) {
  const options: PrepareOptions = { ...PrepareOptions.getDefaults(), ...opt };
  const { projectName, packageManager } = options;

  const projectPath = getProjectPath(projectName);
  if (!fs.existsSync(projectPath)) throw new Error(`Project "${projectName}" does not exist`);

  const tmpProjectPath = getProjectTempPath(projectName, packageManager, true);

  /* Copy all files from projectPath to tmpProjectPath */
  shell.cp('-R', path.join(projectPath, '*'), tmpProjectPath);

  shell.cd(tmpProjectPath);

  /* Copy ts-patch to node_modules */
  const tspDir = path.join(tmpProjectPath, '.tsp');
  if (!fs.existsSync(tspDir)) fs.mkdirSync(tspDir, { recursive: true });
  shell.cp('-R', path.join(rootDir, 'dist/*'), tspDir);

  /* Install package manager */
  if (pkgManagerInstallerCmd[packageManager]) shell.exec(pkgManagerInstallerCmd[packageManager]);

  /* Install dependencies */
  const pkgJson = JSON.parse(fs.readFileSync(path.join(tmpProjectPath, 'package.json'), 'utf8'));
  pkgJson.dependencies = {
    ...pkgJson.dependencies,
    ...options.dependencies,
    "typescript": options.tsVersion,
    "ts-patch": "file:./.tsp"
  };
  fs.writeFileSync(path.join(tmpProjectPath, 'package.json'), JSON.stringify(pkgJson, null, 2));

  execSync(pkgManagerInstallCmd[packageManager]);

  return { projectPath, tmpProjectPath };
}

export function clearProjectTempPath(projectName?: string) {
  shell.rm('-rf', getProjectTempPath(projectName));
}

// endregion
