// @ts-nocheck

import * as ts from 'typescript';
import '@a/a';
import '@b';

const tryRequire = (path: string) => {
  try {
    require(path);
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return false;
    } else {
      throw e;
    }
  }

  return true;
}

export default function(program: ts.Program, pluginOptions: any) {
  return (ctx: ts.TransformationContext) => {
    process.stdout.write(`sub-path:${tryRequire('@a/a')}\n`);
    process.stdout.write(`path:${tryRequire('@b')}\n`);
    process.stdout.write(`non-mapped:${tryRequire('@c')}\n`);

    return (_: any) => _;
  };
}
