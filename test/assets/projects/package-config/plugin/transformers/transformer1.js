/**
 * Change the value of a variable declaration to the value of all jsDoc comments
 */
function transformer1Factory(program, config, { ts }) {
  return context => {
    const { factory } = context;

    function visitor(node) {
      if (ts.isVariableDeclaration(node) && node.initializer) {
        const jsDocs = ts.getJSDocTags(node);
        if (jsDocs.length > 0) {
          const jsDocComment = jsDocs.map(doc => doc.comment).filter(comment => comment).join(' ');
          return factory.createVariableDeclaration(
            node.name,
            undefined,
            undefined,
            factory.createStringLiteral(jsDocComment)
          );
        }
      }
      return ts.visitEachChild(node, visitor, context);
    }

    return sourceFile => ts.visitNode(sourceFile, visitor);
  };
}

module.exports = transformer1Factory;
