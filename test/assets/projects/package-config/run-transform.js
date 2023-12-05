const path = require('path');
const { spawnSync } = require('child_process');
const { getLiveModule } = require('ts-patch');
const { runInThisContext } = require("vm");


/* ****************************************************************************************************************** *
 * Helpers
 * ****************************************************************************************************************** */

function runTsc(disableTspClause) {
  const pluginDir = path.resolve(__dirname, 'plugin');
  const pluginPackageJsonPath = path.join(pluginDir, 'package.json');

  process.env.TSP_SKIP_CACHE = true;
  const { js, tsModule } = getLiveModule('tsc.js');

  let currentWriteFile = undefined;
  const fs = {
    ...require('fs'),
    mkdirSync: function (dirPath) {
      return;
    },
    writeFileSync: function (filePath, data, options) {
      throw new Error('Should not be used');
    },
    openSync: function (filePath, flags, mode) {
      currentWriteFile = filePath;
      return 1;
    },
    writeSync: function (fd, data, options) {
      // process.stdout.write(currentWriteFile + '\n');

      // Check if the file is src/index.ts and output to stdout
      if (path.basename(currentWriteFile) === 'index.js') {
        process.stdout.write(data);
      }
    },
    closeSync: function (fd) {
      currentWriteFile = undefined;
    },
    readFileSync: function (filePath, options) {
      if (disableTspClause && path.normalize(filePath) === pluginPackageJsonPath) {
        return JSON.stringify({ });
      }
      return require('fs').readFileSync(filePath, options);
    }
  }

  const myRequire = function (modulePath) {
    if (modulePath === 'fs') return fs;
    return require(modulePath);
  }
  Object.assign(myRequire, require);

  const script = runInThisContext(`
    (function (exports, require, module, __filename, __dirname) {
      process.argv = ['node', 'tsc.js', '--noEmit', 'false'];
      ${js}
    });
  `);

  script.call(exports, exports, myRequire, module, tsModule.modulePath, path.dirname(tsModule.modulePath));
}


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

const disableTspClause = process.argv[2] === '--disable';
runTsc(disableTspClause);
