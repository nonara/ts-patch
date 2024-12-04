const path = require('path');
const semver = require('semver');


/* ****************************************************************************************************************** *
 * Helpers
 * ****************************************************************************************************************** */

function getTransformedFile(transformerKind) {
  process.env.TSP_SKIP_CACHE = true;
  const tsInstance = require('ts-patch/compiler');

  console.log(`'TS version: ${tsInstance.version}\nNode Version: ${process.version.slice(1)}`);

  const configPath = path.join(__dirname, `tsconfig.${transformerKind}.json`);
  const configText = tsInstance.sys.readFile(configPath);

  /* Parse config */
  let compilerOptions;
  if (semver.lt(tsInstance.version, '5.5.0', { includePrerelease: false })) {
    const configParseResult = tsInstance.parseConfigFileTextToJson(configPath, configText);
    compilerOptions = configParseResult.config.compilerOptions;
  } else {
    const configSourceFile = tsInstance.createSourceFile(configPath, configText, tsInstance.ScriptTarget.Latest);
    const configParseResult = tsInstance.parseJsonSourceFileConfigFileContent(configSourceFile, tsInstance.sys, path.dirname(configPath), undefined, configPath);
    compilerOptions = configParseResult.options;
  }

  /* Overwrite options */
  Object.assign(compilerOptions, {
    noEmit: false,
    skipLibCheck: true,
    outDir: 'dist',
  });

  const emittedFiles = new Map();

  const writeFile = (fileName, content) => emittedFiles.set(fileName, content);

  const program = tsInstance.createProgram({
    rootNames: [ path.join(__dirname, 'src', 'index.ts') ],
    options: compilerOptions,
  });

  program.emit(undefined, writeFile);

  return emittedFiles.get('dist/index.js');
}


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

const args = process.argv.slice(2);
console.log(getTransformedFile(args[0]));
