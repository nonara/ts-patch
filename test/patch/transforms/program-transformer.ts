import * as ts from 'typescript';
import * as path from 'path';

export const newFiles = [ 'abc1.ts', 'abc2.ts' ].map(f => (ts as any).normalizePath(path.resolve(__dirname, '../assets', f)));
const safelyFile = path.join(__dirname, '../assets/safely-code.ts');

function createProgramTransformer(newFileIndex: number) {
  return function (program: ts.Program, host?: ts.CompilerHost) {
    if (!host) host = ts.createCompilerHost(program.getCompilerOptions());
    const originalReadFile = host.readFile;

    Object.assign(host, {
      readFile(fileName: string) {
        return newFiles.includes(fileName) ? 'export const abc = 3;' : originalReadFile(fileName);
      }
    });

    // Recreate Program
    return ts.createProgram(
      /* rootNames */ [ safelyFile, newFiles[newFileIndex] ],
      program.getCompilerOptions(),
      host,
      program
    );
  }
}

export const progTransformer1 = createProgramTransformer(0);
export const progTransformer2 = createProgramTransformer(1);
