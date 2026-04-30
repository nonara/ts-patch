const path = require('path');

process.env.TSP_SKIP_CACHE = true;
const tsInstance = require('ts-patch/compiler');

const configPath = path.join(__dirname, 'tsconfig.cts.json');
const parsedConfig = getParsedConfig(configPath);

const result = tsInstance.transpileModule('const a = "before";', {
  compilerOptions: parsedConfig.options,
});

process.stdout.write(result.outputText);

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
