import { prepareTestProject } from '../src/project';
import { execSync } from 'child_process';
import path from 'path';

/* ****************************************************************************************************************** *
 * Tests
 * ****************************************************************************************************************** */

describe('Transformer Extras addDiagnostics', () => {
  let projectPath: string;
  let output: string[];

  beforeAll(() => {
    const prepRes = prepareTestProject({ projectName: 'transformer-extras' });
    projectPath = prepRes.tmpProjectPath;

    let commandOutput: string;
    try {
      commandOutput = execSync('ts-node src/compiler.ts', {
        cwd: projectPath,
        env: {
          ...process.env,
          PATH: `${projectPath}/node_modules/.bin${path.delimiter}${process.env.PATH}`
        }
      }).toString();
    }
    catch (e) {
      const err = new Error(e.stdout.toString() + '\n' + e.stderr.toString());
      console.error(err);
      throw e;
    }

    output = commandOutput.trim().split('\n');
  });

  test('Provide emit result diagnostics and semantic diagnostics and merge it with original diagnostics', () => {
    const [ emitResultDiagnosticsText, semanticDiagnosticsText ] = output;

    const emitResultDiagnostics = JSON.parse(emitResultDiagnosticsText.split('emitResultDiagnostics:')[1]);
    const semanticDiagnostics = JSON.parse(semanticDiagnosticsText.split('semanticDiagnostics:')[1]);

    const filePath = path.join(projectPath, 'src/index.ts');
    const expectedEmitResultDiagnostics = [
      {
        file: expect.stringContaining(filePath),
        code: 42,
        start: 0,
        length: 1,
        messageText: 'It\'s a warning message!',
        category: 0
      }, {
        file: expect.stringContaining(filePath),
        code: 42,
        start: 1,
        length: 2,
        messageText: 'It\'s an error message!',
        category: 1
      }, {
        file: expect.stringContaining(filePath),
        code: 42,
        start: 2,
        length: 3,
        messageText: 'It\'s a suggestion message!',
        category: 2
      }, {
        file: expect.stringContaining(filePath),
        code: 42,
        start: 3,
        length: 4,
        messageText: 'It\'s a message!',
        category: 3
      }
    ];
    const expectedSemanticDiagnostics = [
      {
        file: expect.stringContaining(filePath),
        code: 2322,
        category: 1,
        length: 1,
        messageText: 'Type \'number\' is not assignable to type \'string\'.',
        start: 13,
      },
      ...expectedEmitResultDiagnostics,
    ]

    expect(emitResultDiagnostics).toEqual(expectedEmitResultDiagnostics);
    expect(semanticDiagnostics).toEqual(expectedSemanticDiagnostics);
  });
});
