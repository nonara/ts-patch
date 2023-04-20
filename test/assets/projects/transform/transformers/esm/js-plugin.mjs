if (!import.meta.url) throw new Error('Not handled as esm');

export default function (program, _, { ts: tsInstance }) {
  return (ctx) => {
    const factory = ctx.factory;

    return (sourceFile) => {
      function visit(node) {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('after-mjs');
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}
