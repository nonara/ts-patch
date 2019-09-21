#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { getTSPackage } from '..';
import { patch } from '..';


/* ********************************************************************************************************************
 * App
 * ********************************************************************************************************************/

/* Read config file */
const {config, libDir, packageDir} = getTSPackage(path.resolve(path.dirname(process.argv[1]), '../../'));

if (!config.persist) process.exit();

/* Iterate and patch updated files */
for (let [filename, timestamp] of Object.entries(config.modules)) {
  const file = path.join(libDir, filename);
  if (<number>timestamp < fs.statSync(file).mtimeMs) {
    try { patch(file, { silent: true, basedir: packageDir }) }
    catch (e) { }
  }
}