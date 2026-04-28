namespace tsp {
  const Module = require('module');
  const path = require('path');
  const fs = require('fs');
  const crypto = require('crypto');

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  export function registerEsmIntercept(registerConfig: RegisterConfig): () => void {
    const originalRequire = Module.prototype.require;
    const builtFiles = new Map<string, string>();

    const getHash = () => {
      let hash: string;
      do {
        hash = crypto.randomBytes(16).toString('hex');
      } while (builtFiles.has(hash));

      return hash;
    }

    /* Create cleanup function */
    const cleanup = () => {
      /* Cleanup temp ESM files */
      for (const { 1: filePath } of builtFiles) {
        delete require.cache[filePath];
        try {
          fs.rmSync(filePath, { force: true, maxRetries: 3 });
        } catch (e) {
          if (process.env.NODE_ENV !== 'production')
            console.warn(`[ts-patch] Warning: Failed to delete temporary esm cache file: ${filePath}.`);
        }
      }

      builtFiles.clear();
      Module.prototype.require = originalRequire;
    }

    /* Set Hooks */
    try {
      Module.prototype.require = wrappedRequire;
    } catch (e) {
      cleanup();
    }

    /* ********************************************************* *
     * Helpers
     * ********************************************************* */

    function wrappedRequire(this: unknown, request: string) {
      try {
        return originalRequire.apply(this, arguments);
      } catch (e) {
        /*
         * Native Node >=22.12 can synchronously require compatible JavaScript ESM, so this branch is not expected
         * for normal .mjs transformer loading anymore. It is still reached while ts-node is in the loading path:
         * ts-node's CommonJS require hook refuses .mts files, and .ts files inside "type": "module" packages,
         * by throwing ERR_REQUIRE_ESM. Until ts-node is replaced, this fallback compiles that TS ESM source to a
         * temporary .mjs file and lets native Node require() load the compiled output.
         *
         * When the transformer loader is moved from ts-node to a direct TypeScript compiler API path, revisit
         * whether this require hook, the ERR_REQUIRE_ESM control flow, and the isEsm option can be removed.
         */
        if (e.code === 'ERR_REQUIRE_ESM') {
          const resolvedPath = Module._resolveFilename(request, this, false);
          const resolvedPathExt = path.extname(resolvedPath);

          /* Compile TS */
          let targetFilePath: string;
          if (tsExtensions.includes(resolvedPathExt)) {
            if (resolvedPathExt === '.cts') {
              throw new TsPatchError(`Cannot load ".cts" transformer "${resolvedPath}" as ESM. Use ".mts" for ESM transformers.`);
            }

            if (!builtFiles.has(resolvedPath)) {
              const tsCode = fs.readFileSync(resolvedPath, 'utf8');

              // NOTE - I don't know why, but if you supply a *.ts file to tsNode.compile it will be output as cjs,
              //  regardless of the tsConfig properly specifying ESNext for module and target. Notably, this issue seems
              //  to have started with TS v5.5,
              //
              //  To work around, we will tell ts-node that it's an "mts" file.
              const newPath = resolvedPath.replace(/\.ts$/, '.mts');

              const jsCode = registerConfig.tsNodeInstance!.compile(tsCode, newPath);
              const outputFileName = getHash() + '.mjs';
              const outputFilePath = path.join(getTmpDir('esm'), outputFileName);
              fs.writeFileSync(outputFilePath, jsCode, 'utf8');

              builtFiles.set(resolvedPath, outputFilePath);
              targetFilePath = outputFilePath;
            } else {
              targetFilePath = builtFiles.get(resolvedPath)!;
            }
          } else {
            targetFilePath = resolvedPath;
          }

          return originalRequire.apply(this, [ targetFilePath ]);
        }

        throw e;
      }
    }

    return cleanup;
  }

  // endregion
}
