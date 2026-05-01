const path = require('path');

function runCase(caseName) {
  process.env.TSP_SKIP_CACHE = true;
  const tsInstance = require('ts-patch/compiler');

  const configPath = path.join(__dirname, `tsconfig.${caseName}.json`);
  const configFile = tsInstance.readConfigFile(configPath, tsInstance.sys.readFile);
  if (configFile.error) throw new Error(tsInstance.formatDiagnostic(configFile.error, diagnosticHost(tsInstance)));

  const parsedConfig = tsInstance.parseJsonConfigFileContent(
    configFile.config,
    tsInstance.sys,
    __dirname,
    undefined,
    configPath
  );

  if (parsedConfig.errors.length) {
    throw new Error(tsInstance.formatDiagnostics(parsedConfig.errors, diagnosticHost(tsInstance)));
  }

  Object.assign(parsedConfig.options, {
    noEmit: false,
    skipLibCheck: true,
    outDir: 'dist',
  });

  const emittedFiles = new Map();
  const program = tsInstance.createProgram({
    rootNames: [ path.join(__dirname, 'src', 'index.ts') ],
    options: parsedConfig.options,
  });

  program.emit(undefined, (fileName, content) => emittedFiles.set(fileName, content));
  return emittedFiles.get('dist/index.js') || emittedFiles.get(path.join('dist', 'src', 'index.js'));
}

function diagnosticHost(tsInstance) {
  return {
    getCurrentDirectory: () => __dirname,
    getCanonicalFileName: fileName => fileName,
    getNewLine: () => tsInstance.sys.newLine,
  };
}

const caseName = process.argv[2];
if (!caseName) throw new Error('Missing case name');
console.log(runCase(caseName));
