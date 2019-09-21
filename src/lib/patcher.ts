import fs from 'fs';
import path from 'path';
import { FileNotFound, PatchError, FileWriteError, WrongTSVersion, tspPackageJSON, appRoot } from './system';
import { TSModule, TSPackage } from './file-utils';


/* ********************************************************************************************************************
 * Helpers
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
      .readFileSync(path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.js'), 'utf-8')
      .replace(/(^Object.defineProperty\(exports.+?;)|(\/\/#\ssourceMappingURL.+?$)/gm, '')
    }
  })(tsPatch || (tsPatch = {}));
  tsPatch.originalCreateProgram = ts.createProgram;
  tsPatch.version = '${tspPackageJSON.version}';
  ts.createProgram = tsPatch.createProgram;
  ${isTSC ? `ts.executeCommandLine(ts.sys.args);` : ''}
`;

/**
 * Validate TSModule and TSPackage before patching
 */
function validate(tsModule?: TSModule, tsPackage?: TSPackage) {
  if (tsModule) {
    const {file, filename, dir, patchVersion, canPatch} = tsModule;

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


/* ********************************************************************************************************************
 * Patch
 * ********************************************************************************************************************/

/**
 * Patch TypeScript Module
 */
export function patchTSModule(tsModule: TSModule, tsPackage: TSPackage) {
  validate(tsModule, tsPackage);

  const { filename, file, moduleSrc } = tsModule;

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