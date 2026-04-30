const path = require('path');

process.env.TSP_SKIP_CACHE = true;
const tsInstance = require('ts-patch/compiler');

const configPath = path.join(__dirname, 'tsconfig.json');
const configFile = tsInstance.readConfigFile(configPath, tsInstance.sys.readFile);
if (configFile.error) throw new Error(formatDiagnostic(configFile.error));

const parsedConfig = tsInstance.parseJsonConfigFileContent(
  configFile.config,
  tsInstance.sys,
  __dirname,
  undefined,
  configPath
);
if (parsedConfig.errors.length) throw new Error(formatDiagnostics(parsedConfig.errors));

const program = tsInstance.createProgram({
  rootNames: parsedConfig.fileNames,
  options: parsedConfig.options,
});

const result = program.emit();
const diagnostics = result.diagnostics.map(({ code, messageText }) => ({
  code,
  message: tsInstance.flattenDiagnosticMessageText(messageText, '\n')
}));

process.stdout.write(JSON.stringify(diagnostics, null, 2));

function formatDiagnostic(diagnostic) {
  return tsInstance.formatDiagnostic(diagnostic, diagnosticHost());
}

function formatDiagnostics(diagnostics) {
  return tsInstance.formatDiagnostics(diagnostics, diagnosticHost());
}

function diagnosticHost() {
  return {
    getCurrentDirectory: () => __dirname,
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => tsInstance.sys.newLine,
  };
}
