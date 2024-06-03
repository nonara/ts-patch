namespace tsp {
  const Module = require('module');
  const path = require('path');
  const fs = require('fs');
  const crypto = require('crypto');

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function getEsmLibrary() {
    try {
      return require('esm') as typeof import('esm');
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND')
        throw new TsPatchError(
          `Plugin is an ESM module. To enable experimental ESM support, ` +
          `install the 'esm' package as a (dev)-dependency or global.`
        );
      else throw e;
    }
  }

  // endregion

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
        if (e.code === 'ERR_REQUIRE_ESM') {
          const resolvedPath = Module._resolveFilename(request, this, false);
          const resolvedPathExt = path.extname(resolvedPath);

          if (Module._cache[resolvedPath]) return Module._cache[resolvedPath].exports;

          /* Compile TS */
          let targetFilePath: string;
          if (tsExtensions.includes(resolvedPathExt)) {
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

          /* Setup new module */
          const newModule = new Module(request, this);
          newModule.filename = resolvedPath;
          newModule.paths = Module._nodeModulePaths(resolvedPath);

          /* Add to cache */
          Module._cache[resolvedPath] = newModule;

          /* Load with ESM library */
          const res = getEsmLibrary()(newModule)(targetFilePath);
          newModule.filename = resolvedPath;

          return res;
        }

        throw e;
      }
    }

    return cleanup;
  }

  // endregion
}
