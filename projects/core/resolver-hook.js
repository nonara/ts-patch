const path = require('path');
const Module = require('module');


/* ****************************************************************************************************************** */
// region: Helpers
/* ****************************************************************************************************************** */

/**
 * Enable rootDirs merge support for require (used with ts-node)
 */
function hookRequire() {
  if (rootDirs.length > 0) {
    const originalRequire = Module.prototype.require;

    Module.prototype.require = function (request) {
      if (!path.isAbsolute(request) && request.startsWith('.')) {
        const moduleDir = path.dirname(this.filename);
        const moduleRootDir = rootDirs.find(rootDir => moduleDir.startsWith(rootDir));

        if (moduleRootDir) {
          const moduleRelativeFromRoot = path.relative(moduleRootDir, moduleDir);

          if (moduleRootDir) {
            for (const rootDir of rootDirs) {
              const possiblePath = path.join(rootDir, moduleRelativeFromRoot, request);

              let resolvedPath;
              try {
                resolvedPath = require.resolve(possiblePath);
              } catch (e) {
                continue;
              }

              return originalRequire.call(this, resolvedPath);
            }
          }
        }
      }

      return originalRequire.call(this, request);
    };
  }
}

// endregion

/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

const tsConfig = require(path.join(__dirname, 'tsconfig.json'));
const rootDirs = tsConfig.compilerOptions.rootDirs.map(rootDir => path.join(__dirname, rootDir));

hookRequire();
