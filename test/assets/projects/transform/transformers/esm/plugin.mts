import type * as ts from 'typescript';
import { nestedMtsValue } from './nested-helper.mts';
import { nestedTsValue } from './nested-ts.js';

if (!import.meta.url) throw new Error('Not handled as esm');
if (nestedMtsValue !== 'mts-nested-ok' || nestedTsValue !== 'ts-nested-ok') {
  throw new Error('Nested ESM TS helpers did not load');
}

export default function (program: ts.Program, _, { ts: tsInstance }: { ts: typeof ts }) {
  return (ctx: ts.TransformationContext) => {
    const factory = ctx.factory;

    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('after-mts');
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}
