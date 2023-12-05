import { execSync } from 'child_process';
import path from 'path';
import { assetsDir } from '../src/config';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const modes = ['enabled', 'disabled'];

// endregion


/* ****************************************************************************************************************** *
 * Tests
 * ****************************************************************************************************************** */

describe(`Project Package Config`, () => {
  const projectPath = path.resolve(assetsDir, 'projects/package-config');

  describe.each(modes)(`Config present = %s`, (mode) => {
    let output: string;

    beforeAll(() => {
      const command = `node run-transform.js ${mode === 'disabled' ? '--disable' : ''}`;
      output = execSync(command, { cwd: projectPath }).toString('utf8');
    });

    test(`Tags are ${mode === 'enabled' ? '' : 'not '}identified`, () => {
      const expectedOutput = mode === 'enabled' ? 'const myVar = "ExampleTag1 ExampleTag2";' : 'const myVar = 123;';
      expect(output).toMatch(new RegExp(`^${expectedOutput}$`, 'm'));
    });

    test(`Chained transformer works`, () => {
      // All lines should be prefixed with `const ` instead of `let `
      expect(output).toMatch(/^const /m);
    });
  });
});
