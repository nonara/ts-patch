import { execSync } from 'child_process';
import { prepareTestProject } from '../src/project';


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

interface ProgramTransformerCaseResult {
  addedOne: boolean;
  addedTwo: boolean;
  recursiveAdded: boolean;
  state: {
    addOne: number;
    addTwo: number;
    recursive: number;
    addTwoSawAddOne: boolean;
    originalCreateProgramAvailable: boolean;
  };
}

function execCase(projectPath: string, caseName: string): ProgramTransformerCaseResult {
  return JSON.parse(execSync(
    `node run-case.js ${caseName}`,
    {
      cwd: projectPath,
      timeout: 10000,
      stdio: [ 'ignore', 'pipe', 'pipe' ]
    }
  ).toString('utf8'));
}

// endregion


/* ****************************************************************************************************************** *
 * Tests
 * ****************************************************************************************************************** */

describe('Program transformers', () => {
  let projectPath: string;

  beforeAll(() => {
    const prepRes = prepareTestProject({ projectName: 'program-transformer', packageManager: 'npm' });
    projectPath = prepRes.tmpProjectPath;
  });

  test('program transformers chain and receive replaced programs', () => {
    const result = execCase(projectPath, 'chain');

    expect(result.addedOne).toBe(true);
    expect(result.addedTwo).toBe(true);
    expect(result.state.addOne).toBe(1);
    expect(result.state.addTwo).toBe(1);
    expect(result.state.addTwoSawAddOne).toBe(true);
  });

  test('recursive createProgram calls do not re-enter the active transformer', () => {
    const result = execCase(projectPath, 'recursive');

    expect(result.recursiveAdded).toBe(true);
    expect(result.state.recursive).toBe(1);
    expect(result.state.originalCreateProgramAvailable).toBe(true);
  });
});
