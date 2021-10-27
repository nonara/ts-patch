import fs from 'fs';
import path from 'path';
import type TS from 'typescript';
import { ScriptTarget } from 'typescript';
import * as programTransformers from '../../assets/transformers/program-transformer';
import { newFiles } from '../../assets/transformers/program-transformer';
import SpyInstance = jest.SpyInstance;
import { assetsDir, tmpDir, tsModules } from '../../src/config';

/* ********************************************************************************************************************
 * Locals
 * ********************************************************************************************************************/

const safelyCodePath = path.join(assetsDir, 'src-files/safely-code.ts');
const safelyCode = fs.readFileSync(safelyCodePath).toString();
const safelyExpected =
  /^var a = { b: 1 };*[\s\r\n]*function abc\(\) {[\s\r\n]*var c = a && a.b;*[\s\r\n]*}[\s\r\n]*console.log\(abc.toString\(\)\);*$/m;

const basicCode = 'var a = 1';
const basicExpected = /^[\s\r\n]*var a = 1;*[\s\r\n]*$/m;

const defaultCompilerOptions = {
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

const getAsset = (p: string) => path.join(assetsDir, p);


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`Typescript`, () => {
  describe.each(tsModules)(`TS : $label`, ({ moduleSpecifier }) => {
    const ts: typeof TS = require(path.join(tmpDir, moduleSpecifier, 'lib/typescript.js'));
    const compilerOptions = { ...defaultCompilerOptions, ...ts.getDefaultCompilerOptions() };

    test(`Throws if ts-node not present`, () => {
      jest.doMock(
        'ts-node',
        () => ({ register: () => { require('sdf0s39rf3333d@fake-module') } }),
        { virtual: true }
      );

      try {
        expect(() => ts.transpileModule(safelyCode, {
          compilerOptions: {
            plugins: [ {
              customTransformers: { before: [ getAsset('/transformers/safely.ts') ] },
            } ] as any,
          },
        })).toThrow(`Cannot use a typescript-based transformer without ts-node installed.`)
      } finally {
        jest.dontMock('ts-node');
      }
    });

    test('Applies transformer from legacy config', () => {
      const res = ts.transpileModule(safelyCode, {
        compilerOptions: {
          plugins: [ {
            customTransformers: { before: [ getAsset('transformers/safely.ts') ] },
          } ] as any,
        },
      });

      expect(res.outputText).toMatch(safelyExpected);
    });

    test('Applies transformer from default config', () => {
      const res = ts.transpileModule(safelyCode, {
        compilerOptions: {
          plugins: [ {
            transform: getAsset('transformers/safely.ts'),
          } ] as any,
        },
      });

      expect(res.outputText).toMatch(safelyExpected);
    });

    // see: https://github.com/nonara/ts-patch/issues/59
    describe(`Relative transformer resolution`, () => {
      it('Without project: Resolves from cwd', () => {
        const res = ts.transpileModule(safelyCode, {
          compilerOptions: {
            plugins: [ {
              transform: './test/assets/transformers/safely.ts',
            } ] as any,
          },
        });

        expect(res.outputText).toMatch(safelyExpected);
      });

      test('With project: Resolves from project root', () => {
        const compilerOptions = {
          skipLibCheck: true,
          skipDefaultLibCheck: true,
          plugins: [ {
            transform: '../transformers/safely.ts',
          } ] as any
        };
        const program = ts.createProgram([ safelyCodePath ], compilerOptions);
        let outputText: string;
        program.emit(void 0, (_, src) => outputText = src);
        expect(outputText!).toMatch(safelyExpected);
      });

    });

    test('Merges transformers', () => {
      const customTransformer = jest.fn((sf: any) => sf);

      const res = ts.transpileModule(safelyCode, {
        compilerOptions: {
          plugins: [ {
            transform: getAsset('transformers/safely.ts'),
          } ] as any,
        },
        transformers: { before: [ () => customTransformer ] },
      });

      expect(res.outputText).toMatch(safelyExpected);
      expect(customTransformer).toBeCalledTimes(1);
    });

    describe(`TransformerExtras`, () => {
      let message = '';
      let diagnostics: TS.Diagnostic[];
      beforeAll(() => {
        const rootDir = path.join(assetsDir, 'src-files');
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
        ).diagnostics as TS.Diagnostic[];

        cwdMock.mockRestore();
      });

      test(`Diagnostics array passed`, () => {
        expect(message).toMatch(/DIAG_PASSED=true/)
      });

      test(`Found original error code`, () => {
        expect(message).toMatch(/FOUND_ERROR=true/)
      });

      test(`'library' is 'typescript'`, () => {
        expect(message).toMatch(/LIBRARY=typescript/)
      });

      test(`removeDiagnostic works`, () => {
        expect(diagnostics.find(({ code }) => code === 2339)).toBeFalsy()
      });

      test(`addDiagnostic works`, () => {
        expect(diagnostics.find(({ code }) => code === 1337)).toBeTruthy()
      });
    });

    test('Runs 3rd party transformers', () => {
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

    test('Skips ts plugin without errors', () => {
      const res = ts.transpileModule(basicCode, {
        compilerOptions: {
          plugins: [ { name: 'foobar' } ],
        },
      });
      expect(res.outputText).toMatch(basicExpected)
    });

    describe('Program transformer', () => {
      const safelyFile = getAsset('src-files/safely-code.ts');
      const pluginsNormal: any[] = [
        {
          transform: getAsset('transformers/program-transformer.ts'),
          transformProgram: true,
          import: 'progTransformer1'
        },
        {
          transform: getAsset('transformers/program-transformer.ts'),
          transformProgram: true,
          import: 'progTransformer2'
        }
      ];
      const pluginsRecursive: any[] = [
        {
          transform: getAsset('transformers/program-transformer.ts'),
          transformProgram: true,
          import: 'recursiveTransformer1'
        },
        {
          transform: getAsset('transformers/program-transformer.ts'),
          transformProgram: true,
          import: 'recursiveTransformer2'
        }
      ];
      let spies: Map<string, SpyInstance>;

      beforeAll(() => {
        const fns = [ 'progTransformer1', 'progTransformer2', 'recursiveTransformer1', 'recursiveTransformer2' ] as const;
        spies = new Map<typeof fns[number], SpyInstance>(
          fns.map(f =>
            [ f, jest.spyOn(programTransformers, <any>f) ]
          )
        );
      });

      afterEach(() => spies.forEach(s => s.mockClear()));
      afterAll(() => spies.forEach(s => s.mockRestore()));

      test(`Transforms program once`, () => {
        const options = { ...compilerOptions, plugins: pluginsNormal.slice(0, 1) };
        const program = ts.createProgram([ safelyFile ], options);

        expect(spies.get('progTransformer1')).toBeCalledTimes(1);
        expect(spies.get('progTransformer2')).not.toBeCalled();
        expect(!!program.getSourceFile(newFiles[0])).toBe(true);
        expect(!!program.getSourceFile(newFiles[1])).toBe(false);
      });

      test(`Transforms program twice`, () => {
        const options = { ...compilerOptions, plugins: pluginsNormal };
        const program = ts.createProgram([ safelyFile ], options);

        expect(spies.get('progTransformer1')).toBeCalledTimes(1);
        expect(spies.get('progTransformer2')).toBeCalledTimes(1);
        expect(!!program.getSourceFile(newFiles[0])).toBe(false);
        expect(!!program.getSourceFile(newFiles[1])).toBe(true);
      });

      test(`Prevents createProgram recursion`, () => {
        const options = { ...compilerOptions, plugins: pluginsRecursive }
        ts.createProgram([ safelyFile ], options);

        expect(spies.get('recursiveTransformer1')).toBeCalledTimes(1);
        expect(spies.get('recursiveTransformer2')).toBeCalledTimes(1);
        expect((<any>programTransformers.progTsInstance)?.originalCreateProgram).toBeTruthy();
      });
    });
  });
});
