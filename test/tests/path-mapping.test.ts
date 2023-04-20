import { prepareTestProject } from '../src/project';
import { execSync } from 'child_process';
import path from 'path';


/* ****************************************************************************************************************** *
 * Tests
 * ****************************************************************************************************************** */

describe(`Path Mapping`, () => {
  let projectPath: string;
  let output: string[];

  beforeAll(() => {
    const prepRes = prepareTestProject({ projectName: 'path-mapping', packageManager: 'yarn' });
    projectPath = prepRes.tmpProjectPath;

    let commandOutput: string;
    try {
      commandOutput = execSync('tspc', {
        cwd: projectPath,
        env: {
          ...process.env,
          PATH: `${projectPath}/node_modules/.bin${path.delimiter}${process.env.PATH}`
        }
      }).toString();
    } catch (e) {
      const err = new Error(e.stdout.toString() + '\n' + e.stderr.toString());
      console.error(err);
      throw e;
    }

    output = commandOutput.trim().split('\n');
  });

  test(`Resolves sub-paths`, () => {
    expect(output[0]).toEqual('sub-path:true');
  });

  test(`Resolves direct paths`, () => {
    expect(output[1]).toEqual('path:true');
  });

  test(`Cannot resolve unmapped paths`, () => {
    expect(output[2]).toEqual('non-mapped:false');
  });
});
