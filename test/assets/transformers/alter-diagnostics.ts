import * as TS from 'typescript';
import { DiagnosticCategory, DiagnosticWithLocation, Diagnostic } from 'typescript';
import { TspExtras } from '../../../src/patch/lib/types';

export default function (
  program: TS.Program,
  opts: any,
  extras: TspExtras
) {
  const { addDiagnostic, diagnostics, removeDiagnostic, library, ts } = extras;

  const diagPassed = !!diagnostics;
  let diags = diagnostics.slice();

  // Non-tsc doesn't get a pre-emit diagnostic array
  // And older TS versions don't get semantic diagnostics until after emit is called
  if ((library !== 'tsc') || ((<any>ts).versionMajorMinor === '2.7'))
    diags = diags.concat(program.getSemanticDiagnostics());

  let foundError = false;
  diags.forEach((d, i) => {
    if (d.code === 2339) {
      foundError = true;
      removeDiagnostic(i);
    }
  });

  const msg = `DIAG_PASSED=${diagPassed} FOUND_ERROR=${foundError} LIBRARY=${library}`;

  addDiagnostic({
    code: 1337,
    messageText: msg,
    category: DiagnosticCategory.Error,
    file: program.getSourceFiles().find(s => /\/tsnode-code.ts$/.test(s.fileName)),
    start: 1,
    length: 18
  });

  return (ctx: TS.TransformationContext) => (sourceFile: TS.SourceFile) =>
    ts.visitNode(sourceFile, (node) => ts.createSourceFile(
      sourceFile.fileName,
      `// ${msg}`,
      sourceFile.languageVersion
    ))
}
