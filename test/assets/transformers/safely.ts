import * as ts from 'typescript';


export interface MyPluginOptions {
  some?: string
}

export default function myTransformerPlugin(
  program: ts.Program,
  opts: MyPluginOptions | undefined,
  { ts: tsInstance }: { ts: typeof ts }
) {
  return {
    before(ctx: ts.TransformationContext) {
      return (sourceFile: ts.SourceFile) => {
        function visitor(node: ts.Node): ts.Node {
          if (tsInstance.isCallExpression(node) && node.expression.getText() === 'safely') {
            const target = node.arguments[0]
            if (tsInstance.isPropertyAccessExpression(target)) {
              return tsInstance.createBinary(
                target.expression,
                tsInstance.SyntaxKind.AmpersandAmpersandToken,
                target
              )
            }
          }
          return tsInstance.visitEachChild(node, visitor, ctx)
        }
        const srcFile = tsInstance.visitEachChild(sourceFile, visitor, ctx);
        return srcFile;
      }
    }
  }
}
