import { execSync, ExecSyncOptions } from 'child_process';
import { prepareTestProject } from '../src/project';


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function execAndGetErr(projectPath: string, projectFile: string = '', hideModules?: string) {
  const extraOpts: ExecSyncOptions = {
    ...(hideModules ? { env: { ...process.env, HIDE_MODULES: hideModules } } : {})
  };

  const cmd = `ts-node ${hideModules ? '-r ./hide-module.js' : ''} -C ts-patch/compiler${projectFile ? ` -P ${projectFile}` : ''}`
  try {
    execSync(
      cmd,
      {
        cwd: projectPath,
        stdio: [ 'ignore', 'pipe', 'pipe' ],
        ...extraOpts
      });
  } catch (e) {
    return e.stderr.toString();
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
    const err = execAndGetErr(projectPath, './tsconfig.esmts.json');
    expect(err).toContain('Error: ts-patch worked (esmts)');
  });

  test(`Compiler with ESM JS transformer works`, () => {
    const err = execAndGetErr(projectPath, './tsconfig.esm.json');
    expect(err).toContain('Error: ts-patch worked (esm)');
  });

  test(`Compiler with ESM transformer throws if no ESM package`, () => {
    const err = execAndGetErr(projectPath, './tsconfig.esm.json', 'esm');
    expect(err).toContain('To enable experimental ESM support, install the \'esm\' package');
  });
});
