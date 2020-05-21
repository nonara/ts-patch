import pkg from './package.json';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import shim from 'rollup-plugin-shim';
import json from '@rollup/plugin-json';
import dts from "rollup-plugin-dts";
import buildPatchTypes from "./scripts/build-patch-types";
import resolve from '@rollup/plugin-node-resolve';
import path from 'path';


const tsOptions = {
  typescript: require('typescript'),
  tsconfig: 'tsconfig.patch.json'
};

const shimOptions = {
  fs: `export default require('fs')`,
  path: `export default require('path')`,
};

const config = [
  {
    input: 'src/patch/main.ts',
    output: [ {
      file: path.join(pkg.directories.resources, 'module-patch.js'),
      format: 'iife',
      globals: [ 'ts' ],
    } ],
    plugins: [ typescript(tsOptions), resolve({ preferBuiltins: true }), json({ namedExports: false }), commonjs(), shim(shimOptions) ]
  },
  {
    input: 'src/patch/types.ts',
    output: [ {
      file: path.join(pkg.directories.resources, 'module-patch.d.ts')
    } ],
    plugins: [ dts(), buildPatchTypes() ]
  }
];

export default config;
