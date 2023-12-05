const path = require('path');


/* ****************************************************************************************************************** *
 * Helpers
 * ****************************************************************************************************************** */

function getTransformedFile(transformerKind) {
  process.env.TSP_SKIP_CACHE = true;
  const tsInstance = require('ts-patch/compiler');

  const configPath = path.join(__dirname, `tsconfig.${transformerKind}.json`);
  const configText = tsInstance.sys.readFile(configPath);
  const configParseResult = tsInstance.parseConfigFileTextToJson(configPath, configText);
  const config = configParseResult.config;

  config.compilerOptions.noEmit = false;
  config.compilerOptions.skipLibCheck = true;
  config.compilerOptions.outDir = 'dist';

  const emittedFiles = new Map();

  const writeFile = (fileName, content) => emittedFiles.set(fileName, content);

  const program = tsInstance.createProgram({
    rootNames: [ path.join(__dirname, 'src', 'index.ts') ],
    options: config.compilerOptions,
  });

  program.emit(undefined, writeFile);

  return emittedFiles.get('dist/index.js');
}


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

const args = process.argv.slice(2);
console.log(getTransformedFile(args[0]));
