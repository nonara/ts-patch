import ts from 'typescript';
import { PatchError } from '../../system';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

export const createProgramExportFiles = [
  /* TS < 5.4 */
  'src/typescript/_namespaces/ts.ts',

  /* TS >= 5.4 */
  'src/server/_namespaces/ts.ts',
  'src/typescript/typescript.ts'
]

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function addOriginalCreateProgramTransformer(context: ts.TransformationContext) {
  const { factory } = context;

  let patchSuccess = false;

  return (sourceFile: ts.SourceFile) => {
    if (!createProgramExportFiles.includes(sourceFile.fileName))
      throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');

    const res = factory.updateSourceFile(sourceFile, ts.visitNodes(sourceFile.statements, visitNodes) as unknown as ts.Statement[]);

    if (!patchSuccess) throw new PatchError('Failed to patch typescript originalCreateProgram!');

    return res;

    function visitNodes(node: ts.Statement): ts.VisitResult<ts.Node> {
      /* Handle: __export({ ... }) */
      if (
        ts.isExpressionStatement(node) &&
        ts.isCallExpression(node.expression) &&
        node.expression.expression.getText() === '__export'
      ) {
        const exportObjectLiteral = node.expression.arguments[1];
        if (ts.isObjectLiteralExpression(exportObjectLiteral)) {
          const originalCreateProgramProperty = factory.createPropertyAssignment(
            'originalCreateProgram',
            factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
              factory.createIdentifier('originalCreateProgram')
            )
          );

          const updatedExportObjectLiteral = factory.updateObjectLiteralExpression(
            exportObjectLiteral,
            [ ...exportObjectLiteral.properties, originalCreateProgramProperty ]
          );

          const updatedNode = factory.updateExpressionStatement(
            node,
            factory.updateCallExpression(
              node.expression,
              node.expression.expression,
              undefined,
              [ node.expression.arguments[0], updatedExportObjectLiteral ]
            )
          );

          patchSuccess = true;
          return updatedNode;
        }
      }

      /* Handle: 1 && (module.exports = { ... }) (ts5.5+) */
      if (
        ts.isExpressionStatement(node) && ts.isBinaryExpression(node.expression) &&
        node.expression.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        ts.isParenthesizedExpression(node.expression.right) &&
        ts.isBinaryExpression(node.expression.right.expression) &&
        node.expression.right.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.expression.right.expression.left) &&
        node.expression.right.expression.left.expression.getText() === 'module' &&
        node.expression.right.expression.left.name.getText() === 'exports' &&
        ts.isObjectLiteralExpression(node.expression.right.expression.right)
      ) {
        // Add originalCreateProgram to the object literal
        const originalCreateProgramProperty = factory.createShorthandPropertyAssignment('originalCreateProgram');

        const updatedObjectLiteral = factory.updateObjectLiteralExpression(
          node.expression.right.expression.right,
          [ ...node.expression.right.expression.right.properties, originalCreateProgramProperty ]
        );

        // Update the node
        const updatedNode = factory.updateExpressionStatement(
          node,
          factory.updateBinaryExpression(
            node.expression,
            node.expression.left,
            node.expression.operatorToken,
            factory.updateParenthesizedExpression(
              node.expression.right,
              factory.updateBinaryExpression(
                node.expression.right.expression,
                node.expression.right.expression.left,
                node.expression.right.expression.operatorToken,
                updatedObjectLiteral
              )
            )
          )
        );

        patchSuccess = true;
        return updatedNode;
      }

      return node;
    }
  };
}

// endregion
