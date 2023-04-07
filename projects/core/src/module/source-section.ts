import ts from 'typescript';
import { ModuleFile } from './module-file';
import path from 'path';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface SourceSection {
  readonly sectionName: 'file-header' | 'body-header' | 'body' | 'file-footer';
  readonly srcFileName?: string;
  readonly pos: { start: number; end: number };
  indentLevel: number;

  hasTransformed?: boolean;
  hasUpdatedSourceText?: boolean;

  get sourceText(): string;
  updateSourceText(newText: string): void;
  getSourceFile(): ts.SourceFile;
  getOriginalSourceFile(): ts.SourceFile;
  transform(transformers: ts.TransformerFactory<ts.SourceFile>[]): void;
  print(printer?: ts.Printer): string;
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function createSourceSection(
  moduleFile: ModuleFile,
  sectionName: SourceSection['sectionName'],
  startPos: number,
  endPos: number,
  indentLevel: number = 0,
  srcFileName?: string,
):
  SourceSection
{
  let sourceText: string | undefined;
  let originalSourceFile: ts.SourceFile | undefined;
  let sourceFile: ts.SourceFile | undefined;
  let sourceFileName: string | undefined;

  return {
    hasTransformed: false,
    hasUpdatedSourceText: false,
    sectionName,
    srcFileName,
    indentLevel,
    pos: { start: startPos, end: endPos },
    get sourceText() {
      return sourceText ??= moduleFile.content.slice(startPos, endPos);
    },
    getSourceFile() {
      if (!sourceFile) {
        if (this.hasUpdatedSourceText) return createSourceFile(this);
        else return this.getOriginalSourceFile();
      }
      return sourceFile;
    },
    updateSourceText(newText: string) {
      sourceText = newText;
      sourceFile = undefined;
    },
    getOriginalSourceFile() {
      originalSourceFile ??= createSourceFile(this);
      return originalSourceFile;
    },
    transform(transformers: ts.TransformerFactory<ts.SourceFile>[]) {
      const result = ts.transform(this.getSourceFile(), transformers);
      sourceFile = result.transformed[0];
      this.hasTransformed = true;
      this.indentLevel = 0;
    },
    print(printer?: ts.Printer) {
      if (!this.hasTransformed) return this.sourceText;

      printer ??= ts.createPrinter();
      return printer.printFile(this.getSourceFile());
    }
  }

  function createSourceFile(sourceSection: SourceSection) {
    return ts.createSourceFile(
      getSourceFileName(),
      sourceSection.sourceText,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.JS
    );
  }

  function getSourceFileName() {
    if (!sourceFileName) {
      sourceFileName = srcFileName;
      if (!sourceFileName) {
        const baseName = path.basename(moduleFile.filePath, path.extname(moduleFile.filePath));
        sourceFileName = `${baseName}.${sectionName}.ts`;
      }
    }
    return sourceFileName;
  }
}

// endregion
