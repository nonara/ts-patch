import fs from "fs";
import { getHash, withFileLock } from "../system";
import { PatchDetail } from "../patch/patch-detail";
import path from "path";


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
  readonly moduleName: string
  readonly patchDetail?: PatchDetail
  readonly content?: string
  readonly filePath: string

  getHash(): string
}

export interface GetModuleFileOptions {
  headersOnly?: boolean
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
      while ((bytesRead = fs.readSync(fd, buffer, 0, CHUNK_SIZE, null)) > 0) {
        const chunkString = buffer.toString('utf-8', 0, bytesRead);

        /* Handle Header */
        if (!doneReadingHeaders) {
          const lines = chunkString.split('\n');

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (i === 0 && isLastHeaderIncomplete) {
              headerLines[headerLines.length - 1] += line;
            } else {
              if (line.startsWith('///')) {
                headerLines.push(line);
              } else {
                CHUNK_SIZE = LONG_CHUNK_SIZE;
                doneReadingHeaders = true;
                result += lines.slice(i).join('\n');
                break;
              }
            }
          }

          if (!doneReadingHeaders) isLastHeaderIncomplete = !chunkString.endsWith('\n');
          continue;
        }

        /* Handle content */
        result += chunkString;
      }

      return { headerLines, content: result };
    } finally {
      fs.closeSync(fd);
    }
  });
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getModuleFile(filePath: string, opt?: GetModuleFileOptions): ModuleFile {
  const { headerLines, content } = readFile(filePath, opt?.headersOnly);

  /* Get PatchDetail */
  const patchDetail = PatchDetail.fromHeader(headerLines);

  return {
    moduleName: path.basename(filePath),
    filePath,
    patchDetail,
    content,
    getHash(): string {
      return getHash(content);
    }
  };
}

// endregion
