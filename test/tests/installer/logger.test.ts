import { InstallerOptions, Log } from '../../../projects/core/src';
import { mockConsoleLog, mockProcessStderr, mockProcessStdout } from 'jest-mock-process';
// noinspection ES6PreferShortImport
import { setOptions } from '../../../projects/core/src/actions';


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

const hasColor = /\x1b\[[0-9;]*m/;

function log(opt?: Partial<InstallerOptions>, msg: string | [ string, string ] = [ '=', 'test' ]) {
  const { instanceIsCLI } = setOptions(opt);
  const logSpy = mockConsoleLog().mockImplementation();
  const stdOutSpy = mockProcessStdout().mockImplementation();
  const stdErrSpy = mockProcessStderr().mockImplementation();

  const isError = Array.isArray(msg) && (msg[0] === '!');

  try {
    Log(msg);

    let res:string;
    if (instanceIsCLI) {
      if (isError) {
        expect(stdErrSpy).toBeCalled();
        expect(stdOutSpy).not.toBeCalled();
        res = stdErrSpy.mock.calls.pop()![0];
      } else {
        expect(stdErrSpy).not.toBeCalled();
        expect(stdOutSpy).toBeCalled();
        res = stdOutSpy.mock.calls.pop()![0];
      }
    }
    else {
      expect(logSpy).toBeCalled();
      res = logSpy.mock.calls.pop()![0];
    }
    expect(res).toMatch(Array.isArray(msg) ? msg[1] : msg);

    return res;
  }
  finally {
    logSpy.mockRestore();
    stdOutSpy.mockRestore();
    stdErrSpy.mockRestore();
  }
}

// endregion


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`Logger`, () => {
  beforeAll(() => setOptions({ instanceIsCLI: false, logLevel: Log.normal }));

  test(`Uses colour if color=true`, () => expect(log({ color: true })).toMatch(hasColor));
  test(`Strips colour if color=false`, () => expect(log({ color: false })).not.toMatch(hasColor));

  describe(`CLI Mode`, () => {
    test(`Log goes to stdout`, () => { log({ instanceIsCLI: true }, [ '=', 'test' ]) });
    test(`Error goes to stderr`, () => { log({ instanceIsCLI: true }, [ '!', 'test' ]) });
  });
});
