import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon, { SinonSpy } from 'sinon';
import { setOptions } from '../src';
import stripAnsi from 'strip-ansi';
import { run as runFn } from '../src/bin/cli';
import { getGlobalTSDir } from '../src/ts-utils';

chai.use(sinonChai);


/* ********************************************************************************************************************
 * Rewire
 * ********************************************************************************************************************/

const rewire = require('rewire');
const cliModule = rewire('../src/cli');

const actions = {
  install: sinon.fake(),
  uninstall: sinon.fake(),
  check: sinon.fake(),
  patch: sinon.fake()
};

cliModule.__set__('actions', actions);

const commands:any = cliModule.__get__('cliCommands');
const options:any = cliModule.__get__('cliOptions');


/* ********************************************************************************************************************
 * Helpers & Config
 * ********************************************************************************************************************/
const opts = { color: false };

const run = (...args:any[]) => { setOptions(opts); return cliModule.run(args.join(' ')) as ReturnType<typeof runFn> };
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`CLI`, () => {
  let logSpy:SinonSpy;
  before(() => logSpy = sinon.stub(console, 'log'));
  after(() => logSpy.restore());
  afterEach(() => logSpy.resetHistory());

  describe(`Action commands run`, () => {
    afterEach(sinon.resetHistory);

    it(`Install`, () => { run('install'); expect(actions['install']).to.be.calledOnce});
    it(`Uninstall`, () => { run('uninstall'); expect(actions['uninstall']).to.be.calledOnce});
    it(`Patch`, () => { run('patch'); expect(actions['patch']).to.be.calledOnce});
    it(`Check`, () => { run('check'); expect(actions['check']).to.be.calledOnce});
  });

  describe(`Log commands output`, () => {
    it(`Version`, () => { run('version'); expect(/ts-patch:/g.test(logSpy.lastCall.args.join(' '))).to.be.true });

    it(`Invalid command`, () => {
      run('notACommand_');
      expect(/Invalid command/g.test(logSpy.lastCall.args.join(' '))).to.be.true
    });

    describe(`Help`, () => {
      let output: string;
      before('init', () => {
        logSpy.resetHistory();
        run('help');
        output = logSpy.lastCall.args.join(' ');
      });

      it(`Header appears`, () => expect(/^\s*ts-patch \[command]/m.test(output)).to.be.true);

      it(`All commands appear`, () => {
        for (let [cmd, {short, caption, paramCaption}] of (Object.entries(commands) as [string, any])) {
          caption = stripAnsi(caption);
          paramCaption = stripAnsi(paramCaption);

          const regexStr =
            String.raw`^\s*${escape(cmd)}\s*.+?` +
            (short ? String.raw`\s*${escape(short)}.+?` : '') +
            (paramCaption ? String.raw`\s*${escape(paramCaption)}.+?` : '') +
            escape(caption) +
            `$`;

          expect({ [cmd]: new RegExp(regexStr,'m').test(output) }).to.eql({ [cmd]: true });
        }
      });

      it(`All args appear`, () => {
        for (let [arg, {short, caption, paramCaption, inverse}] of (Object.entries(options) as [string, any])) {
          caption = stripAnsi(caption);
          paramCaption = stripAnsi(paramCaption);
          if (inverse) arg = `no-${arg}`;

          const regexStr =
            '^' +
            (short ? String.raw`\s*-${escape(short)}.+?` : '') +
            String.raw`\s*--${escape(arg)}\s*.+?` +
            (paramCaption ? String.raw`\s*${escape(paramCaption)}.+?` : '') +
            escape(caption) +
            `$`;

          expect({ [arg]: new RegExp(regexStr,'m').test(output) }).to.eql({ [arg]: true });
        }
      });
    });
  });

  describe(`Parses all options`, () => {
    it(`Silent, Verbose`, () => {
      expect(run('v')!.options).to.include({ silent: false, verbose: false });
      expect(run('v', '-s -v')!.options).to.include({ silent: true, verbose: true });
      expect(run('v', '--silent --verbose')!.options).to.include({ silent: true, verbose: true });
    });

    it(`Global`, () => {
      expect(run('v', '-g')!.options).to.include({ basedir: getGlobalTSDir() });
      expect(run('v', '--global')!.options).to.include({ basedir: getGlobalTSDir() });

      // Throw with both global and basedir
      run('v', '-g -d /file/path');
      expect(logSpy.lastCall.args.join(' ')).to.include('Cannot specify both');
    });

    it(`Basedir`, () => {
      expect(run('v', `-d /file/path`)!.options).to.include({ basedir: '/file/path' });
      expect(run('v', '--basedir /file/path')!.options).to.include({ basedir: '/file/path' });
    });

    it(`Color`, () => {
      expect(run('v', '--color')!.options).to.include({ color: true });
      expect(run('v', '--no-color')!.options).to.include({ color: false });
    });
  });
});
