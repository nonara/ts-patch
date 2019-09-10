import shell from 'shelljs';
import path from 'path';
import os from 'os';
import fs from 'fs';
import resolve from 'resolve';
import { expect } from 'chai';
import { install } from '../src';


/* ********************************************************************************************************************
 * Create Fake TS
 * ********************************************************************************************************************/

const pkgJSON = { "name": "blah", "version": "1.0.0", "dependencies": { "typescript": "^2.7.1" } };
const tmpDir = path.join(os.tmpdir(), 'tmpTSDir');

function createFakeTSInstallation() {
  const tsModuleDir = path.dirname(resolve.sync('typescript/package.json'));
  const destDir = path.join(tmpDir, 'node_modules', 'typescript');
  const libDir = path.join(destDir, 'lib');
  const files = ['typescript', 'tsserverlibrary', 'tsc', 'typescriptServices'].map(f => path.join(tsModuleDir,'lib',`${f}.js`));

   // Make tmp dir
  if (shell.rm('-rf', tmpDir) && shell.mkdir('-p', path.join(destDir,'lib')) && shell.error())
    throw new Error(`Could not create temp directory! ${shell.error()}`);

  // Write fake package JSON file
  fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(pkgJSON));

  /* Copy typescript files & patch */
  shell.cp(path.join(tsModuleDir,'package.json'), destDir);

  for (let srcFile of files ) {
    if (shell.cp(srcFile, libDir) && shell.error())
      throw new Error(`Error copying file ${path.basename(srcFile)}. ${shell.error()}`);
  }
}


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/
describe(`Patch files`, () => {
  createFakeTSInstallation();

  expect(install({verbose: true, basedir: tmpDir})).to.not.throw;
});

