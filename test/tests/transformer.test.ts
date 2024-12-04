import { prepareTestProject } from '../src/project';
import { execSync } from 'child_process';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const transformerKinds = [
  'mts',
  'ts',
  'cts',
  'mjs',
  'cjs'
];

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
});
