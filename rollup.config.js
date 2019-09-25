import typescript from 'rollup-plugin-typescript2';
import dts from "rollup-plugin-dts";
import buildPatchTypes from "./scripts/build-patch-types";
import pkg from './package.json';
import path from 'path';

const tsOptions = {
  typescript: require('typescript'),
  tsconfigOverride: {
    compilerOptions: {
      module: 'ESNext'
    }
  }
};

const config = [
  {
    input: 'src/patch/main.ts',
    output: [{
        file: path.join(pkg.directories.resources, 'module-patch.js'),
        format: 'iife',
        globals: [ 'ts' ]
    }],
    plugins: [ typescript(tsOptions) ]
  },
  {
    input: 'src/patch/types.ts',
    output: [{
      file: path.join(pkg.directories.resources, 'module-patch.d.ts')
    }],
    plugins: [ dts(), buildPatchTypes() ]
  }
];

export default config;