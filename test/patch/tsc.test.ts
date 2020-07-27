import path from 'path';
import vm from 'vm';
import module from 'module';
import { getPatchedTS } from '../lib/mock-utils';
import { testAssetsDir, tsInstallationDirs } from '../lib/config';
import { mockProcessExit, mockProcessStdout } from 'jest-mock-process';
import { normalizeSlashes } from 'ts-node';


/* ****************************************************************************************************************** */
// region: Vars
/* ****************************************************************************************************************** */

const expectedOut =
  /^[\s\r\n]*function type\(\) {[\s\r\n]*return '';*[\s\r\n]*}[\s\r\n]*var x = "{ abc: 1; }";*[\s\r\n]*console.log\(x\);*$/m;

const transformedFile = normalizeSlashes(path.resolve(testAssetsDir, 'src-files/tsnode-code.js'));

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function execTsc(tscPath: string, tscScript: vm.Script, cmd: string):
  { message: string, files: Record<string, string>, code: string }
{
  const args = cmd.split(' ');

  const outFiles = <Record<string, string>>{};

  /* Mocks */
  const mockStdOut = mockProcessStdout();
  const mockExit = mockProcessExit();
  const writeFile = jest.fn(
    (fileName: any, data: any) => outFiles[String(fileName)] = String(data)
  );

  /* Execute TSC */
  try {
    tscScript.runInThisContext()(
      exports,
      jest.requireActual,
      module,
      /* __filename */ tscPath,
      /* __dirname */ path.dirname(tscPath),
      args,
      process,
      writeFile
    );

    return ({
      message: mockStdOut.mock.calls.join('\n'),
      files: outFiles,
      code: String(mockExit.mock.calls.pop())
    });
  } finally {
    mockStdOut.mockRestore();
    mockExit.mockRestore();
  }
}

// endregion


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe.each([ ...tsInstallationDirs.keys() ])(`TSC - %s`, (tsVersion: string) => {
  let tscPath: string;
  let tscScript: vm.Script;
  beforeAll(() => {
    /* Prepare patched version of TS (for ts-node) */
    const { ts, tscCode } = getPatchedTS(tsVersion);
    jest.mock('typescript', () => ts);

    /* Setup TSC IIFE */
    tscPath = path.resolve(tsInstallationDirs.get(tsVersion)!, 'node_modules/typescript/lib/tsc.js');
    tscScript = new vm.Script(
      `(function (exports, require, module, __filename, __dirname, tscArgs, process, mockWriteFile) { \n` +
      tscCode.replace(
        /(^\s*?ts\.executeCommandLine\(ts.sys.+?;$)/m,
        `\nObject.assign(ts.sys, { args: tscArgs, writeFile: mockWriteFile });\n$1`
      ) +
      `})`
      , { filename: tscPath, displayErrors: false });
  });

  afterAll(() => jest.unmock('typescript'))

  test('tsc transforms code & outputs standard diagnostic', () => {
    const { code, message, files } =
      execTsc(tscPath, tscScript, `--noEmit false -p ${path.join(testAssetsDir, 'src-files')}`);

    expect(code).toBe('2');
    expect(message).toMatch(/TS2339/);
    expect(files[transformedFile]).toMatch(expectedOut);
  });

  describe(`Diagnostics`, () => {
    let code: string;
    let errors: string;
    let message: string;
    beforeAll(() => {
      const res = execTsc(
        tscPath,
        tscScript,
        `--noEmit false -p ${path.join(testAssetsDir, 'src-files/tsconfig.alter-diags.json')}`
      );
      code = res.code;
      message = res.files[transformedFile];
      errors = res.message;
    });

    test('Has proper exit code', () => expect(code).toBe('2'))
    test(`Diagnostics array passed`, () => expect(message).toMatch(/DIAG_PASSED=true/));
    test(`Found original error code`, () => expect(message).toMatch(/FOUND_ERROR=true/));
    test(`'library' is 'tsc'`, () => expect(message).toMatch(/LIBRARY=tsc/));
    test(`removeDiagnostic works`, () => {
      if (tsVersion === '2.7') {
        expect((errors.match(/TS2339/g) || [])).toHaveLength(1);
      } else {
        expect(errors).not.toMatch(/TS2339/);
      }
    });
    test(`addDiagnostic works`, () => expect(errors).toMatch(/TS1337/));
  });
});
