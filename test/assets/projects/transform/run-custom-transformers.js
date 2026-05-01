const path = require('path');

process.env.TSP_SKIP_CACHE = true;
const tsInstance = require('ts-patch/compiler');

const configPath = path.join(__dirname, 'tsconfig.cts.json');
const parsedConfig = getParsedConfig(configPath);

Object.assign(parsedConfig.options, {
  noEmit: false,
  skipLibCheck: true,
  outDir: 'dist',
});

const program = tsInstance.createProgram({
  rootNames: [ path.join(__dirname, 'src', 'index.ts') ],
  options: parsedConfig.options,
});

const emittedFiles = new Map();
program.emit(
  undefined,
  (fileName, content) => emittedFiles.set(fileName, content),
  undefined,
  false,
  { before: [ customTransformer ] }
);

process.stdout.write(emittedFiles.get('dist/index.js') || emittedFiles.get(path.join('dist', 'src', 'index.js')) || '');

function customTransformer(ctx) {
  const { factory } = ctx;

  function visit(node) {
    if (tsInstance.isStringLiteral(node) && node.text === 'after-cts') {
      return factory.createStringLiteral('after-custom');
    }

    return tsInstance.visitEachChild(node, visit, ctx);
  }

  return sourceFile => tsInstance.visitNode(sourceFile, visit);
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
