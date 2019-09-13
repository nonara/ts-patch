import { getGlobalTSDir, getTSInfo, Log, TSPOptions } from '../src/system';
import { setOptions } from '../src';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { stdout, stderr } from 'test-console';

chai.use(sinonChai);


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

function log(opt?: Partial<TSPOptions>, msg: string | [string, string] = ['=', 'test']) {
  const {instanceIsCLI} = setOptions(opt);
  const logSpy = sinon.stub(console, 'log');
  const inspectOut = stdout.inspect();
  const inspectErr = stderr.inspect();

  const isError = Array.isArray(msg) && (msg[0] === '!');

  try {
    Log(msg);

    if (instanceIsCLI) {
      expect(logSpy).to.not.be.called;
      if (isError) expect(inspectOut.output.length < 1 && inspectErr.output.length >= 1).to.be.true;
      else expect(inspectOut.output.length >= 1 && inspectErr.output.length < 1).to.be.true;
    }
    else expect(inspectOut.output.length < 1 && inspectErr.output.length < 1).to.be.true;

    return {
      console: !instanceIsCLI ? logSpy.lastCall.args.join(' ') : '',
      stderr: inspectErr.output.toString(),
      stdout: inspectOut.output.toString()
    };
  } finally {
    logSpy.restore();
    inspectOut.restore();
    inspectErr.restore();
  }
}

const hasColor = /\x1b\[[0-9;]*m/g;


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`System`, () => {
  describe(`getGlobalTSDir`, () => {
    const tsDir = getGlobalTSDir();

    it(`Returns a result`, () => expect(tsDir).to.not.be.undefined);
    it(`Is valid TS dir`, () => expect(getTSInfo(tsDir)).to.not.throw);
    it(`Path includes npm global prefix`, () => expect(tsDir).to.include(require('global-prefix')));
  });

  describe(`Logger`, () => {
    before(() => setOptions({ logLevel: Log.normal }));

    it(`Uses colour if color=true`, () => expect(hasColor.test(log({ color: true }).console)).to.be.true);
    it(`Strips colour if color=false`, () => expect(hasColor.test(log({ color: false }).console)).to.be.false);

    describe(`CLI Mode`, () => {
      it(`Log goes to stdout`, () =>
        expect(/std_out/g.test(log({ instanceIsCLI: true },['=','std_out']).stdout)).to.be.true
      );
      it(`Error goes to stderr`, () =>
        expect(/std_err/g.test(log({ instanceIsCLI: true },['!','std_err']).stderr)).to.be.true
      );
    });
  });
});