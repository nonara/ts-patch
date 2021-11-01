import type * as ts from 'typescript'
import type { ProgramTransformerExtras } from '../shared/plugin-types';
import * as fs from 'fs';
import * as path from 'path';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const srcTypesFileName = path.resolve(__dirname, '../shared/plugin-types.ts');
const destTypesFileName = path.resolve(__dirname, 'lib/types/plugin-types.ts');

// endregion


/* ****************************************************************************************************************** */
// region: Transformers
/* ****************************************************************************************************************** */

function transformPatchDeclarationsFile(this: typeof ts, ctx: ts.TransformationContext) {
  const { factory } = ctx;
  const moduleName = factory.createIdentifier('ts');

  return (sourceFile: ts.SourceFile) => {
    const statements = sourceFile
      .statements
      .filter(node =>
        this.isModuleDeclaration(node) && this.getJSDocTags(node).some(t => t.tagName.text === 'build-types')
      )
      .map((node: ts.ModuleDeclaration) =>
        factory.updateModuleDeclaration(node, node.decorators, node.modifiers, moduleName, node.body)
      );

    return factory.updateSourceFile(
      sourceFile,
      statements,
      sourceFile.isDeclarationFile
    );
  }
}

function transformPluginTypes(this: typeof ts, ctx: ts.TransformationContext) {
  const { factory } = ctx;
  return (sourceFile: ts.SourceFile) => {
    const moduleDeclaration =
      factory.createModuleDeclaration(
        undefined,
        [ factory.createModifier(this.SyntaxKind.DeclareKeyword) ],
        factory.createIdentifier('tsp'),
        factory.createModuleBlock(
          sourceFile
            .statements
            .filter(node => this.isDeclaration(node) && this.getCombinedModifierFlags(node) & this.ModifierFlags.Export)
        ),
        this.NodeFlags.Namespace | this.NodeFlags.ExportContext | this.NodeFlags.Ambient | this.NodeFlags.ContextFlags
      );

    return factory.updateSourceFile(sourceFile, [ moduleDeclaration ]);
  }
}

// endregion


/* ****************************************************************************************************************** *
 * Program Transformer - Build and insert plugin-types.ts
 * ****************************************************************************************************************** */

export function transformProgram(
  program: ts.Program,
  host: ts.CompilerHost,
  opt: any,
  { ts }: ProgramTransformerExtras
)
{
  host ??= ts.createCompilerHost(program.getCompilerOptions(), true);
  const printer = ts.createPrinter({ removeComments: true });
  const srcFileName = ts.normalizePath(srcTypesFileName);
  const destFileName = ts.normalizePath(destTypesFileName);

  hookWriteFile();
  generatePluginTypesAndInjectToProgram();

  return ts.createProgram(
    program.getRootFileNames().concat([ destFileName ]),
    program.getCompilerOptions(),
    host,
    program
  );

  function hookWriteFile() {
    const originalWriteFile = host.writeFile;
    host.writeFile = (fileName: string, data: string, ...args: any[]) => {
      /* Transform declarations */
      if (/module-patch.d.ts$/.test(fileName)) {
        let sourceFile = ts.createSourceFile(fileName, data, ts.ScriptTarget.ES2015, true);
        sourceFile = ts.transform(sourceFile, [ transformPatchDeclarationsFile.bind(ts) ]).transformed[0];
        return (<any>originalWriteFile)(fileName, printer.printFile(sourceFile), ...args);
      }

      /* Strip comments from js */
      if (/module-patch.js$/.test(fileName)) {
        const sourceFile = ts.createSourceFile(fileName, data, ts.ScriptTarget.ES2015, false);
        return (<any>originalWriteFile)(fileName, printer.printFile(sourceFile), ...args);
      }

      return (<any>originalWriteFile)(fileName, data, ...args);
    }
  }

  function generatePluginTypesAndInjectToProgram() {
    let sourceFile = ts.createSourceFile(srcFileName, fs.readFileSync(srcFileName, 'utf8'), ts.ScriptTarget.ES2015, true);
    sourceFile = ts.transform(sourceFile, [ transformPluginTypes.bind(ts) ]).transformed[0];

    const moduleBody = `/** AUTO-GENERATED - DO NOT EDIT */\n\n/** @build-types */\n` + printer.printFile(sourceFile);
    sourceFile = ts.createSourceFile(destFileName, moduleBody, ts.ScriptTarget.ES2015, true);
    fs.writeFileSync(destFileName, moduleBody);
  }
}
