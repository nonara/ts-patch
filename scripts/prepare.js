const fs = require('fs');
const path = require('path');
const shell = require('shelljs');

/* Install TS versions for testing and copy relevant files */
const tsProjectsDir = path.resolve(__dirname, '../test/assets/ts');
for (const dir of shell.ls('-d', path.join(tsProjectsDir, '*'))) {
  if (fs.existsSync(path.resolve(tsProjectsDir, dir, 'node_modules'))) continue;
  shell.exec('yarn install', { cwd: path.resolve(tsProjectsDir, dir) })
}
