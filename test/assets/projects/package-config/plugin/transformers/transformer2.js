/**
 * Transform let to const
 */
function transformer2Factory(program, config, { ts }) {
  return context => {
    const { factory } = context;

    function visitor(node) {
      if (ts.isVariableStatement(node) && node.declarationList.flags & ts.NodeFlags.Let) {
        return factory.createVariableStatement(
          undefined,
          factory.createVariableDeclarationList(node.declarationList.declarations, ts.NodeFlags.Const)
        );
      }
      return ts.visitEachChild(node, visitor, context);
    }

    return sourceFile => ts.visitNode(sourceFile, visitor);
  }
}

module.exports = transformer2Factory;
