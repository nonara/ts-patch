import typescript from 'rollup-plugin-typescript2';
import pkg from './package.json';
import path from 'path';

const config = [
  {
    input: 'src/patch/main.ts',
    output: [
      {
        file: path.join(pkg.directories.resources, 'module-patch.js'),
        format: 'iife',
        globals: [ 'ts' ]
      }
    ],
    plugins: [
      typescript({
        typescript: require('typescript'),
        tsconfigOverride: {
          compilerOptions: {
            module: 'ESNext'
          }
        }
      })
    ]
  }
];

export default config;