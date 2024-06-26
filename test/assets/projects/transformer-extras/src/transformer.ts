// @ts-nocheck
import type * as ts from 'typescript'
import type { TransformerExtras } from 'ts-patch'

export default function(program: ts.Program, pluginOptions: unknown, transformerExtras?: TransformerExtras) {
  return (ctx: ts.TransformationContext) => {
    return (sourceFile: ts.SourceFile) => {
      transformerExtras?.addDiagnostic({
        file: sourceFile,
        code: 42,
        messageText: 'It\'s a warning message!',
        category: 0,
        start: 0,
        length: 1,
      });
      transformerExtras?.addDiagnostic({
        file: sourceFile,
        code: 42,
        messageText: 'It\'s an error message!',
        category: 1,
        start: 1,
        length: 2,
      });
      transformerExtras?.addDiagnostic({
        file: sourceFile,
        code: 42,
        messageText: 'It\'s a suggestion message!',
        category: 2,
        start: 2,
        length: 3,
      });
      transformerExtras?.addDiagnostic({
        file: sourceFile,
        code: 42,
        messageText: 'It\'s a message!',
        category: 3,
        start: 3,
        length: 4,
      });

      return sourceFile;
    };
  };
}
