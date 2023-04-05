import fs from 'fs';
import { PatchDetail } from '../patch/patch-detail';
import path from 'path';
import { getHash, withFileLock } from '../utils';


/* ****************************************************************************************************************** */
// region: Config
/* ****************************************************************************************************************** */

const SHORT_CHUNK_SIZE = 1024;
const LONG_CHUNK_SIZE = 64_536;

// endregion


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface ModuleFile {
  moduleName: string
  patchDetail?: PatchDetail
  filePath: string
  get content(): string

  getHash(): string
}

// endregion


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

function readFile(filePath: string, headersOnly?: boolean) {
  return withFileLock(filePath, () => {
    let CHUNK_SIZE = headersOnly ? SHORT_CHUNK_SIZE : LONG_CHUNK_SIZE;
    let result = '';
    let doneReadingHeaders = false;
    let bytesRead;
    let buffer = Buffer.alloc(CHUNK_SIZE);
    const headerLines: string[] = [];
    let isLastHeaderIncomplete = false;

    const fd = fs.openSync(filePath, 'r');

    try {
      readFileLoop:
        while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
          const chunkString = buffer.toString('utf-8', 0, bytesRead);

          /* Handle Header */
          if (!doneReadingHeaders) {
            const lines = chunkString.split('\n');

            lineLoop:
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (i === 0 && isLastHeaderIncomplete) {
                  headerLines[headerLines.length - 1] += line;
                } else {
                  if (line.startsWith('///')) {
                    headerLines.push(line);
                  } else {
                    doneReadingHeaders = true;
                    if (!headersOnly) {
                      result += lines.slice(i).join('\n');
                      CHUNK_SIZE = LONG_CHUNK_SIZE;
                      buffer = Buffer.alloc(CHUNK_SIZE);
                      break lineLoop;
                    } else {
                      break readFileLoop;
                    }
                  }
                }
              }

            if (!doneReadingHeaders) isLastHeaderIncomplete = !chunkString.endsWith('\n');
          } else {
            /* Handle content */
            result += chunkString;
          }
        }

      return { headerLines, content: headersOnly ? undefined : result };
    } finally {
      fs.closeSync(fd);
    }
  });
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getModuleFile(filePath: string, loadFullContent?: boolean): ModuleFile {
  let { headerLines, content } = readFile(filePath, !loadFullContent);

  /* Get PatchDetail */
  const patchDetail = PatchDetail.fromHeader(headerLines);

  return {
    moduleName: path.basename(filePath),
    filePath,
    patchDetail,
    get content() {
      if (content == null) content = readFile(filePath, false).content;
      return content!;
    },
    getHash(): string {
      return getHash(this.content);
    }
  };
}

// endregion
