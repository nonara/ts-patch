import type * as ts from 'typescript';

await Promise.resolve();

export default function (_program: ts.Program, _config: {}, { ts: tsInstance }: { ts: typeof ts }) {
  return (ctx: ts.TransformationContext) => (sourceFile: ts.SourceFile) => tsInstance.visitEachChild(sourceFile, node => node, ctx);
}
