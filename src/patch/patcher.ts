import fs from 'fs';
import path from 'path';
import { getModuleInfo, getTSInfo, AlreadyPatched, FileNotFound, PatchError, FileWriteError } from '../system';


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
 * Patch TypeScript Module
 */
export function patchTSModule(file: string, dir?: string) {
  const filename = path.basename(file);

  const { libDir } = getTSInfo(dir);

  /* Validate Module */
  if (!fs.existsSync(file)) throw new FileNotFound(`Could not find module ${filename} in ${libDir + path.sep}`);

  const {canPatch, patchVersion, moduleSrc} = getModuleInfo(file, true);

  if (patchVersion) throw new AlreadyPatched(`Module ${filename} is already patched with ts-patch v${patchVersion}`);
  if (!canPatch) throw new PatchError(`Module ${filename} cannot be patched! No instance of TypeScript found.`);

  /* Install patch */
  const isTSC = (file === 'tsc.js');
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