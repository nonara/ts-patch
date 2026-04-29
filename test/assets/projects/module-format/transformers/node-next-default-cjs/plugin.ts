import type * as ts from 'typescript';

if (typeof __dirname !== 'string') throw new Error('node-next-default-cjs was not loaded as CommonJS');

export default function (_program: ts.Program, _config: {}, { ts: tsInstance }: { ts: typeof ts }) {
  return (ctx: ts.TransformationContext) => {
    const factory = ctx.factory;
    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('node-next-default-cjs');
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}
