import { execSync } from 'child_process';
import { prepareTestProject } from '../src/project';


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

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

describe('Transformer diagnostics', () => {
  let projectPath: string;

  beforeAll(() => {
    const prepRes = prepareTestProject({ projectName: 'diagnostics', packageManager: 'npm' });
    projectPath = prepRes.tmpProjectPath;
  });

  test('tspc prints added diagnostics and honors removed diagnostics', () => {
    const output = execAndGetErrorOutput(
      `tspc --pretty false`,
      projectPath
    );

    expect(output).toContain('TS1337');
    expect(output).toContain('DIAG_ARRAY=true');
    expect(output).toContain('FOUND_ORIGINAL=true');
    expect(output).toContain('LIBRARY=tsc');
    expect(output).not.toContain('TS2339');
  });

  test('compiler API emit result includes added diagnostics', () => {
    const output = execSync(`node run-emit.js`, { cwd: projectPath }).toString('utf8');
    const diagnostics = JSON.parse(output) as Array<{ code: number, message: string }>;
    const diagnostic = diagnostics.find(({ code }) => code === 1337);

    expect(diagnostic?.message).toContain('DIAG_ARRAY=true');
    expect(diagnostic?.message).toContain('LIBRARY=typescript');
  });
});
