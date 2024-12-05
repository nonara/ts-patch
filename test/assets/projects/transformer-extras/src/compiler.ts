const path = require('path');

(() => {
  const tsInstance = require('ts-patch/compiler');

  const configPath = path.join(process.cwd(), `tsconfig.json`);
  const configText = tsInstance.sys.readFile(configPath);
  const configParseResult = tsInstance.parseConfigFileTextToJson(configPath, configText);
  const config = configParseResult.config;

  config.compilerOptions.noEmit = false;
  config.compilerOptions.skipLibCheck = true;
  config.compilerOptions.outDir = 'dist';

  const sourceFilePath = path.join(__dirname, 'index.ts');
  const program = tsInstance.createProgram({
    rootNames: [ sourceFilePath ],
    options: config.compilerOptions,
  });

  const emitResult = program.emit();
  const sourceFile = program.getSourceFile(sourceFilePath);
  const semanticDiagnostics = program.getSemanticDiagnostics(sourceFile);

  process.stdout.write(`emitResultDiagnostics:${diagnosticsToJsonString(emitResult.diagnostics)}\n`);
  process.stdout.write(`semanticDiagnostics:${diagnosticsToJsonString(semanticDiagnostics)}\n`);
})();

function diagnosticsToJsonString(diagnostics): string {
  return JSON.stringify(diagnostics.map(diagnostic => {
    const { file, start, length, messageText, category, code } = diagnostic;
    return { file: file.fileName, start, length, messageText, category, code };
  }));
}
