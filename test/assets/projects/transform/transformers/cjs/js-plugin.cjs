const ts = require('typescript');

if (!__dirname) throw new Error('Not handled as cjs');

module.exports.default = (program, _, { ts: tsInstance }) => {
  return (ctx) => {
    const factory = ctx.factory;

    return (sourceFile) => {
      function visit(node) {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('after-cjs');
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}
