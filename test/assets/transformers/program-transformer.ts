import * as ts from 'typescript';
import * as path from 'path';
import { ProgramTransformer, TspExtras } from '../../../src/patch/lib/types';


export const newFiles = [ 'abc1.ts', 'abc2.ts' ].map(f => (ts as any).normalizePath(path.resolve(__dirname, '../src-files', f)));
const safelyFile = path.join(__dirname, '../src-files/safely-code.ts');

const readFileFactory = (originalReadFile: Function) => ({
  readFile: function newReadFile(fileName: string) {
    return newFiles.includes(fileName) ? 'export const abc = 3;' : originalReadFile(fileName);
  }
});

function createProgramTransformer(newFileIndex: number) {
  return function (program: ts.Program, host: ts.CompilerHost | undefined, config: any, { ts: tsInstance }: { ts: typeof ts }) {
    if (!host) host = tsInstance.createCompilerHost(program.getCompilerOptions());
    if (host.readFile.name !== 'newReadFile') Object.assign(host, readFileFactory(host.readFile));
    if (tsInstance.sys.readFile.name !== 'newReadFile') Object.assign(tsInstance.sys, readFileFactory(tsInstance.sys.readFile));

    const newProgram = (tsInstance as any).originalCreateProgram(
      /* rootNames */ [ safelyFile, newFiles[newFileIndex] ],
      program.getCompilerOptions(),
      host,
      program
    );

    return newProgram;
  }
}

export const progTransformer1 = createProgramTransformer(0);
export const progTransformer2 = createProgramTransformer(1);

export let progTsInstance: typeof ts | undefined = undefined;


/* ****************************************************************************************************************** *
 * Recursion
 * ****************************************************************************************************************** */

export function recursiveTransformer1(program: ts.Program, host: ts.CompilerHost | undefined, config: any, { ts: tsInstance }: { ts: typeof ts }) {
  progTsInstance = tsInstance;

  const newProgram = (tsInstance as any).createProgram(
    /* rootNames */ [ safelyFile, newFiles[0] ],
    program.getCompilerOptions(),
    host,
    program
  );

  return newProgram;
}

export function recursiveTransformer2(program: ts.Program, host: ts.CompilerHost | undefined, config: any, { ts: tsInstance }: { ts: typeof ts }) {
  progTsInstance = tsInstance;

  const newProgram = (tsInstance as any).createProgram(
    /* rootNames */ [ safelyFile, newFiles[1] ],
    program.getCompilerOptions(),
    host,
    program
  );

  return newProgram;
}
