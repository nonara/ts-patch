import fs from 'fs';
import path from 'path';
import { appRoot, FileNotFound, FileWriteError, PatchError, tspPackageJSON, WrongTSVersion } from './system';
import { getTSModule, TSModule, TSPackage } from './file-utils';
import { BACKUP_DIRNAME } from './actions';
import ts from 'typescript';


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
    const [major] = tsPackage.version.split('.');
    if (+major < 4) throw new WrongTSVersion(`ts-patch v2 requires TypeScript v4.0 or higher.`);
  }

  return true;
}

const patchModuleDiagnostics = (tsModule: TSModule, tsPackage: TSPackage, source?: string) => {
  const src = source || tsModule.moduleSrc!;
  return src;

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

  const ver = tsPackage.version.split('.')
  const majorVer = +ver[0];
  const minorVer = +ver[1];

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
      const content = majorVer >= 5
        ? getTSCFileContent_v5(majorVer, minorVer, moduleSrc, tsModule, tsPackage, tsFile, patchSrc)
        : getTSCFileContent_v4(majorVer, minorVer, moduleSrc, tsModule, tsPackage, tsFile, patchSrc);

      fs.writeFileSync(file, content, 'utf-8');
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

function getTSCFileContent_v4(majorVer: number, minorVer: number, moduleSrc: string, tsModule: TSModule, tsPackage: TSPackage, tsFile: string, patchSrc: string) {
  let tscSlice = majorVer >= 4 && minorVer >= 9
    ? moduleSrc.replace(/^[\s\S]+(\(function \(ts\) {\s+var StatisticType;[\s\S]+)$/, '$1')
    : moduleSrc.replace(/^[\s\S]+(\(function \(ts\) {\s+function countLines[\s\S]+)$/, '$1');
  const execCmdPost = tscSlice.lastIndexOf('\nts.executeCommandLine\(');
  if (execCmdPost < 0)
    throw new Error(`Could not find tsc executeCommandLine`);
  const execCmd = tscSlice.slice(execCmdPost);
  tscSlice = tscSlice.slice(0, execCmdPost);

  /* Expand TSC with full typescript library (splice tsc part on top of typescript.ts code) */
  return [
    getHeader(),
    patchModuleDiagnostics(tsModule, tsPackage, fs.readFileSync(tsFile, 'utf-8')),
    !getTSModule(tsFile).patchVersion ? patchSrc : '',
    tscSlice,
    execCmd
  ].join('');
}

function getTSCFileContent_v5(majorVer: number, minorVer: number, moduleSrc: string, tsModule: TSModule, tsPackage: TSPackage, tsFile: string, patchSrc: string) {
  /* Load and parse ts */
  const tsText = fs.readFileSync(tsFile, "utf-8");
  const tsSourceFile = ts.createSourceFile(tsFile, tsText, ts.ScriptTarget.Latest, true);

  /* Extract the body of root statement "var ts = (() => {  })()" */
  let tsClosureContent: string | undefined;
  ts.forEachChild(tsSourceFile, (node) => {
    if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      if (declaration && declaration.name.getText() === "ts") {
        const callExpression = declaration.initializer as ts.CallExpression;
        const parenthesizedExpression = callExpression.expression as ts.ParenthesizedExpression;
        const arrowFunction = parenthesizedExpression.expression as ts.ArrowFunction;
        const block = arrowFunction.body as ts.Block;

        tsClosureContent = "";
        for (const statement of block.statements) {
          if (
            ts.isVariableStatement(statement) &&
            statement.declarationList.declarations[0]?.name.getText() === "__export"
          ) {
            // This is the export helper. We need to make the exports configurable
            // so we can use defineProperty to override them later
            tsClosureContent += statement.getFullText().replace(
              "enumerable: true", "enumerable: true, configurable: true"
            ) + "\n";
          } else if (!ts.isReturnStatement(statement)) {
            tsClosureContent += statement.getFullText() + "\n";
          }
        }
      }
    }
  });

  if (!tsClosureContent) {
    throw new Error("Unable to find proper 'var ts =' statement in typescript.js");
  }

  tsClosureContent = tsClosureContent
    // Replace all calls to createProgram with ts.createProgram
    .replace(/(?<!function) createProgram\(/g, ` ts.createProgram(`);

  /* Copy header (all code and comments before first compiled source file) */
  const srcIndex = moduleSrc.search(/^\s*\/\/ src\//m);
  const tscHeader = moduleSrc.substring(0, srcIndex);

  /* Copy tsc body that is unique to tsc */
  const executeCommandLineIndex = moduleSrc.search(/^\s*\/\/ src\/executeCommandLine/m);
  const entrypointIndex = moduleSrc.search(/^\s*\/\/ src\/tsc\/tsc.ts$/m);
  const uniqueTscBody = moduleSrc.substring(executeCommandLineIndex, entrypointIndex)
    // Replace all calls to createProgram with ts.createProgram
    .replace(/(?<!function) createProgram\(/g, ` ts.createProgram(`);
  const entrypointBody = moduleSrc.substring(entrypointIndex);

  // tsc.ts depends on everything inside the closure being resolved, so we put it outside and prefix all calls with `ts.`
  // TODO: We may want to make this "transform" a bit more robust
  const modifiedEntrypoint = entrypointBody.replace(/\b(Debug|sys|executeCommandLine|noop)\b/g, `ts.$1`);

  /* Compose patched tsc.js */
  const modifiedTscModule = [
    tscHeader,
    `var ts = (() => {`,
    tsClosureContent,
    uniqueTscBody,
    `  return Object.assign(require_typescript(), {executeCommandLine});`,
    `})();`,
    patchSrc,
    modifiedEntrypoint
  ].join("\n");

  return modifiedTscModule;
}
