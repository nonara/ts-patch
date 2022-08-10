const fs = require('fs-extra');
const path = require('path');
const { tmpDir, tsModules } = require('./config');
const tsp = require('ts-patch');


/* ****************************************************************************************************************** *
 * Setup
 * ****************************************************************************************************************** */

module.exports = () => {
  process.stdout.write(`\nPatching ${tsModules.length} TS modules...\n\n`)
  if (fs.existsSync(tmpDir)) (fs.rmSync || fs.rmdirSync)(tmpDir, { recursive: true });

  /* Patch all TS */
  for (const tsm of tsModules) {
    try {
      const srcDir = tsm.tsDir;
      const destDir = path.join(tmpDir, tsm.moduleSpecifier);
      fs.copySync(srcDir, destDir, { recursive: true });
      tsp.install({ silent: true, dir: destDir });
    } catch (e) {
      console.error(e.toString());
    }
  }
}
