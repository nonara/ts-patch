import fs from 'fs';
import path from 'path';
import { FileNotFound, PatchError, FileWriteError, WrongTSVersion, tspPackageJSON, appRoot } from './system';
import { getTSModule, TSModule, TSPackage } from './file-utils';
import { BACKUP_DIRNAME } from './actions';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

/**
 * Generate insertion code for module-patch
 */
const generatePatch = (isTSC: boolean) =>
  fs
    .readFileSync(path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.js'), 'utf-8')
    .replace(
      /(^\s*Object\.assign\(ts,\s*{[\s\S]*tspVersion,[\s\S]+?}\);?$)/m,
      `var tspVersion = '${tspPackageJSON.version}';\r\n` +
      `var isTSC = ${isTSC};\r\n` +
      `$1`
    );

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

  const { filename, file, moduleSrc, dir } = tsModule;

  /* Install patch */
  const isTSC = (filename === 'tsc.js');
  const patchSrc = generatePatch(isTSC);

  try {
    if (isTSC) {
      /* Select non-patched typescript.js */
      const tsFile =
        [
          path.join(tsPackage.packageDir, BACKUP_DIRNAME, 'typescript.js'),
          path.join(tsPackage.libDir, 'typescript.js')
        ]
        .filter(f => fs.existsSync(f))[0];

      /* Expand TSC with full typescript library (splice tsc part on top of typescript.ts code) */
      fs.writeFileSync(file,
        Buffer.concat([
          fs.readFileSync(tsFile),
          Buffer.from(!getTSModule(tsFile).patchVersion ? patchSrc : ''),
          Buffer.from(
            moduleSrc!.replace(/^[\s\S]+(\(function \(ts\) {\s+function countLines[\s\S]+)$/, '$1')
          )
        ])
      );
    }
    else
      fs.appendFileSync(file, patchSrc);
  } catch (e) {
    throw new FileWriteError(filename, e.message);
  }

  /* Patch d.ts with types (if module is typescript.ts) */
  if (filename === 'typescript.js')
    try {
      fs.appendFileSync(
        path.join(dir, 'typescript.d.ts'),
        '\r\n' + fs.readFileSync(path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.d.ts'))
      )
    } catch (e) {
      throw new FileWriteError(filename, e.message);
    }
}