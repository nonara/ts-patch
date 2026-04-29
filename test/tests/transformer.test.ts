import { prepareTestProject } from '../src/project';
import { execSync } from 'child_process';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const transformerKinds = [
  'cts',
  'cjs',
  'mts',
  'ts',
  'node-next',
  'mjs'
];

function execAndGetErrorOutput(cmd: string, cwd: string) {
  try {
    execSync(cmd, { cwd, stdio: [ 'ignore', 'pipe', 'pipe' ] });
    return '';
  } catch (e) {
    const error = e as { stdout?: Buffer, stderr?: Buffer };
    return `${error.stdout?.toString('utf8') || ''}${error.stderr?.toString('utf8') || ''}`;
  }
}

// endregion


/* ****************************************************************************************************************** *
 * Tests
 * ****************************************************************************************************************** */

describe(`Transformer`, () => {
  let projectPath: string;
  let loaderResolve: (value?: unknown) => void;
  let loaderPromise = new Promise(resolve => loaderResolve = resolve);
  beforeAll(() => {
    const prepRes = prepareTestProject({
      projectName: 'transform',
      packageManager: 'yarn',
      tsVersion: '5.5.2',
    });
    projectPath = prepRes.tmpProjectPath;
    loaderResolve();
  });

  test.concurrent.each(transformerKinds)(`%s transformer works`, async (transformerKind: string) => {
    await loaderPromise;

    const res = execSync(`node run-transform.js ${transformerKind}`, { cwd: projectPath });
    expect(res.toString('utf8')).toMatch(new RegExp(`^(?:var|const) a = "after-${transformerKind}";?$`, 'm'));
  });

  test(`transformer compile errors surface as ts-patch errors`, async () => {
    await loaderPromise;

    expect(execAndGetErrorOutput(`node run-transform.js bad`, projectPath)).toMatch(/Unable to compile TypeScript transformer/);
  });

});
