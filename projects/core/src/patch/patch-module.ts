import ts from 'typescript';
import fs from 'fs';
import {
  defaultNodePrinterOptions, dtsPatchFilePath, execTscCmd, modulePatchFilePath, tsWrapperClose, tsWrapperOpen
} from '../config';
import { getTsModule, TsModule } from '../module';
import {
  addOriginalCreateProgramTransformer, createMergeStatementsTransformer, fixTsEarlyReturnTransformer,
  hookTscExecTransformer, patchCreateProgramTransformer, patchEmitterTransformer
} from './transformers';
import { SourceSection } from '../module/source-section';
import { PatchError } from '../system';
import { readFileWithLock } from '../utils';
import { PatchDetail } from './patch-detail';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const dtsPatchSrc = '\n' + fs.readFileSync(dtsPatchFilePath, 'utf-8');
const jsPatchSrc = fs.readFileSync(modulePatchFilePath, 'utf-8')

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function patchModule(tsModule: TsModule, skipDts: boolean = false): { js: string, dts?: string } {
  let shouldWrap: boolean = false;
  switch (tsModule.moduleName) {
    case 'tsc.js':
    case 'tsserver.js':
    case 'tsserverlibrary.js':
    case 'typescript.js':
      shouldWrap = true;
  }

  const source = tsModule.getSource();

  const printableBodyFooters: (SourceSection | string)[] = [];
  const printableFooters: (SourceSection | string)[] = [];

  /* Splice in full compiler functionality (if not already present) */
  if (tsModule.moduleName !== 'typescript.js') {
    const typescriptModule = getTsModule(tsModule.package, 'typescript.js');
    const tsSource = typescriptModule.getSource();

    /* Merge Headers & Footer */
    mergeStatements(source.fileHeader, tsSource.fileHeader);
    source.bodyHeader = tsSource.bodyHeader;
    mergeStatements(source.fileFooter, tsSource.fileFooter);

    /* Replace body */
    for (let i = source.body.length - 1; i >= 0; i--) {
      const bodySection = source.body[i];
      if (tsSource.body.some(s => s.srcFileName === bodySection.srcFileName)) {
        source.body.splice(i, 1);
      }
    }

    source.body.unshift(...tsSource.body);

    /* Fix early return */
    const typescriptSection = source.body.find(s => s.srcFileName === 'src/typescript/typescript.ts');
    if (!typescriptSection) throw new PatchError(`Could not find Typescript source section`);
    typescriptSection.transform([ fixTsEarlyReturnTransformer ]);

    printableBodyFooters.push(`return returnResult;`);
  }

  /* Patch Program */
  const programSection = source.body.find(s => s.srcFileName === 'src/compiler/program.ts');
  if (!programSection) throw new PatchError(`Could not find Program source section`);
  programSection.transform([ patchCreateProgramTransformer ]);

  /* Add originalCreateProgram to exports */
  const namespacesTsSection = source.body.find(s => s.srcFileName === 'src/typescript/_namespaces/ts.ts');
  if (!namespacesTsSection) throw new PatchError(`Could not find NamespacesTs source section`);
  namespacesTsSection.transform([ addOriginalCreateProgramTransformer ]);

  /* Patch emitter (for diagnostics tools) */
  const emitterSection = source.body.find(s => s.srcFileName === 'src/compiler/watch.ts');
  if (!emitterSection) throw new PatchError(`Could not find Emitter source section`);
  emitterSection.transform([ patchEmitterTransformer ]);

  /* Move executeCommandLine outside of closure */
  if (tsModule.moduleName === 'tsc.js') {
    const tscSection = source.body.find(s => s.srcFileName === 'src/tsc/tsc.ts');
    if (!tscSection) throw new PatchError(`Could not find Tsc source section`);

    tscSection.transform([ hookTscExecTransformer ]);

    printableFooters.push(`tsp.${execTscCmd}();`);
  }

  /* Print the module */
  const printedJs = printModule();

  /* Get Dts */
  let dts: string | undefined;
  if (!skipDts && tsModule.dtsPath) {
    const dtsText = readFileWithLock(tsModule.dtsPath);
    dts =
      dtsPatchSrc + '\n' +
      dtsText;
  }

  /* Get JS */
  const patchDetail = PatchDetail.fromModule(tsModule, printedJs);
  const js =
    patchDetail.toHeader() + '\n' +
    jsPatchSrc + '\n' +
    printedJs;

  return { dts, js };

  function getPrintList() {
    const list: [item: (string | SourceSection | undefined), indent?: number][] = [];
    let indentLevel = 0;

    /* File Header */
    list.push([ source.fileHeader, indentLevel ]);

    /* Body Wrapper Open */
    if (shouldWrap) {
      list.push([ `\n${tsWrapperOpen}\n`, indentLevel ]);
      indentLevel = 2;
    }

    /* Body Header*/
    list.push([ source.bodyHeader, indentLevel ]);

    /* Body */
    source.body.forEach(section => list.push([ section, indentLevel ]));

    /* Body Footers */
    printableBodyFooters.forEach(f => list.push([ f, indentLevel ]));

    /* Body Wrapper Close */
    if (shouldWrap) {
      indentLevel = 0;
      list.push([ `\n${tsWrapperClose}\n`, indentLevel ]);
    }

    /* File Footer */
    list.push([ source.fileFooter, indentLevel ]);
    printableFooters.forEach(f => list.push([ f, indentLevel ]));

    return list;
  }

  function printModule() {
    const printer = ts.createPrinter(defaultNodePrinterOptions);
    let outputStr = ``;

    for (const [ item, indentLevel ] of getPrintList()) {
      let printed: string;
      let addedIndent: number | undefined;
      if (item === undefined) continue;
      if (typeof item === 'string') {
        printed = item;
      } else {
        printed = item.print(printer);
        if (indentLevel && item.indentLevel < indentLevel) {
          addedIndent = indentLevel - item.indentLevel;
        }
      }

      if (addedIndent) printed = printed.replace(/^/gm, ' '.repeat(addedIndent));

      outputStr += printed;
    }

    return outputStr;
  }

  function mergeStatements(
    baseSection: SourceSection | undefined,
    addedSection: SourceSection | undefined,
  ) {
    if (!baseSection || !addedSection) {
      if (addedSection) baseSection = addedSection;
      return;
    }

    const baseSourceFile = baseSection.getSourceFile();
    const addedSourceFile = addedSection.getSourceFile();

    const transformer = createMergeStatementsTransformer(baseSourceFile, addedSourceFile);
    baseSection.transform([ transformer ]);
  }
}

// endregion
