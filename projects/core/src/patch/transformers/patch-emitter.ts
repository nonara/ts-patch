import ts from 'typescript';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function patchEmitterTransformer(context: ts.TransformationContext) {
  const { factory } = context;

  let patchSuccess = false;

  return (sourceFile: ts.SourceFile) => {
    if (sourceFile.fileName !== 'src/compiler/watch.ts')
      throw new Error('Wrong emitter file sent to transformer! This should be unreachable.');

    const res = factory.updateSourceFile(sourceFile, ts.visitNodes(sourceFile.statements, visitRootNodes) as unknown as ts.Statement[]);

    if (!patchSuccess) throw new Error('Failed to patch emitFilesAndReportErrors function!');

    return res;

    function visitRootNodes(node: ts.Statement): ts.VisitResult<ts.Statement> {
      if (ts.isFunctionDeclaration(node) && node.name && node.name.getText() === 'emitFilesAndReportErrors') {
        const newBodyStatements = ts.visitNodes(node.body!.statements, visitEmitterNodes) as unknown as ts.Statement[];

        return factory.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          node.parameters,
          node.type,
          factory.updateBlock(node.body!, newBodyStatements)
        );
      }

      return node;
    }

    function visitEmitterNodes(node: ts.Statement): ts.VisitResult<ts.Statement> {
      if (
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(
          (declaration) => ts.isVariableDeclaration(declaration) && declaration.name.getText() === 'emitResult'
        )
      ) {
        // tsp.diagnosticMap.set(program, allDiagnostics);
        const insertedMapSetterNode = factory.createExpressionStatement(factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createPropertyAccessExpression(
              factory.createIdentifier('tsp'),
              factory.createIdentifier('diagnosticMap')
            ),
            factory.createIdentifier('set')
          ),
          undefined,
          [
            factory.createIdentifier('program'),
            factory.createIdentifier('allDiagnostics')
          ]
        ));

        patchSuccess = true;

        return [ insertedMapSetterNode, node ];
      }

      return node;
    }
  };
}

// endregion
