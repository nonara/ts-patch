import type * as ts from 'typescript';

if (!import.meta.url) throw new Error('explicit-esnext-ts was not loaded as ESM');

export default function (_program: ts.Program, _config: {}, { ts: tsInstance }: { ts: typeof ts }) {
  return (ctx: ts.TransformationContext) => {
    const factory = ctx.factory;
    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('explicit-esnext-ts');
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}
