import ts from 'typescript';
import { execTscCmd } from '../../config';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function hookTscExecTransformer(context: ts.TransformationContext) {
  const { factory } = context;

  let patchSuccess = false;

  return (sourceFile: ts.SourceFile) => {
    if (sourceFile.fileName !== 'src/tsc/tsc.ts')
      throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');

    const res = factory.updateSourceFile(sourceFile, ts.visitNodes(sourceFile.statements, visitNodes) as unknown as ts.Statement[]);

    if (!patchSuccess) throw new Error('Failed to patch tsc exec statement early return!');

    return res;

    function visitNodes(node: ts.Statement): ts.VisitResult<ts.Node> {
      if (ts.isExpressionStatement(node) && ts.isCallExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && node.expression.expression.text === 'executeCommandLine'
      ) {
        patchSuccess = true;

        return factory.createExpressionStatement(factory.createBinaryExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier("tsp"),
            factory.createIdentifier("execTsc")
          ),
          factory.createToken(ts.SyntaxKind.EqualsToken),
          factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            node.expression
          )
        ));
      }

      return node;
    }
  }
}

// endregion
