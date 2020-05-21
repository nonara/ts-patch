import * as ts from 'typescript';
import { DiagnosticCategory, DiagnosticWithLocation, Diagnostic } from 'typescript';

type Extras = {
  ts: typeof ts;
  addDiagnostic: (diag: Diagnostic) => number,
  removeDiagnostic: (index: number) => void,
  diagnostics: readonly Diagnostic[]
}

export default function (
  program: ts.Program,
  opts: any,
  extras: Extras
) {
  const { addDiagnostic, diagnostics, removeDiagnostic } = extras;

  const oldCode = diagnostics[0]?.code;
  removeDiagnostic(0);
  addDiagnostic({
    code: 1337,
    messageText: `OC${oldCode}`,
    category: DiagnosticCategory.Error,
    file: program.getSourceFiles().find(s => /\/tsnode-code.ts$/.test(s.fileName)),
    start: 1,
    length: 18
  });

  return (ctx: ts.TransformationContext) => (sourceFile: any) => sourceFile;
}
