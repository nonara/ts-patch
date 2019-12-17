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


/* ********************************************************************************************************************
 * Post-Build Steps
 * ********************************************************************************************************************/

/* Build package.json */
const pkgJSON = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'package.json'), 'utf8'));

delete pkgJSON.scripts;
delete pkgJSON.private;
delete pkgJSON.devDependencies;

// Write & remove ./dist
fs.writeFileSync(
  path.join(DIST_DIR, 'package.json'),
  JSON.stringify(pkgJSON, null, 2).replace(/(?<=['"].*?)dist\//g, '')
);

/* Copy postinstall hooks */
shell.cp(path.join(SRC_DIR, 'resources', 'postinstall*'), path.join(DIST_DIR, 'resources/'));

/* Copy Readme */
shell.cp(path.resolve('./README.md'), DIST_DIR);

/* Add shebang line to cli */
const cliPath = path.join(DIST_DIR, '/bin/cli.js');
const cliSrc = fs.readFileSync(cliPath, 'utf8');
fs.writeFileSync(cliPath, `#!/usr/bin/env node\n\n${cliSrc}`, 'utf8');

/* Ensure EOL = LF in resources */
const resFiles = glob.sync(path.join(DIST_DIR, 'resources', '*'));
shell.sed('-i', /\r+$/, '', resFiles);
