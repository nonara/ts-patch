const path = require('path');

process.env.TSP_SKIP_CACHE = true;
const tsInstance = require('ts-patch/compiler');

const caseName = process.argv[2];
if (!caseName) throw new Error('Missing case name');

globalThis.__tspProgramTransformerState = undefined;

const configPath = path.join(__dirname, `tsconfig.${caseName}.json`);
const parsedConfig = getParsedConfig(configPath);
const program = tsInstance.createProgram({
  rootNames: parsedConfig.fileNames,
  options: parsedConfig.options,
});

const result = {
  addedOne: hasSourceFile(program, 'src/added-one.ts'),
  addedTwo: hasSourceFile(program, 'src/added-two.ts'),
  recursiveAdded: hasSourceFile(program, 'src/recursive-added.ts'),
  state: globalThis.__tspProgramTransformerState
};

process.stdout.write(JSON.stringify(result, null, 2));

function hasSourceFile(program, relativePath) {
  return !!program.getSourceFile(path.resolve(__dirname, relativePath));
}

function getParsedConfig(configPath) {
  const configFile = tsInstance.readConfigFile(configPath, tsInstance.sys.readFile);
  if (configFile.error) throw new Error(tsInstance.formatDiagnostic(configFile.error, diagnosticHost()));

  const parsedConfig = tsInstance.parseJsonConfigFileContent(
    configFile.config,
    tsInstance.sys,
    __dirname,
    undefined,
    configPath
  );
  if (parsedConfig.errors.length) throw new Error(tsInstance.formatDiagnostics(parsedConfig.errors, diagnosticHost()));

  return parsedConfig;
}

function diagnosticHost() {
  return {
    getCurrentDirectory: () => __dirname,
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => tsInstance.sys.newLine,
  };
}
