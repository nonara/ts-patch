import ts from 'typescript';


export function patchSourceFile(context: ts.TransformationContext) {
  const { factory } = context;


  return (sourceFile: ts.SourceFile) => {

    const getCompilerOptions = factory.createIdentifier('getCompilerOptions');
    const res = factory.updateSourceFile(sourceFile, ts.visitNodes(sourceFile.statements, visitNodes) as unknown as ts.Statement[]);

    return res;

    function visitNodes(node: ts.Node): ts.VisitResult<ts.Node> {
      if (ts.isFunctionDeclaration(node) && node.name && (
        node.name.escapedText === 'createSourceFile' || node.name.escapedText === 'updateSourceFile2' || node.name.escapedText === 'updateSourceFile'
      )) {
        const newParams = factory.createNodeArray([
          ...node.parameters,
          factory.createParameterDeclaration(
            undefined,
            undefined,
            getCompilerOptions,
            undefined,
            undefined,
          )])

        return ts.visitEachChild(factory.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          node.name,
          node.typeParameters,
          newParams,
          node.type,
          node.body
        ), visitNodes, context);
      }

      if (ts.isCallExpression(node) && ((
        ts.isIdentifier(node.expression) &&
        node.expression.escapedText === 'createSourceFile'
      ))) {
        return factory.updateCallExpression(node, node.expression, node.typeArguments,
          factory.createNodeArray([...node.arguments, factory.createNull(), getCompilerOptions])
        );
      }

      if (
        ts.isCallExpression(node) && ((
          ts.isIdentifier(node.expression) &&
          node.expression.escapedText === 'parseSourceFile'
        ) || (
            ts.isPropertyAccessExpression(node.expression) &&
            ts.isIdentifier(node.expression.expression) &&
            node.expression.expression.escapedText === 'Parser' &&
            node.expression.name.escapedText === "parseSourceFile"
          ))) {
        return factory.updateCallExpression(node, node.expression, node.typeArguments,
          factory.createNodeArray([...node.arguments, getCompilerOptions])
        );
      }
      if (ts.isFunctionDeclaration(node) && node.name && node.name.escapedText === 'parseSourceFile') {
        const originalParseSourceFileId = factory.createIdentifier('originalParseSourceFile');
        const originalParseSourceFile = factory.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          originalParseSourceFileId,
          node.typeParameters,
          node.parameters,
          node.type,
          node.body
        );
        const globalAsignment = factory.createAssignment(
          factory.createPropertyAccessExpression(factory.createIdentifier("globalThis"), originalParseSourceFileId),
          originalParseSourceFileId
        )

        const newParseSourceFile = factory.createFunctionDeclaration(
          undefined,
          undefined,
          'parseSourceFile',
          undefined,
          [],
          undefined,
          factory.createBlock([
            factory.createReturnStatement(
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier('tsp'),
                  factory.createIdentifier('parseSourceFile')
                ),
                undefined,
                [factory.createSpreadElement(factory.createIdentifier('arguments'))]
              )
            ),
          ])
        );

        return [newParseSourceFile, originalParseSourceFile, globalAsignment]
      }

      return ts.visitEachChild(node, visitNodes, context);
    }

  };
}

// endregion
