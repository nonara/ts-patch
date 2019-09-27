/*
 * Rollup plugin to build patch types (see rollup.config.js)
 */
const { tsquery } = require('@phenomnomnominal/tsquery');


export default function buildPatchTypes() {
  return {
    name: "buildPatchTypes",

    intro: 'declare namespace ts {\r\n',
    outro: '}',

    renderChunk(code) {
      const ast = tsquery.ast(code);
      const omit = tsquery.query(ast,
        `:matches(ImportDeclaration, ExportDeclaration, VariableStatement:has(VariableDeclaration>Identifier[name="ts"]))`
      );

      // Remove selected nodes from final source and format for ambient context
      return omit
        .reduce(
          (p, {end}, i) => p.concat(code.slice(end, ((i + 1) < omit.length) ? omit[i + 1].pos : void 0)),
          code.slice(0, omit[0].pos)
        )
        .replace(/^\s*declare\s(?!namespace)/gm, '')
    }
  }
}