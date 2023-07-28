import ts from 'typescript';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function addOriginalCreateProgramTransformer(context: ts.TransformationContext) {
  const { factory } = context;

  let patchSuccess = false;

  return (sourceFile: ts.SourceFile) => {
    if (sourceFile.fileName !== 'src/typescript/_namespaces/ts.ts')
      throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');

    const res = factory.updateSourceFile(sourceFile, ts.visitNodes(sourceFile.statements, visitNodes) as unknown as ts.Statement[]);

    if (!patchSuccess) throw new Error('Failed to patch typescript early return!');

    return res;

    function visitNodes(node: ts.Statement): ts.VisitResult<ts.Node> {
      if (
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        node.expression.expression.getText() === "__export"
      ) {
        const exportObjectLiteral = node.expression.arguments[1];
        if (ts.isObjectLiteralExpression(exportObjectLiteral)) {
          const originalParseSourceFile = factory.createPropertyAssignment(
            "originalParseSourceFile",
            factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createIdentifier("originalParseSourceFile")
            )
          );

          const originalCreateProgramProperty = factory.createPropertyAssignment(
            "originalCreateProgram",
            factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createIdentifier("originalCreateProgram")
            )
          );

          const updatedExportObjectLiteral = factory.updateObjectLiteralExpression(
            exportObjectLiteral,
            [...exportObjectLiteral.properties, originalCreateProgramProperty, originalParseSourceFile]
          );

          const updatedNode = factory.updateExpressionStatement(
            node,
            factory.updateCallExpression(
              node.expression,
              node.expression.expression,
              undefined,
              [node.expression.arguments[0], updatedExportObjectLiteral]
            )
          );

          patchSuccess = true;
          return updatedNode;
        }
      }

      return node;
    }
  };
}

// endregion
