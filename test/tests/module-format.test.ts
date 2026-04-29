import { execSync } from 'child_process';
import { prepareTestProject } from '../src/project';


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function execCase(projectPath: string, caseName: string) {
  return execSync(
    `node run-case.js ${caseName}`,
    { cwd: projectPath, stdio: [ 'ignore', 'pipe', 'pipe' ] }
  ).toString('utf8');
}

function execCaseError(projectPath: string, caseName: string) {
  try {
    execCase(projectPath, caseName);
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

describe('Transformer module format detection', () => {
  let projectPath: string;

  beforeAll(() => {
    const prepRes = prepareTestProject({ projectName: 'module-format', packageManager: 'npm' });
    projectPath = prepRes.tmpProjectPath;
  });

  test.each([
    [ 'default-cjs' ],
    [ 'package-module-ts' ],
    [ 'explicit-esnext-ts' ],
    [ 'explicit-commonjs-ts' ],
    [ 'node-next-default-cjs' ],
    [ 'node-next-package-module' ],
    [ 'mts-commonjs' ],
    [ 'cts-esnext' ],
  ])('%s loads with the TypeScript emit format', (caseName) => {
    expect(execCase(projectPath, caseName)).toMatch(new RegExp(`const value = "${caseName}";?$`, 'm'));
  });

  test.each([
    [ 'unsupported-preserve', 'Preserve' ],
    [ 'unsupported-amd', 'AMD' ],
    [ 'unsupported-umd', 'UMD' ],
    [ 'unsupported-system', 'System' ],
  ])('%s rejects unsupported Node runtime emit format', (caseName, moduleKind) => {
    const output = execCaseError(projectPath, caseName);
    expect(output).toContain(`module" setting "${moduleKind}"`);
    expect(output).toContain('not loadable in Node');
  });

  test(`entry import.meta CommonJS runtime failure gets a ts-patch hint`, () => {
    const output = execCaseError(projectPath, 'import-meta-cjs');
    expect(output).toContain('uses "import.meta" but was loaded as CommonJS');
    expect(output).toContain('Rename the transformer or helper to ".mts"');
  });

  test(`lazy import.meta CommonJS runtime failure gets a ts-patch hint`, () => {
    const output = execCaseError(projectPath, 'lazy-import-meta-cjs');
    expect(output).toContain('uses "import.meta" but was loaded as CommonJS');
    expect(output).toContain('Rename the transformer or helper to ".mts"');
  });

  test(`top-level await CommonJS runtime failure gets a ts-patch hint`, () => {
    const output = execCaseError(projectPath, 'top-level-await-cjs');
    expect(output).toContain('uses top-level "await" but was loaded as CommonJS');
    expect(output).toContain('Rename the transformer or helper to ".mts"');
  });

  test(`top-level await ESM require failure gets a ts-patch hint`, () => {
    const output = execCaseError(projectPath, 'async-esm-entry');
    expect(output).toContain('contains top-level "await" in its ESM graph');
    expect(output).toContain('cannot be loaded synchronously with require()');
  });
});
