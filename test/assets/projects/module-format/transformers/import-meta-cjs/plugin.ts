import type * as ts from 'typescript';

if (!import.meta.url) throw new Error('unreachable');

export default function (_program: ts.Program, _config: {}, { ts: tsInstance }: { ts: typeof ts }) {
  return (ctx: ts.TransformationContext) => (sourceFile: ts.SourceFile) => tsInstance.visitEachChild(sourceFile, node => node, ctx);
}
