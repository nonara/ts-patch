import type * as ts from 'typescript';
import type { TransformerExtras } from 'ts-patch';

export default function (
  program: ts.Program,
  _config: unknown,
  { addDiagnostic, removeDiagnostic, diagnostics, library, ts: tsInstance }: TransformerExtras
) {
  const originalDiagnosticIndex = diagnostics.findIndex(({ code }) => code === 2339);
  if (originalDiagnosticIndex !== -1) removeDiagnostic(originalDiagnosticIndex);

  const sourceFile = program.getSourceFiles().find(({ fileName }) => /src[\\/]index\.ts$/.test(fileName));
  const foundOriginal = originalDiagnosticIndex !== -1;

  addDiagnostic({
    code: 1337,
    category: tsInstance.DiagnosticCategory.Error,
    file: sourceFile,
    start: 0,
    length: sourceFile ? Math.min(1, sourceFile.text.length) : 0,
    messageText: `ts-patch diagnostics fixture DIAG_ARRAY=${Array.isArray(diagnostics)} FOUND_ORIGINAL=${foundOriginal} LIBRARY=${library}`
  });

  return () => (sourceFile: ts.SourceFile) => sourceFile;
}
