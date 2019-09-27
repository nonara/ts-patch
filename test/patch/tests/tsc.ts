import path from 'path';
import shell from 'shelljs';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { expect } from 'chai';
import { libDir } from '../../lib/helpers';


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

const expectedOut =
  /^[\s\r\n]*function type\(\) {[\s\r\n]*return '';*[\s\r\n]*}[\s\r\n]*var x = "{ abc: 1; }";*[\s\r\n]*console.log\(x\);*$/m;

const assetsDir = path.resolve(__dirname, '../assets');
export const tscPath = path.join(libDir, 'tsc.js');
const transformedFile = path.resolve(__dirname, '../assets/tsnode-code.js');


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

export default function suite() {
  after(() => shell.rm('-rf', path.join(assetsDir, '*.js')));

  it('tsc transforms code', () => {
    const cmd = `node ${tscPath} --noEmit false`;

    execSync(cmd, { cwd: assetsDir, maxBuffer: 1e8 });
    expect(readFileSync(transformedFile, 'utf8')).to.match(expectedOut);
  });
}