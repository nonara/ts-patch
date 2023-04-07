import ts from 'typescript';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function createMergeStatementsTransformer(
  baseSourceFile: ts.SourceFile,
  sourceFile: ts.SourceFile
): ts.TransformerFactory<ts.SourceFile> {
  const replacements = new Map<string, ts.Statement>();

  for (const node of sourceFile.statements) {
    if (ts.isVariableStatement(node)) {
      const name = (node.declarationList.declarations[0].name as ts.Identifier).text;
      replacements.set(name, node);
    } else if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.text;
      replacements.set(name, node);
    }
  }

  return (context: ts.TransformationContext) => {
    const { factory } = context;

    return (node: ts.SourceFile) => {
      if (node.fileName !== baseSourceFile.fileName) return node;

      const transformedStatements: ts.Statement[] = [];

      node.statements.forEach((statement) => {
        if (ts.isVariableStatement(statement)) {
          const name = (statement.declarationList.declarations[0].name as ts.Identifier).text;
          if (replacements.has(name)) {
            transformedStatements.push(replacements.get(name)!);
            replacements.delete(name);
          } else {
            transformedStatements.push(statement);
          }
        } else if (ts.isFunctionDeclaration(statement) && statement.name) {
          const name = statement.name.text;
          if (replacements.has(name)) {
            transformedStatements.push(replacements.get(name)!);
            replacements.delete(name);
          } else {
            transformedStatements.push(statement);
          }
        } else {
          transformedStatements.push(statement);
        }
      });

      replacements.forEach((value) => transformedStatements.push(value));

      return factory.updateSourceFile(node, transformedStatements);
    };
  };
}

// endregion
