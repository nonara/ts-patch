import * as TS from 'typescript';

export default function (program: TS.Program, config: any, { ts }: { ts: typeof TS }) {
  const checker = program.getTypeChecker();
  return (ctx: TS.TransformationContext) => (sourceFile: TS.SourceFile) => {
    function visitor(node: TS.Node): TS.Node {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.getText() === 'type' &&
        node.typeArguments &&
        node.typeArguments[0]
      ) {
        const type = checker.getTypeFromTypeNode(node.typeArguments[0]);
        return ts.createLiteral(checker.typeToString(type));
      }
      return ts.visitEachChild(node, visitor, ctx);
    }
    return ts.visitEachChild(sourceFile, visitor, ctx);
  };
}
