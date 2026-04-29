import { execSync } from 'child_process';
import { prepareTestProject } from '../src/project';


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function execAndGetErr(projectPath: string, projectFile = 'tsconfig.json') {
  const cmd = `node ./node_modules/webpack/bin/webpack.js --config webpack.config.js`;
  try {
    execSync(
      cmd,
      {
        cwd: projectPath,
        stdio: [ 'ignore', 'pipe', 'pipe' ],
        env: { ...process.env, TS_CONFIG: projectFile }
      });
  } catch (e) {
    return `${e.stdout.toString()}${e.stderr.toString()}`;
  }

  throw new Error('Expected error to be thrown, but none was');
}

// endregion


/* ****************************************************************************************************************** *
 * Tests
 * ****************************************************************************************************************** */

describe('Webpack', () => {
  let projectPath: string;
  beforeAll(() => {
    const prepRes = prepareTestProject({ projectName: 'webpack', packageManager: 'yarn' });
    projectPath = prepRes.tmpProjectPath;
  });

  test(`Compiler with CJS transformer works`, () => {
    const err = execAndGetErr(projectPath);
    expect(err).toContain('Error: ts-patch worked (cjs)');
  });

  test(`Compiler with ESM TS transformer works`, () => {
    const err = execAndGetErr(projectPath, 'tsconfig.esmts.json');
    expect(err).toContain('Error: ts-patch worked (esmts)');
  });

  test(`Compiler with ESM JS transformer works`, () => {
    const err = execAndGetErr(projectPath, 'tsconfig.esm.json');
    expect(err).toContain('Error: ts-patch worked (esm)');
  });
});
