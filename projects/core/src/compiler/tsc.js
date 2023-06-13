const indexPath = '../';
const path = require('path');
const { getLiveModule } = require(indexPath);
const { runInThisContext } = require("vm");


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

const { js, tsModule } = getLiveModule('tsc.js');

const script = runInThisContext(`
    (function (exports, require, module, __filename, __dirname) {
      ${js}
    });
  `);

script.call(exports, exports, require, module, tsModule.modulePath, path.dirname(tsModule.modulePath));
