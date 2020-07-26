/**
 * Test cases for specifying tsconfig as 'project' in config.
 *
 * Note: Unfortunately, because of jest's sandbox, we cannot directly test path mapping. It is not able to resolve
 *       mapped paths. Ideally, we'd be able to execute virtually in a context outside of
 *       jest, but there is not currently a clear way to do this.
 *
 *       For now, we have to resort to using a written copy of tsc in a tmp dir
 */
import path from 'path';
import { testAssetsDir, tsProjectsDir } from '../lib/config';
import shell from 'shelljs';
import fs from 'fs';
import os from 'os';
import child_process from 'child_process';
import { getPatchedTS } from '../lib/mock-utils';


/* ****************************************************************************************************************** *
 * Tests
 * ****************************************************************************************************************** */

describe('Specify Project', () => {
  const srcFilesPath = path.join(testAssetsDir, 'src-files/transformer-with-project');
  const destDir = path.join(os.tmpdir(), 'tmpTSC');
  const tscPath = path.join(destDir, 'node_modules/typescript/lib/tsc.js');
  beforeAll(() => {
    const { tscCode } = getPatchedTS('latest');

    shell.rm('-rf', destDir);
    shell.mkdir('-p', destDir);

    shell.cp('-r', `${srcFilesPath}/*`, destDir);
    shell.cp('-r', `${path.join(tsProjectsDir, 'latest')}/*`, destDir);

    fs.writeFileSync(tscPath, tscCode);
  });
  afterAll(() => shell.rm('-rf', destDir));

  test(`Loads project file & path mapping works`, () => {
    const cmd = `node ${tscPath} --noEmit false -p ${srcFilesPath}`;
    const res = child_process.execSync(cmd, { stdio: 'pipe' });
    expect(res.toString()).toMatch(/Path-Mapping Success!/);
  });

  test(`Mapping fails without project specified`, () => {
    const cmd = `node ${tscPath} --noEmit false -p ${path.join(srcFilesPath, 'tsconfig.noproject.json')}`;
    const fail = () => child_process.execSync(cmd, { stdio: 'pipe' });
    expect(fail).toThrow(/Cannot find module '#a'/);
  });

  test(`Logs warning if can't find tsconfig-paths`, () => {
    shell.rm('-r', path.join(destDir, 'node_modules/tsconfig-paths'));

    const cmd = `node ${tscPath} --noEmit false -p ${srcFilesPath}`;
    const fail = () => child_process.execSync(cmd, { stdio: 'pipe' });
    expect(fail).toThrow(/Try adding 'tsconfig-paths'/);
  });
});
