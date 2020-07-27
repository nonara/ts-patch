import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { ScriptTarget } from 'typescript';
import * as progTransformers from '../assets/transformers/program-transformer';
import { newFiles } from '../assets/transformers/program-transformer';
import { getPatchedTS } from '../lib/mock-utils';
import { testAssetsDir, tsInstallationDirs } from '../lib/config';
import SpyInstance = jest.SpyInstance;

/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

const safelyCode = fs.readFileSync(path.join(testAssetsDir, 'src-files/safely-code.ts')).toString();
const safelyExpected =
  /^var a = { b: 1 };*[\s\r\n]*function abc\(\) {[\s\r\n]*var c = a && a.b;*[\s\r\n]*}[\s\r\n]*console.log\(abc.toString\(\)\);*$/m;

const basicCode = 'var a = 1';
const basicExpected = /^[\s\r\n]*var a = 1;*[\s\r\n]*$/m;

const defaultCompilerOptions = {
  ...ts.getDefaultCompilerOptions(),
  lib: undefined,
  types: undefined,
  noEmit: undefined,
  noEmitOnError: undefined,
  paths: undefined,
  rootDirs: undefined,
  composite: undefined,
  declarationDir: undefined,
  out: undefined,
  outFile: undefined,
  noResolve: true,
  noLib: true
}

