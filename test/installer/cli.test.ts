import stripAnsi from 'strip-ansi';
import { run as runFn, cliCommands, cliOptions } from '../../src/installer/bin/cli';
import { getGlobalTSDir } from '../../src/installer/lib/file-utils';
import * as actions from '../../src/installer/lib/actions';

/* ****************************************************************************************************************** */
// region: Helpers & Config
/* ****************************************************************************************************************** */

const opts = { color: false };

const run = (...args: any[]) => {
  setOptions(opts);
  return runFn(args.join(' '));
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// endregion


/* ****************************************************************************************************************** */
// region: Module Mocks
/* ****************************************************************************************************************** */

jest.mock('../../src/installer/lib/actions');
const { setOptions } = jest.requireActual('../../src/installer/lib/actions');

// endregion



/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`CLI`, () => {
  let logSpy: jest.SpyInstance;
  beforeAll(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterAll(() => {
    logSpy.mockRestore();
    jest.unmock('../src/installer/lib/actions')
  });

  afterEach(() => jest.resetAllMocks());

  describe(`Action commands run`, () => {
    test(`Install`, () => {
      run('install');
      expect(actions.install).toBeCalled();
    });
    test(`Uninstall`, () => {
      run('uninstall');
      expect(actions.uninstall).toBeCalled()
    });
    test(`Patch`, () => {
      run('patch');
      expect(actions.patch).toBeCalled()
    });
    test(`Unpatch`, () => {
      run('unpatch');
      expect(actions.unpatch).toBeCalled()
    });
    test(`Check`, () => {
      run('check');
      expect(actions.check).toBeCalled()
    });
    test(`--persist`, () => {
      run('--persist');
      expect(actions.enablePersistence).toBeCalled()
    });
    test(`--no-persist`, () => {
      run('--no-persist');
      expect(actions.disablePersistence).toBeCalled()
    });
  });

  describe(`Log commands output`, () => {
    test(`Version`, () => {
      run('version');
      expect(/ts-patch:/g.test(logSpy.mock.calls.pop().join(' '))).toBe(true)
    });

    test(`Invalid command`, () => {
      run('notACommand_');
      expect(/Invalid command/g.test(logSpy.mock.calls.pop().join(' '))).toBe(true)
    });

    describe(`Help`, () => {
      let output: string;
      beforeAll(() => {
        logSpy.mockReset();
        run('help');
        output = logSpy.mock.calls.pop().join(' ');
      });

      test(
        `Header appears`,
        () => expect(/^\s*ts-patch \[command]/m.test(output)).toBe(true)
      );

      test(`All commands appear`, () => {
        for (let [ cmd, { short, caption, paramCaption } ] of (Object.entries(cliCommands) as [ string, any ])) {
          caption = stripAnsi(caption);
          paramCaption = stripAnsi(paramCaption);

          const regexStr =
            String.raw`^\s*` +
            String.raw`${escape(cmd)},?\s+?` +
            (short ? String.raw`${escape(short)}\s+?` : '') +
            (paramCaption ? String.raw`${escape(paramCaption)}\s+?` : '') +
            String.raw`\.+?\s+?` +
            escape(caption) +
            `$`;

          expect({ [cmd]: new RegExp(regexStr, 'm').test(output) }).toEqual({ [cmd]: true });
        }
      });

      test(`All args appear`, () => {
        for (let [ arg, { short, caption, paramCaption, inverse } ] of (Object.entries(cliOptions) as [ string, any ])) {
          caption = stripAnsi(caption);
          paramCaption = stripAnsi(paramCaption);
          if (inverse) arg = `no-${arg}`;

          const regexStr =
            String.raw`^\s*` +
            (short ? String.raw`-${escape(short)},\s+?` : '') +
            String.raw`--${escape(arg)}\s+?` +
            (paramCaption ? String.raw`${escape(paramCaption)}\s+?` : '') +
            String.raw`\.+?\s+?` +
            escape(caption) +
            `$`;

          expect({ [arg]: new RegExp(regexStr, 'm').test(output) }).toEqual({ [arg]: true });
        }
      });
    });
  });

  describe(`Parses all options`, () => {
    test(`Silent, Verbose`, () => {
      expect(run('v')!.options).toMatchObject({ silent: false, verbose: false });
      expect(run('v', '-s -v')!.options).toMatchObject({ silent: true, verbose: true });
      expect(run('v', '--silent --verbose')!.options).toMatchObject({ silent: true, verbose: true });
    });

    test(`Global`, () => {
      const globalTSDir = (() => {
        try { return getGlobalTSDir(); }
        catch (e) { return undefined }
      })();

      if (globalTSDir) {
        expect(run('v', '-g')!.options).toMatchObject({ basedir: globalTSDir });
        expect(run('v', '--global')!.options).toMatchObject({ basedir: globalTSDir });
      } else {
        run('v', '-g');
        expect(logSpy.mock.calls.pop().join(' ')).toMatch(/Could not find global TypeScript installation!/);
        logSpy.mockReset();
        run('v', '--global');
        expect(logSpy.mock.calls.pop().join(' ')).toMatch(/Could not find global TypeScript installation!/);
      }

      // Throw with both global and basedir
      run('v', '-g -d /file/path');
      expect(logSpy.mock.calls.pop().join(' ')).toMatch('Cannot specify both');
    });

    test(`Basedir`, () => {
      expect(run('v', `-d /file/path`)!.options).toMatchObject({ basedir: '/file/path' });
      expect(run('v', '--basedir /file/path')!.options).toMatchObject({ basedir: '/file/path' });
    });

    test(`Color`, () => {
      expect(run('v', '--color')!.options).toMatchObject({ color: true });
      expect(run('v', '--no-color')!.options).toMatchObject({ color: false });
    });
  });
});
