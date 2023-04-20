import { execSync } from 'child_process';
import { prepareTestProject } from '../src/project';


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
    expect(() => execSync('ts-node -C ts-patch/compiler', { cwd: projectPath }))
      .toThrowError('ts-patch worked');
  });

  test(`Compiler with ESM JS transformer works`, () => {
    expect(() => execSync('ts-node -C ts-patch/compiler -P ./tsconfig.esm.json', { cwd: projectPath }))
      .toThrowError('ts-patch worked (esm)');
  });

  test(`Compiler with ESM TS transformer works`, () => {
    expect(() => execSync('ts-node -C ts-patch/compiler -P ./tsconfig.esmts.json', { cwd: projectPath }))
      .toThrowError('ts-patch worked (esmts)');
  });
});
