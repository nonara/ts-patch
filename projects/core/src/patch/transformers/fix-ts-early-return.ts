import ts, { isReturnStatement } from 'typescript';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function fixTsEarlyReturnTransformer(context: ts.TransformationContext) {
  const { factory } = context;

  let patchSuccess = false;

  return (sourceFile: ts.SourceFile) => {
    if (sourceFile.fileName !== 'src/typescript/typescript.ts')
      throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');

    const res = factory.updateSourceFile(sourceFile, ts.visitNodes(sourceFile.statements, visitNodes) as unknown as ts.Statement[]);

    if (!patchSuccess) throw new Error('Failed to patch typescript early return!');

    return res;

    function visitNodes(node: ts.Statement): ts.VisitResult<ts.Node> {
      if (isReturnStatement(node)) {
        patchSuccess = true;

        return factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(
            [factory.createVariableDeclaration(
              factory.createIdentifier("returnResult"),
              undefined,
              undefined,
              node.expression!
            )],
            ts.NodeFlags.None
          )
        )
      }

      return node;
    }
  };
}

// endregion
