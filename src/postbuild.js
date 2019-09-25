#!/usr/bin/env node
const shell = require('shelljs');
const path = require('path');
const fs = require('fs');
const { tsquery } = require('@phenomnomnominal/tsquery');


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

const BASE_DIR = path.resolve('.');
const SRC_DIR = path.resolve('./src');
const DIST_DIR = path.resolve('./dist');
const PATCH_DIR = path.join(SRC_DIR, 'patch');


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

/* Build module-patch.d.ts */
const ast = tsquery.ast(fs.readFileSync(path.join(PATCH_DIR, 'types.ts'), 'utf8'));
const selected = tsquery.query(ast, `SourceFile > ModuleDeclaration:has(Identifier[name='ts'])`);

fs.writeFileSync(
  path.join(pkgJSON.directories.resources, 'module-patch.d.ts'),
  selected.map(({ pos,end }) => ast.text.slice(pos,end)).join('\r\n')
);

/* Copy postinstall hooks */
shell.cp(path.join(SRC_DIR, 'resources', 'postinstall*'), path.join(DIST_DIR, 'resources/'));


// TODO - Copy config dir (holds travis config, etc) & README