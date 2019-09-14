import { FileNotFound, PatchError, FileWriteError, WrongTSVersion } from '../system';
import fs from 'fs';
import path from 'path';
import { TSModule, TSPackage } from '../ts-utils';


/* ********************************************************************************************************************
 * Patch
 * ********************************************************************************************************************/

/**
 * Generate insertion code for module-patch
 * Note: Regex removes esModule exports line and sourceMap data
 */
const generatePatch = (isTSC: boolean) => `
  var tsPatch;
  (function (tsPatch) {
    var isTSC = ${isTSC};
    ${fs
      .readFileSync(path.join(require('app-root-path').toString(), 'lib/patch', 'module-patch.js'), 'utf-8')
      .replace(/(^Object.defineProperty\(exports.+?;)|(\/\/#\ssourceMappingURL.+?$)/gm, '')
    }
  })(tsPatch || (tsPatch = {}));
  tsPatch.originalCreateProgram = ts.createProgram;
  tsPatch.version = '${require('../../package.json').version}';
  ts.createProgram = tsPatch.createProgram;
  ${isTSC ? `ts.executeCommandLine(ts.sys.args);` : ''}
`;

/**
 * Validate TSModule and TSPackage before patching
 */
function validate(module?: TSModule, tsPackage?: TSPackage) {
  if (module) {
    const {file, filename, dir, patchVersion, canPatch} = module;

    if (!fs.existsSync(file)) throw new FileNotFound(`Could not find module ${filename} in ${dir + path.sep}`);

    if (patchVersion) throw new PatchError(`Module ${filename} is already patched with ts-patch v${patchVersion}`);
    if (!canPatch) throw new PatchError(`Module ${filename} cannot be patched! No instance of TypeScript found.`);
  }

  if (tsPackage) {
    const {version} = tsPackage;

    const [major, minor] = version.split('.');
    if (+major < 3 && +minor < 7) throw new WrongTSVersion(`ts-patch requires TypeScript v2.7 or higher.`);
  }

  return true;
}

/**
 * Patch TypeScript Module
 */
export function patchTSModule(module: TSModule, tsPackage: TSPackage) {
  validate(module, tsPackage);

  const { filename, file, moduleSrc } = module;

  /* Install patch */
  const isTSC = (filename === 'tsc.js');
  const patchSrc = generatePatch(isTSC);

  try {
    if (isTSC)
      fs.writeFileSync(file, moduleSrc!.replace(/ts.executeCommandLine\(ts.sys.args\);/, '') + patchSrc);
    else
      fs.appendFileSync(file, patchSrc);
  } catch (e) {
    throw new FileWriteError(filename, e.message);
  }
}