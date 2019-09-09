import fs from 'fs';
import path from 'path';
import resolve = require('resolve');

export function patchTSModule(file: string, dir?: string) {
  dir = dir || resolve.sync('typescript/package.json');

  /* Validate TS installation */
  const pkg_file = path.join(dir,'package.json');

  const {name, version} = (() => {
    try {
      return fs.existsSync(path.join(dir!,'package.json')) && JSON.parse(fs.readFileSync(pkg_file, 'utf8'));
    } catch (e) {
      throw new Error(`Could not parse json data in ${dir}`)
    }
  })();

  const [major, minor] = version.split('.');

  if (name !== 'typescript') throw new Error(`The package in ${dir} must be TypeScript. Found: ${name}.`);
  if (+major < 3 && +minor < 7) throw new Error(`ts-patch requires TypeScript v2.7 or higher.`);

  /* Validate Module */
  const tsModuleFile = path.join(dir, 'lib', file);
  if (!fs.existsSync(tsModuleFile))
    throw new Error(`Could not find module ${path.basename(file,path.extname(file))} in ${dir}.`);

  /* Install patch */
  const isTSC = (file === 'tsc.ts');
  const patchSrc = fs.readFileSync(path.join(__dirname, 'module-patch.ts'), 'utf-8');

  fs.appendFileSync(tsModuleFile, `
    var tsPatch;
    (function (tsPatch) {
      var isTSC = ${isTSC};
      ${patchSrc}
    })(tsPatch);
    tsPatch.originalCreateProgram = ts.createProgram;
    ts.createProgram = tsPatch.createProgram;
  `);
}