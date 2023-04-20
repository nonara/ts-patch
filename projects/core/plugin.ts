import type * as ts from 'typescript';
import * as path from 'path';
type TS = typeof ts;


/* ****************************************************************************************************************** *
 * Program Transformer - Merge rootDirs
 * ****************************************************************************************************************** */

export default function transformProgram(
  program: ts.Program,
  host: ts.CompilerHost,
  opt: any,
  { ts }: { ts: TS }
)
{
  host ??= ts.createCompilerHost(program.getCompilerOptions(), true);
  const rootDirs = program.getCompilerOptions().rootDirs ?? [];

  hookWriteRootDirsFilenames();

  return ts.createProgram(program.getRootFileNames(), program.getCompilerOptions(), host, program);

  function hookWriteRootDirsFilenames() {
    // TODO - tsei
    const sourceDir = (<any>program).getCommonSourceDirectory();
    const outputDir = program.getCompilerOptions().outDir!;

    const originalWriteFile = host.writeFile;
    host.writeFile = (fileName: string, data: string, ...args: any[]) => {
      let srcPath = path.resolve(sourceDir, path.relative(outputDir, fileName));

      for (const dir of rootDirs) {
        const relPath = path.relative(dir, srcPath);
        // TODO - tsei
        if (relPath.slice(0, 2) !== '..') fileName = (<any>ts).normalizePath(path.resolve(outputDir, relPath));
      }

      return (<any>originalWriteFile)(fileName, data, ...args);
    }
  }
}
