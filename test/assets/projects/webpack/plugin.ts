import type * as ts from 'typescript';

export default function(program: ts.Program, pluginOptions: any) {
  return (ctx: ts.TransformationContext) => {
    throw new Error(`ts-patch worked (cjs)`);
  };
}
