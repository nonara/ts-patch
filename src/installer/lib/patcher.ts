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

const getHeader = () => `/// tsp: ${tspPackageJSON.version}\n\n`;

/**
 * Generate insertion code for module-patch
 */
const generatePatch = (isTSC: boolean) =>
  jsPatchSrc +
  `\nObject.assign(tsp, { isTSC: ${isTSC}, tspVersion: '${tspPackageJSON.version}' });\n\n`;

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
    const [ major ] = tsPackage.version.split('.');
    if (+major < 4) throw new WrongTSVersion(`ts-patch v2 requires TypeScript v4.0 or higher.`);
  }

  return true;
}

const patchModuleDiagnostics = (tsModule: TSModule, tsPackage: TSPackage, source?: string) => {
  const src = source || tsModule.moduleSrc!;

  const funcPos = src.search(/function emitFilesAndReportErrors\(/);
  if (funcPos < 0) throw new Error(`Bad TS Code. Could not find function emitFilesAndReportErrors in ${tsModule.filename}`);

  const startCode = src.substr(0, funcPos);
  const restCode = src.substr(funcPos);

  /* Find emit call position  */
  const emitPos = restCode.search(/^\s*?var emitResult =/m);
  if (emitPos < 0) throw new Error(`Could not determine emit call. Please file an issue with your TS version!`);

  const ver = tsPackage.version.split('.')
  const majorVer = +ver[0];
  const minorVer = +ver[1];

  const diagnosticsArrName = 'allDiagnostics';

  return startCode +
    restCode.substr(0, emitPos) +
    `\nts.diagnosticMap.set(program, ${diagnosticsArrName});\n` +
    restCode.substr(emitPos);
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
  const moduleSrc = patchModuleDiagnostics(tsModule, tsPackage);

  try {
    if (isTSC) {
      /* Select non-patched typescript.js */
      const tsFile =
        [
          path.join(tsPackage.packageDir, BACKUP_DIRNAME, 'typescript.js'),
          path.join(tsPackage.libDir, 'typescript.js')
        ]
          .filter(f => fs.existsSync(f))[0];

      /* Get TSC-specific module slice */
      const ver = tsPackage.version.split('.')
      const majorVer = +ver[0];
      const minorVer = +ver[1];

      let tscSlice = majorVer >= 4 && minorVer >= 9
                     ? moduleSrc.replace(/^[\s\S]+(\(function \(ts\) {\s+var StatisticType;[\s\S]+)$/, '$1')
                     : moduleSrc.replace(/^[\s\S]+(\(function \(ts\) {\s+function countLines[\s\S]+)$/, '$1');
      const execCmdPost = tscSlice.lastIndexOf('\nts.executeCommandLine\(');
      if (execCmdPost < 0) throw new Error(`Could not find tsc executeCommandLine`);
      const execCmd = tscSlice.slice(execCmdPost);
      tscSlice = tscSlice.slice(0, execCmdPost);

      /* Expand TSC with full typescript library (splice tsc part on top of typescript.ts code) */
      const content = Buffer.concat([
        Buffer.from(getHeader()),
        Buffer.from(patchModuleDiagnostics(tsModule, tsPackage, fs.readFileSync(tsFile, 'utf-8'))),
        Buffer.from(!getTSModule(tsFile).patchVersion ? patchSrc : ''),
        Buffer.from(tscSlice),
        Buffer.from(execCmd)
      ]);

      fs.writeFileSync(file, content);
    } else fs.writeFileSync(file, Buffer.concat([
      Buffer.from(getHeader()),
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
      throw new FileWriteError(filename, (e as Error).stack);
    }
  }
}
