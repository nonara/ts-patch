import ts, { nullTransformationContext } from 'typescript';
import { TsModule } from './ts-module';
import fs from 'fs';
import path from 'path';
import { appRoot, PatchError, tspPackageJSON } from '../system';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const getPatchHeader = (moduleName: string) => `/// tsp: ${tspPackageJSON.version}\n/// module: ${moduleName}\n\n`;
const getPatchFooter = () => `/// endtsp\n\n`;

const dtsPatchSrc = '\n' +
  fs.readFileSync(path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.d.ts'), 'utf-8');

const jsPatchSrc =
  fs.readFileSync(path.resolve(appRoot, tspPackageJSON.directories.resources, 'module-patch.js'), 'utf-8')

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function mergeStatements(baseNodes: ts.Node[], addedNodes: ts.Node[]): ts.Node[] {
  const mergedNodesMap = new Map<string | symbol, ts.Node>();

  // Add baseNodes to the map
  baseNodes.forEach(addNode);
  addedNodes.forEach(addNode);

  function addNode(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) || ts.isVariableStatement(node)) {
      const name = getNodeName(node) ?? Symbol();
      if (!mergedNodesMap.has(name)) mergedNodesMap.set(name, node);
    } else {
      mergedNodesMap.set(Symbol(), node);
    }
  }

  function getNodeName(node: ts.FunctionDeclaration | ts.VariableStatement): string | undefined {
    if (ts.isFunctionDeclaration(node)) {
      return node.name?.escapedText as string;
    } else if (ts.isVariableStatement(node)) {
      const declaration = node.declarationList.declarations[0];
      return declaration.name.getText();
    }

    throw new PatchError('Unreachable - Invalid node type!');
  }

  return Array.from(mergedNodesMap.values());
}


// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function patchModule(tsModule: TsModule, skipDts: boolean = false, skipCache: boolean = false):
  { js: string, dts?: string }
{
  const factory = nullTransformationContext.factory;

  /* Clone innerSourceFiles */
  let innerSourceFiles: typeof tsModule.source.innerSourceFiles = new Map();
  tsModule.source.innerSourceFiles.forEach((statements, fileName) => {
    innerSourceFiles.set(fileName, [ ...statements ])
  });

  /* Splice in full compiler functionality (if not already present) */
  let fileHeaderNodes: ts.Node[] = [ ...tsModule.source.fileHeaderNodes ];
  let bodyHeaderNodes = tsModule.source.bodyHeaderNodes && [ ...tsModule.source.bodyHeaderNodes ];
  if (tsModule.moduleName !== 'typescript.js') {
    const innerSourceFileEntries = [ ...innerSourceFiles.entries() ];

    const typescriptModule = tsModule.package.getModule('typescript.js', skipCache);
    const typescriptFiles = [ ...typescriptModule.source.innerSourceFiles.keys() ];

    /* Get composites of headers */
    fileHeaderNodes = mergeStatements(fileHeaderNodes, typescriptModule.source.fileHeaderNodes);
    bodyHeaderNodes = bodyHeaderNodes && mergeStatements(bodyHeaderNodes, typescriptModule.source.bodyHeaderNodes ?? []);

    /* Find all existing compiler-related files & drop them */
    let firstIndex: number;
    innerSourceFileEntries.forEach(([ fileName ], index) => {
      if (typescriptFiles.includes(fileName)) {
        if (firstIndex === undefined) firstIndex = index;
        innerSourceFileEntries.splice(index, 1);
      }
    });

    /* Insert all from typescript.js */
    innerSourceFileEntries.splice(firstIndex!, 0, ...typescriptModule.source.innerSourceFiles.entries());

    /* Rebuild innerSourceFiles */
    innerSourceFiles = new Map(innerSourceFileEntries);
  }

  /* Patch emitFilesAndReportErrors */
  patchEmitFilesAndReportErrors();

  /* Patch createProgram */
  patchCreateProgram();

  /* Write patched source file */
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed, removeComments: false });

  const printedFileHeaderNodes = printNodes(fileHeaderNodes);
  const printedBodyNodes = printNodes(
    [ ...(bodyHeaderNodes ?? []), ...innerSourceFiles.values() ].flat(),
    tsModule.source.usesTsNamespace
  );
  const printedFooterNodes = tsModule.source.footerNodes?.length ? printNodes(tsModule.source.footerNodes) : '';

  const jsBody =
    getPatchHeader(tsModule.moduleName) +
    jsPatchSrc + '\n' +
    getPatchFooter() +
    printedFileHeaderNodes + '\n' +
    printedBodyNodes + '\n' +
    printedFooterNodes;

  /* Write patched dts file */
  let dtsBody: string | undefined;
  if (!skipDts && tsModule.dtsPath) {
    dtsBody =
      getPatchHeader(tsModule.moduleName) +
      dtsPatchSrc + '\n' +
      getPatchFooter() +
      tsModule.dtsText;
  }

  return { js: jsBody, dts: dtsBody };

  /* ********************************************************* *
   * Helpers
   * ********************************************************* */

  function printNodes(nodes: ts.Node[], wrapWithTsClosure: boolean = false) {
    const blankSourceFile = ts.createSourceFile(tsModule.moduleName, '', ts.ScriptTarget.Latest);
    let res = nodes
      .map(n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile() ?? blankSourceFile))
      .join('\n');

    if (wrapWithTsClosure) res = `var ts = (() => {\n${res}\n})();`;

    return res;
  }

  // TODO - Manual update is breaking this
  function patchEmitFilesAndReportErrors() {
    const watchNodes = innerSourceFiles.get('compiler/watch.ts')!

    /* Find Function Declaration */
    let emitFilesAndReportErrorsNode =
      watchNodes.find(node => ts.isFunctionDeclaration(node) && node.name?.escapedText === 'emitFilesAndReportErrors') as ts.FunctionDeclaration;

    if (!emitFilesAndReportErrorsNode) throw new PatchError('Failed to find emitFilesAndReportErrors function!');

    /* Find emitResult assignment */
    let emitResultNodeIndex = emitFilesAndReportErrorsNode
      .body!
      .statements
      .findIndex(node =>
        ts.isVariableStatement(node) &&
        node.declarationList.declarations.some(decl =>
          ts.isIdentifier(decl.name) && decl.name.escapedText === 'emitResult'
        )
      );

    if (emitResultNodeIndex < 0) throw new PatchError('Failed to find emitResult assignment!');

    const insertedMapSetterNode = factory.createExpressionStatement(factory.createCallExpression(
      factory.createPropertyAccessExpression(
        factory.createPropertyAccessExpression(
          factory.createIdentifier("tsp"),
          factory.createIdentifier("diagnosticMap")
        ),
        factory.createIdentifier("set")
      ),
      undefined,
      [
        factory.createIdentifier("program"),
        factory.createStringLiteral("allDiagnostics")
      ]
    ))

    /* Insert map setter - prepend */
    const newEmitFilesAndReportErrorsNode = factory.createFunctionDeclaration(
      emitFilesAndReportErrorsNode.decorators,
      emitFilesAndReportErrorsNode.modifiers,
      emitFilesAndReportErrorsNode.asteriskToken,
      emitFilesAndReportErrorsNode.name,
      emitFilesAndReportErrorsNode.typeParameters,
      emitFilesAndReportErrorsNode.parameters,
      emitFilesAndReportErrorsNode.type,
      factory.createBlock([
          ...emitFilesAndReportErrorsNode.body!.statements.slice(0, emitResultNodeIndex),
        insertedMapSetterNode,
        ...emitFilesAndReportErrorsNode.body!.statements.slice(emitResultNodeIndex)
      ])
    );
    // @ts-expect-error The parent property is readonly, but we need to set it to make printing
    newEmitFilesAndReportErrorsNode.parent = emitFilesAndReportErrorsNode.parent;

    /* Replace node */
    watchNodes.splice(watchNodes.indexOf(emitFilesAndReportErrorsNode), 1, newEmitFilesAndReportErrorsNode);
  }

  function patchCreateProgram() {
    const programNodes = innerSourceFiles.get('compiler/program.ts')!

    /* Find Function Declaration */
    const createProgramIdx =
      // Note, we use escapedText here instead of getText to support nodes created with nullTransformationContext
      // factory
      programNodes.findIndex(node => ts.isFunctionDeclaration(node) && node.name?.escapedText === 'createProgram');

    if (createProgramIdx === -1) throw new PatchError('Could not find createProgram() in module source!');

    /* Rename to originalCreateProgram */
    const createProgramNode = programNodes[createProgramIdx] as ts.FunctionDeclaration;
    const newCreateProgramNode = factory.updateFunctionDeclaration(
      createProgramNode,
      createProgramNode.decorators,
      createProgramNode.modifiers,
      createProgramNode.asteriskToken,
      factory.createIdentifier('originalCreateProgram'),
      createProgramNode.typeParameters,
      createProgramNode.parameters,
      createProgramNode.type,
      createProgramNode.body
    );
    // @ts-expect-error The parent property is readonly, but we need to set it to make printing
    newCreateProgramNode.parent = createProgramNode.parent;

    // function createProgram() { return tsp.originalCreateProgram(...arguments); }
    const createProgramForwarderNode = factory.createFunctionDeclaration(
      undefined,
      undefined,
      undefined,
      factory.createIdentifier('createProgram'),
      undefined,
      [],
      undefined,
      factory.createBlock(
        [ factory.createReturnStatement(factory.createCallExpression(
          factory.createPropertyAccessExpression(
            factory.createIdentifier('tsp'),
            factory.createIdentifier('createProgram')
          ),
          undefined,
          [ factory.createSpreadElement(factory.createIdentifier('arguments')) ]
        )) ],
        false
      )
    );

    /* Splice in new nodes */
    programNodes.splice(createProgramIdx, 1, newCreateProgramNode, createProgramForwarderNode);
  }
}

// endregion
