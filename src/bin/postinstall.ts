#!/usr/bin/env node

import path from 'path';
import fs from 'fs';
import { getTSPackage } from '..';
import { patch } from '..';


/* ********************************************************************************************************************
 * App
 * ********************************************************************************************************************/

/* Read config file */
const tsPackage = getTSPackage();
const {config} = tsPackage;

/* Iterate and patch updated files */
for (let [filename, timestamp] of Object.entries(config.modules)) {
  const file = path.join(tsPackage.libDir, filename);
  if (<number>timestamp < fs.statSync(file).mtimeMs)
    try { patch(file, { silent: true }); } catch(e) { }
}