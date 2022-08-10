import path from 'path';
import vm from 'vm';
import module from 'module';
import { mockProcessExit, mockProcessStdout, mockProcessStderr } from 'jest-mock-process';
import { normalizeSlashes } from 'typescript';
import { assetsDir, tmpDir, tsModules } from '../../src/config';
import fs from 'fs';
import child_process from 'child_process';


/* ****************************************************************************************************************** */
// region: Vars
/* ****************************************************************************************************************** */

const expectedOut =
  /^[\s\r\n]*function type\(\) {[\s\r\n]*return '';*[\s\r\n]*}[\s\r\n]*var x = "{ abc: 1; }";*[\s\r\n]*console.log\(x\);*$/m;

const transformedFile = normalizeSlashes(path.resolve(assetsDir, 'src-files/tsnode-code.js'));

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function execTsc(tscPath: string, tscScript: vm.Script, cmd: string):
  { message: string | undefined, err: string | undefined, files: Record<string, string>, code: string }
{
  const args = cmd.split(' ');

  const outFiles = <Record<string, string>>{};

  /* Mocks */
  const mockStdOut = mockProcessStdout();
  const mockStdErr = mockProcessStderr();
  const mockExit = mockProcessExit();

  try {
    const writeFile = jest.fn(
      (fileName: any, data: any) => outFiles[String(fileName)] = String(data)
    );

    /* Execute TSC */
    let thrownErr: string[] = [];
    try {
      tscScript.runInThisContext()(
        exports,
        require,
        module,
        /* __filename */ tscPath,
        /* __dirname */ path.dirname(tscPath),
        args,
        process,
        writeFile,
        console
      );
    } catch (e) {
      thrownErr.push(String(e));
    }

    return ({
      message: mockStdOut.mock.calls.join('\n'),
      err: [ ...mockStdErr.mock.calls, ...thrownErr ].join('\n'),
      files: outFiles,
      code: String(mockExit.mock.calls.pop())
    });
  } finally {
    mockStdOut.mockRestore();
    mockStdErr.mockRestore();
    mockExit.mockRestore();
  }
}

// endregion


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`TSC`, () => {
  describe.each(tsModules)(`TS $label`, ({ moduleSpecifier }) => {
    let tscPath: string;
    let tscScript: vm.Script;
    beforeAll(() => {
      tscPath = path.join(tmpDir, moduleSpecifier, 'lib/tsc.js');
      const tscCode = fs.readFileSync(tscPath, 'utf8');
      tscScript = new vm.Script(
        `(function (exports, require, module, __filename, __dirname, tscArgs, process, mockWriteFile, console) { \n` +
        tscCode.replace(
          /(^\s*?ts\.executeCommandLine\(ts\.sys)/m,
          `\nObject.assign(ts.sys, { args: tscArgs, writeFile: mockWriteFile });\n$1`
        ) +
        `})`
        , { filename: tscPath, displayErrors: false });
    });

    test('tsc transforms code & outputs standard diagnostic', () => {
      const {
        code,
        message,
        files
      } = execTsc(tscPath, tscScript, `--noEmit false -p ${path.join(assetsDir, 'src-files')}`);

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
          `--noEmit false -p ${path.join(assetsDir, 'src-files/tsconfig.alter-diags.json')}`
        );
        code = res.code;
        message = res.files[transformedFile];
        errors = res.message!;
      });

      test('Has proper exit code', () => {
        expect(code).toBe('2')
      })

      test(`Diagnostics array passed`, () => {
        expect(message).toMatch(/DIAG_PASSED=true/)
      });

      test(`Found original error code`, () => {
        expect(message).toMatch(/FOUND_ERROR=true/)
      });

      test(`'library' is 'tsc'`, () => {
        expect(message).toMatch(/LIBRARY=tsc/)
      });

      test(`removeDiagnostic works`, () => {
        expect(errors).not.toMatch(/TS2339/);
      });

      test(`addDiagnostic works`, () => {
        expect(errors).toMatch(/TS1337/)
      });
    });

    describe(`Path Mapping`, () => {
      const mappingProjectPath = path.join(assetsDir, 'src-files/mapping-project');
      test(`Warns without tsconfig-paths`, () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        jest.doMock(
          "tsconfig-paths",
          () => {
            require("sdf0s39rf3333d@fake-module");
          },
          { virtual: true }
        );
        try {
          const res = execTsc(tscPath, tscScript, `--noEmit false -p ${mappingProjectPath}`);
          expect(warnSpy).toHaveBeenCalledTimes(1);
          expect(warnSpy.mock.calls.slice(-1)[0][0]).toMatch(`try adding 'tsconfig-paths'`)
        } finally {
          jest.dontMock('tsconfig-paths');
          warnSpy.mockRestore()
        }
      });

      test(`Does not warn without tsconfig-paths`, () => {
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
        try {
          const res = execTsc(tscPath, tscScript, `--noEmit false -p ${mappingProjectPath}`);
          expect(warnSpy).not.toHaveBeenCalled();
        } finally {
          warnSpy.mockRestore();
        }
      });

      test(`Loads project file & path mapping works`, () => {
        const cmd = `node ${tscPath} --noEmit false -p ${mappingProjectPath}`;
        const res = child_process.spawnSync(cmd, { stdio: 'pipe', shell: true });
        expect(res.stdout.toString()).toMatch(/Path-Mapping Success!/);
      });

      test(`Mapping fails without project specified`, () => {
        const cmd = `node ${tscPath} --noEmit false -p ${path.join(mappingProjectPath, 'tsconfig.noproject.json')}`;
        const res = child_process.spawnSync(cmd, { stdio: 'pipe', shell: true  });
        expect(res.stderr.toString()).toMatch(/Cannot find module '#a'/);
      });
    });
  });
});
