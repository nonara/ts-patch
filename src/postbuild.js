#!/usr/bin/env node
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

const DIST_DIR = path.resolve('./dist');
const SRC_DIR = path.resolve('./src');
const BASE_DIR = path.resolve('.');


/* ********************************************************************************************************************
 * Post-Build Steps
 * ********************************************************************************************************************/

/* Build package.json */
const pkgJSON = JSON.parse(fs.readFileSync(path.join(BASE_DIR, 'package.json'), 'utf8'));
delete pkgJSON.scripts;
delete pkgJSON.devDependencies;
fs.writeFileSync(
  path.join(DIST_DIR, 'package.json'),
  JSON.stringify(pkgJSON, null, 2).replace(/(?<=['"].*?)dist\//g, '')
);

/* Copy postinstall hooks */
shell.cp(path.join(SRC_DIR, 'resources', 'postinstall*'), path.join(DIST_DIR, 'resources/'));

// TODO - Copy config dir (holds travis config, etc) & README