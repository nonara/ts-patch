#!/usr/bin/env node
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const glob = require('glob');


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

const BASE_DIR = path.resolve('.');
const SRC_DIR = path.resolve('./src');
const DIST_DIR = path.resolve('./dist');
const DIST_RESOURCE_DIR = path.join(DIST_DIR, 'resources');
const COMPILER_DIR = path.resolve('./projects/core/src/compiler');


/* ********************************************************************************************************************
 * Post-Build Steps
 * ********************************************************************************************************************/

/* Uncomment this if you need to temporarily build without patched ts */
// shell.mv(path.join(DIST_DIR, 'src', '*'), DIST_DIR);
// shell.mv(path.join(DIST_DIR, 'shared', '*'), DIST_DIR);
// shell.rm('-rf', path.join(DIST_DIR, 'src'));
// shell.rm('-rf', path.join(DIST_DIR, 'shared'));

/* Build package.json */
const pkgJSON = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'package.json'), 'utf8'));

delete pkgJSON.scripts;
delete pkgJSON.private;
delete pkgJSON.workspaces;
delete pkgJSON.devDependencies;

// Write & remove ./dist
fs.writeFileSync(
  path.join(DIST_DIR, 'package.json'),
  JSON.stringify(pkgJSON, null, 2).replace(/(?<=['"].*?)dist\//g, '')
);

/* Copy Live files */
shell.cp('-r', COMPILER_DIR, DIST_DIR);

/* Copy Readme & Changelog */
shell.cp(path.resolve('./README.md'), DIST_DIR);
shell.cp(path.resolve('./CHANGELOG.md'), DIST_DIR);
shell.cp(path.resolve('./LICENSE.md'), DIST_DIR);

/* Add shebang line to bin files */
const binFiles = glob
  .sync(path.join(DIST_DIR, 'bin', '*.js'))
  .map((filePath) => [
      filePath,
      `#!/usr/bin/env node\n\n` + fs.readFileSync(filePath, 'utf8')
  ]);

for (const [ filePath, fileContent] of binFiles) {
  const fileName = path.basename(filePath);
  fs.writeFileSync(path.join(DIST_DIR, 'bin', fileName), fileContent, 'utf8');
}

/* Ensure EOL = LF in resources */
const resFiles = glob.sync(path.join(DIST_RESOURCE_DIR, '*').replace(/\\/g, '/'));
shell.sed('-i', /\r+$/, '', resFiles);
