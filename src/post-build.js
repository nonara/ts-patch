const path = require("path");
const shell = require("shelljs");
const {runTasks} = require("../lib/helpers");
const { version } = require('../package.json');

const TSP_DIR = path.resolve('./lib/patch-files/ts-patch');


runTasks({
  'route imports': () => {
    // Route loader import statements to original
    shell.sed('-i',
      /(?<=(^import.+?)|(require\(.+?))typescript\/lib\/typescript/,
      'typescript/lib/typescript.original',
      path.join(TSP_DIR, 'loader.js')
    )
  },

  'add ts-patch version to patcher': () =>
    shell.sed('-i',
      /(?<=tspVersion\s*?=.+?)['"`].*?['"`](?=;)/,
      `\`v${version}\``,
      path.join(TSP_DIR, 'patcher.js')
    )
}, true);