/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/
describe.each([ ...tsInstallationDirs.keys() ])(`TypeScript - %s`, (tsVersion: string) => {
  let ts: typeof import('typescript');
  beforeAll(() => {
    const patchedTs = getPatchedTS(tsVersion);
    ts = patchedTs.ts;
    jest.mock('typescript', () => ts);
    expect(new RegExp('^' + tsVersion === 'latest' ? '3.9' : tsVersion).test(ts.version));
  });
  afterAll(() => jest.unmock('typescript'));

  it('Applies transformer from legacy config', () => {
    const res = ts.transpileModule(safelyCode, {
      compilerOptions: {
        plugins: [ {
          customTransformers: { before: [ path.join(__dirname, '../assets/transformers/safely.ts') ] },
        } ] as any,
      },
    });

    expect(res.outputText).toMatch(safelyExpected);
  });

  it('Applies transformer from default config', () => {
    const res = ts.transpileModule(safelyCode, {
      compilerOptions: {
        plugins: [ {
          transform: path.join(__dirname, '../assets/transformers/safely.ts'),
        } ] as any,
      },
    });

    expect(res.outputText).toMatch(safelyExpected);
  });

  it('Merges transformers', () => {
    const customTransformer = jest.fn((sf: any) => sf);

    const res = ts.transpileModule(safelyCode, {
      compilerOptions: {
        plugins: [ {
          transform: path.join(__dirname, '../assets/transformers/safely.ts'),
        } ] as any,
      },
      transformers: { before: [ () => customTransformer ] },
    });

    expect(res.outputText).toMatch(safelyExpected);
    expect(customTransformer).toBeCalledTimes(1);
  });

  describe(`TransformerExtras`, () => {
    let message = '';
    let diagnostics: ts.Diagnostic[];
    beforeAll(() => {
      const rootDir = path.join(testAssetsDir, 'src-files');
      const pcl = ts.getParsedCommandLineOfConfigFile(
        path.join(rootDir, 'tsconfig.alter-diags.json'),
        { noEmit: false },
        ts.sys as any,
      )!;
      const cwdMock = jest.spyOn(process, 'cwd').mockImplementation(() => rootDir);
      const program = ts.createProgram(pcl.fileNames, pcl.options);

      diagnostics = program.emit(
        ts.createSourceFile('a', '', ScriptTarget.ES5),
        /* writeFile */ (fileName: string, data: any) => message = String(data)
      ).diagnostics as ts.Diagnostic[];

      cwdMock.mockRestore();
    });

    test(`Diagnostics array passed`, () => expect(message).toMatch(/DIAG_PASSED=true/));
    test(`Found original error code`, () => expect(message).toMatch(/FOUND_ERROR=true/));
    test(`'library' is 'typescript'`, () => expect(message).toMatch(/LIBRARY=typescript/));
    test(`removeDiagnostic works`, () =>
      expect(diagnostics.find(({ code }) => code === 2339)).toBeFalsy()
    );
    test(`removeDiagnostic works`, () =>
      expect(diagnostics.find(({ code }) => code === 1337)).toBeTruthy()
    );
  });

  it('Runs 3rd party transformers', () => {
    const res = ts.transpileModule(basicCode, {
      compilerOptions: {
        plugins: [
          { transform: 'ts-transformer-keys/transformer' },
          { transform: 'ts-transformer-enumerate/transformer' },
          { transform: 'ts-transform-graphql-tag/dist/transformer' },
          { transform: 'ts-transform-img/dist/transform', type: 'config' },
          { transform: 'ts-transform-css-modules/dist/transform', type: 'config' },
          { transform: 'ts-transform-react-intl/dist/transform', type: 'config', import: 'transform' },
          { transform: 'ts-nameof', type: 'raw' },
        ] as any,
      },
    });

    expect(res.outputText).toMatch(basicExpected);
  });

  it('Skips ts plugin without errors', () => {
    const res = ts.transpileModule(basicCode, {
      compilerOptions: {
        plugins: [ { name: 'foobar' } ],
      },
    });
    expect(res.outputText).toMatch(basicExpected)
  });

  describe('Program transformer', () => {
    const safelyFile = path.join(__dirname, '../assets/safely-code.ts');
    const pluginsNormal: any[] = [
      {
        transform: path.join(__dirname, '../assets/transformers/program-transformer.ts'),
        transformProgram: true,
        import: 'progTransformer1'
      },
      {
        transform: path.join(__dirname, '../assets/transformers/program-transformer.ts'),
        transformProgram: true,
        import: 'progTransformer2'
      }
    ];
    const pluginsRecursive: any[] = [
      {
        transform: path.join(__dirname, '../assets/transformers/program-transformer.ts'),
        transformProgram: true,
        import: 'recursiveTransformer1'
      },
      {
        transform: path.join(__dirname, '../assets/transformers/program-transformer.ts'),
        transformProgram: true,
        import: 'recursiveTransformer2'
      }
    ];
    let spies: Map<string, SpyInstance>;

    beforeAll(() => {
      const fns = [ 'progTransformer1', 'progTransformer2', 'recursiveTransformer1', 'recursiveTransformer2' ] as const;
      spies = new Map<typeof fns[number], SpyInstance>(
        fns.map(f =>
          [ f, jest.spyOn(progTransformers, <any>f) ]
        )
      );
    });

    afterEach(() => spies.forEach(s => s.mockClear()));
    afterAll(() => spies.forEach(s => s.mockRestore()));

    test(`Transforms program once`, () => {
      const options = { ...defaultCompilerOptions, plugins: pluginsNormal.slice(0, 1) };
      const program = ts.createProgram([ safelyFile ], options);

      expect(spies.get('progTransformer1')).toBeCalledTimes(1);
      expect(spies.get('progTransformer2')).not.toBeCalled();
      expect(!!program.getSourceFile(newFiles[0])).toBe(true);
      expect(!!program.getSourceFile(newFiles[1])).toBe(false);
    });

    test(`Transforms program twice`, () => {
      const options = { ...defaultCompilerOptions, plugins: pluginsNormal };
      const program = ts.createProgram([ safelyFile ], options);

      expect(spies.get('progTransformer1')).toBeCalledTimes(1);
      expect(spies.get('progTransformer2')).toBeCalledTimes(1);
      expect(!!program.getSourceFile(newFiles[0])).toBe(false);
      expect(!!program.getSourceFile(newFiles[1])).toBe(true);
    });

    test(`Prevents createProgram recursion`, () => {
      const options = { ...defaultCompilerOptions, plugins: pluginsRecursive }
      ts.createProgram([ safelyFile ], options);

      expect(spies.get('recursiveTransformer1')).toBeCalledTimes(1);
      expect(spies.get('recursiveTransformer2')).toBeCalledTimes(1);
      expect((<any>progTransformers.progTsInstance)?.originalCreateProgram).toBeTruthy();
    });
  });
});
