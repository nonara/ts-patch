import type * as ts from 'typescript';

if (typeof __dirname !== 'string') throw new Error('lazy-import-meta-cjs was not loaded as CommonJS');

export default function (_program: ts.Program, _config: {}, { ts: tsInstance }: { ts: typeof ts }) {
  return (ctx: ts.TransformationContext) => {
    require('./bad-helper');
    return (sourceFile: ts.SourceFile) => tsInstance.visitEachChild(sourceFile, node => node, ctx);
  };
}
