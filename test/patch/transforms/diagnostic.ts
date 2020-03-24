import * as ts from 'typescript';
import { DiagnosticCategory, DiagnosticWithLocation, Diagnostic } from 'typescript';


export default function (program: ts.Program, opts: any, { addDiagnostic }: { addDiagnostic: (diag: Diagnostic) => void; }) {
  return (ctx: ts.TransformationContext) => {
    addDiagnostic({
      code: 1337,
      messageText: '',
      category: DiagnosticCategory.Error,
      file: void 0,
      start: 0,
      length: 0
    });
    return (sourceFile: any) => sourceFile;
  }
}
