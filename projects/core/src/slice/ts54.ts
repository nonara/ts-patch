import { ModuleFile } from '../module';
import { ModuleSlice } from './module-slice';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

/**
 * Slice 5.0 - 5.4
 */
export function sliceTs54(moduleFile: ModuleFile): ModuleSlice {
  let firstSourceFileStart: number;
  let wrapperStart: number | undefined;
  let wrapperEnd: number | undefined;
  let bodyStart: number;
  let bodyEnd: number;
  let sourceFileStarts: [ name: string, position: number ][] = [];

  const { content } = moduleFile;

  /* Find Wrapper or First File */
  let matcher = /^(?:\s*\/\/\s*src\/)|(?:var\s+ts\s*=.+)/gm;

  const firstMatch = matcher.exec(content);
  if (!firstMatch?.[0]) throw ModuleSlice.createError();

  /* Handle wrapped */
  if (firstMatch[0].startsWith('var')) {
    wrapperStart = firstMatch.index;
    bodyStart = firstMatch.index + firstMatch[0].length + 1;

    /* Find First File */
    matcher = /^\s*\/\/\s*src\//gm;
    matcher.lastIndex = wrapperStart;

    const firstFileMatch = matcher.exec(content);
    if (!firstFileMatch?.[0]) throw ModuleSlice.createError();

    firstSourceFileStart = firstFileMatch.index;

    /* Find Wrapper end */
    matcher = /^}\)\(\)\s*;?/gm;
    matcher.lastIndex = firstFileMatch.index;
    const wrapperEndMatch = matcher.exec(content);
    if (!wrapperEndMatch?.[0]) throw ModuleSlice.createError();

    bodyEnd = wrapperEndMatch.index - 1;
    wrapperEnd = wrapperEndMatch.index + wrapperEndMatch[0].length;
  }
  /* Handle non-wrapped */
  else {
    firstSourceFileStart = firstMatch.index;
    bodyStart = firstMatch.index + firstMatch[0].length;
    bodyEnd = content.length;
  }

  /* Get Source File Positions */
  matcher = /^\s*\/\/\s*(src\/.+)$/gm;
  matcher.lastIndex = firstSourceFileStart;
  for (let match = matcher.exec(content); match != null; match = matcher.exec(content)) {
    sourceFileStarts.push([ match[1], match.index ]);
  }

  return {
    moduleFile,
    firstSourceFileStart,
    wrapperPos: wrapperStart != null ? { start: wrapperStart, end: wrapperEnd! } : undefined,
    fileEnd: content.length,
    bodyPos: { start: bodyStart, end: bodyEnd },
    sourceFileStarts,
    bodyWrapper: {
      start: 'var ts = (() => {',
      end: '})();'
    }
  };
}

// endregion
