import ts from 'typescript';
import { PackageError } from '../system';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface ModuleSource {
  sourceFile: ts.SourceFile
  fileHeaderNodes: ts.Node[]
  bodyStatements: ts.Node[]
  bodyHeaderNodes: ts.Node[] | undefined
  footerNodes: ts.Node[] | undefined
  innerSourceFiles: Map<string, ts.Node[]>
  usesTsNamespace: boolean
  sourceText: string
}

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

const getError = (moduleName: string, msg = 'Unrecognized TS module format! Please file a bug report.') =>
  new PackageError(`${moduleName} is not a valid typescript module! — ${msg}`);

function getTsWrappedStatements(declaration: ts.VariableDeclaration) {
  const initializer = declaration.initializer;
  if (initializer && ts.isCallExpression(initializer)) {
    const parenExpression = initializer.expression;

    if (ts.isParenthesizedExpression(parenExpression)) {
      const closureFuncExpr = parenExpression.expression;

      if (ts.isArrowFunction(closureFuncExpr)) {
        const closureBody = closureFuncExpr.body as ts.Block;
        return [ ...closureBody.statements ];
      }
    }
  }

  throw getError('ts', 'Could not find ts body statements!');
}

function getLeadingCommentsText(node: ts.Node, sourceFile: ts.SourceFile): string[] {
  const commentRanges = ts.getLeadingCommentRanges(sourceFile.text, node.getFullStart());
  if (!commentRanges) {
    return [];
  }

  return commentRanges.map((range) => {
    return sourceFile.text.slice(range.pos, range.end);
  });
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function visitModule(sourceFile: ts.SourceFile): ModuleSource {
  let bodyStatements: ts.Node[] | undefined;
  let footerNodes: ts.Node[] | undefined;
  let isWrapped: boolean | undefined;

  /* Slice sections */
  let headerNodes: ts.Node[] | undefined;

  /* Find header & body nodes */
  for (let i = 0; i < sourceFile.statements.length; i++) {
    const statement = sourceFile.statements[i];

    /* Handle wrapped statements */
    if (ts.isVariableStatement(statement)) {
      const declaration = statement.declarationList.declarations[0];
      if (declaration.name.getText() === 'ts') {
        headerNodes = sourceFile.statements.slice(0, i);
        bodyStatements = getTsWrappedStatements(declaration);
        footerNodes = sourceFile.statements.slice(i + 1);

        isWrapped = true;

        break;
      }
    }

    /* Handle non-wrapped statements */
    // If node has a comment matching // src/*
    if (getLeadingCommentsText(statement, sourceFile).some((comment) => comment.includes('// src/'))) {
      headerNodes = sourceFile.statements.slice(0, i);
      bodyStatements = sourceFile.statements.slice(i);

      isWrapped = false;
      break;
    }
  }

  if (!bodyStatements || !headerNodes) throw getError('ts', 'Could not find ts body statements!');

  /* Find file code */
  const fileCode = new Map<string, ts.Node[]>();
  let currentFileName: string | undefined;
  let currentFileStartNode: ts.Node | undefined;
  let bodyHeaderNodes: ts.Node[] | undefined;
  for (const statement of bodyStatements) {
    const comment = getLeadingCommentsText(statement, sourceFile).find((comment) => comment.includes('// src/'));
    if (comment) {
      const fileName = comment.match(/\/\/ src\/(.*)/)?.[1];
      if (!fileName) continue;

      if (currentFileStartNode) {
        fileCode.set(
          currentFileName!,
          bodyStatements.slice(bodyStatements.indexOf(currentFileStartNode),
            bodyStatements.indexOf(statement)
          )
        );
      } else {
        bodyHeaderNodes = bodyStatements.slice(0, bodyStatements.indexOf(statement));
      }

      currentFileName = fileName;
      currentFileStartNode = statement;
    }
  }

  return {
    sourceFile,
    bodyStatements,
    fileHeaderNodes: headerNodes,
    innerSourceFiles: fileCode,
    usesTsNamespace: isWrapped!,
    footerNodes,
    bodyHeaderNodes,
    sourceText: sourceFile.getFullText()
  }
}

// endregion
