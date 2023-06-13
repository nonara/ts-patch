import ts from 'typescript';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function patchCreateProgramTransformer(context: ts.TransformationContext) {
  const { factory } = context;

  let patchSuccess = false;

  return (sourceFile: ts.SourceFile) => {
    if (sourceFile.fileName !== 'src/compiler/program.ts')
      throw new Error('Wrong program file sent to transformer! This should be unreachable.');

    const res = factory.updateSourceFile(sourceFile, ts.visitNodes(sourceFile.statements, visitNode) as unknown as ts.Statement[]);

    if (!patchSuccess) throw new Error('Failed to patch createProgram function!');

    return res;

    function visitNode(node: ts.Statement): ts.VisitResult<ts.Statement> {
      if (ts.isFunctionDeclaration(node) && node.name?.getText() === 'createProgram') {
        const originalCreateProgram = factory.updateFunctionDeclaration(
          node,
          node.modifiers,
          node.asteriskToken,
          factory.createIdentifier('originalCreateProgram'),
          node.typeParameters,
          node.parameters,
          node.type,
          node.body
        );

        // function createProgram() { return tsp.originalCreateProgram(...arguments); }
        const newCreateProgram = factory.createFunctionDeclaration(
          undefined,
          undefined,
          'createProgram',
          undefined,
          [],
          undefined,
          factory.createBlock([
            factory.createReturnStatement(
              factory.createCallExpression(
                factory.createPropertyAccessExpression(
                  factory.createIdentifier('tsp'),
                  factory.createIdentifier('createProgram')
                ),
                undefined,
                [ factory.createSpreadElement(factory.createIdentifier('arguments')) ]
              )
            ),
          ])
        );

        patchSuccess = true;

        return [ newCreateProgram, originalCreateProgram ];
      }

      return node;
    }
  }
}

// endregion
