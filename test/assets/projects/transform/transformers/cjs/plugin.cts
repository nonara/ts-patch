import type * as ts from 'typescript';

export default function (program: ts.Program, _, { ts: tsInstance }: { ts: typeof ts }) {
  return (ctx: ts.TransformationContext) => {
    const factory = ctx.factory;

    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('after-cts');
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}
