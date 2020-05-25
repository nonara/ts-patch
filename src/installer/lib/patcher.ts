import fs from 'fs';
import path from 'path';
import { appRoot, FileNotFound, FileWriteError, PatchError, tspPackageJSON, WrongTSVersion } from './system';
import { getTSModule, TSModule, TSPackage } from './file-utils';
import { BACKUP_DIRNAME } from './actions';


/* ****************************************************************************************************************** */
// region: Constants
/* ****************************************************************************************************************** */

const dtsPatchSrc = '\n' +
  fs.readFileSync(path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.d.ts'), 'utf-8');
const jsPatchSrc =
  fs.readFileSync(path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.js'), 'utf-8')

// endregion


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

/**
 * Generate insertion code for module-patch
 */
const generatePatch = (isTSC: boolean) =>
  jsPatchSrc
    .replace(
      /(^\s*Object\.assign\(ts,\s*{[\s\S]*tspVersion,[\s\S]+?}\);?$)/m,
      `var tspVersion = '${tspPackageJSON.version}';\n` +
      `var isTSC = ${isTSC};\n` +
      `$1`
    );

/**
 * Validate TSModule and TSPackage before patching
 */
function validate(tsModule?: TSModule, tsPackage?: TSPackage) {
  if (tsModule) {
    const { file, filename, dir, patchVersion, canPatch, outOfDate } = tsModule;

    if (!fs.existsSync(file)) throw new FileNotFound(`Could not find module ${filename} in ${dir + path.sep}`);

    if (patchVersion && !outOfDate)
      throw new PatchError(`Module ${filename} is already up-to-date with local version - v${patchVersion}`);
    if (!canPatch) throw new PatchError(`Module ${filename} cannot be patched! No instance of TypeScript found.`);
  }

  if (tsPackage) {
    const [ major, minor ] = tsPackage.version.split('.');
    if (+major < 3 && +minor < 7) throw new WrongTSVersion(`ts-patch requires TypeScript v2.7 or higher.`);
  }

  return true;
}

const patchModule = (tsModule: TSModule, source?: string) => {
  const src = source || tsModule.moduleSrc!;
  const funcPos = src.search(/function emitFilesAndReportErrors\(/);
  if (funcPos < 0)
    throw new Error(`Bad TS Code. Could not find function emitFilesAndReportErrors in ${tsModule.filename}`);
  const startCode = src.substr(0, funcPos);
  const restCode = src.substr(funcPos);

  /* Modern TS */
  let pos = restCode.search(/^\s*?var emitResult =/m);
  if (pos >= 0) {
    return startCode +
      restCode.substr(0, pos) +
      `\nts.diagnosticMap.set(program, allDiagnostics);\n` +
      restCode.substr(pos);
  }

  /* TS 2.7 */
  pos = restCode.search(/^\s*?var [_\w]+? = program.emit\(\)/m);
  if (pos < 0) throw new Error(
    `Could not recognize diagnostics signature in emitFilesAndReportErrors(). Please open an issue with your TS version #.`
  );
  return startCode +
    restCode.substr(0, pos) +
    `\nts.diagnosticMap.set(program, diagnostics);\n` +
    restCode.substr(pos);
}


/* ********************************************************************************************************************
 * Patch
 * ********************************************************************************************************************/

/**
 * Patch TypeScript Module
 */
export function patchTSModule(tsModule: TSModule, tsPackage: TSPackage) {
  validate(tsModule, tsPackage);

  const { filename, file, dir } = tsModule;

  /* Install patch */
  const isTSC = (filename === 'tsc.js');
  const patchSrc = generatePatch(isTSC);

  /* Add diagnostic modification support */
  const moduleSrc = patchModule(tsModule);

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
          Buffer.from(patchModule(tsModule, fs.readFileSync(tsFile, 'utf-8'))),
          Buffer.from(!getTSModule(tsFile).patchVersion ? patchSrc : ''),
          Buffer.from(
            moduleSrc.replace(/^[\s\S]+(\(function \(ts\) {\s+function countLines[\s\S]+)$/, '$1')
          )
        ])
      );
    } else fs.writeFileSync(file, Buffer.concat([
      Buffer.from(moduleSrc),
      Buffer.from(patchSrc)
    ]));
  }
  catch (e) {
    throw new FileWriteError(filename, e.message);
  }

  /* Patch d.ts with types (if module is typescript.ts) */
  if (filename === 'typescript.js') {
    const targetFile = path.join(dir, 'typescript.d.ts');
    const backupFile = path.join(tsPackage.packageDir, BACKUP_DIRNAME, 'typescript.d.ts');

    try {
      if (fs.existsSync(backupFile)) fs.writeFileSync(targetFile, fs.readFileSync(backupFile, 'utf-8') + dtsPatchSrc)
      else fs.appendFileSync(targetFile, dtsPatchSrc)
    }
    catch (e) {
      throw new FileWriteError(filename, e.message);
    }
  }
}
