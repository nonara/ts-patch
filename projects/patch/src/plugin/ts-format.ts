namespace tsp {
  /* ********************************************************* */
  // region: Types
  /* ********************************************************* */

  export type TsFileFormat = 'commonjs' | 'module' | 'unsupported';

  /** @internal */
  interface ImpliedNodeFormatInfo {
    impliedNodeFormat?: tsShim.ModuleKind;
    packageJsonLocations?: string[];
    packageJsonScope?: {
      contents?: {
        packageJsonContent?: {
          type?: string
        }
      }
    }
  }

  // endregion

  /* ********************************************************* */
  // region: Helpers
  /* ********************************************************* */

  function getCreateSourceFileOptions(
    filePath: string,
    compilerOptions: tsShim.CompilerOptions
  ): tsShim.CreateSourceFileOptions & Partial<ImpliedNodeFormatInfo> {
    const implied = tsShim.getImpliedNodeFormatForFileWorker(
      filePath,
      undefined,
      tsShim.sys,
      compilerOptions
    );

    return {
      ...(typeof implied === 'object' ? implied : { impliedNodeFormat: implied }),
      languageVersion: tsShim.getEmitScriptTarget(compilerOptions),
      setExternalModuleIndicator: tsShim.getSetExternalModuleIndicator(compilerOptions)
    };
  }

  function createFormatSourceFile(filePath: string, sourceText: string, compilerOptions: tsShim.CompilerOptions) {
    const sourceFileOptions = getCreateSourceFileOptions(filePath, compilerOptions);
    const sourceFile = tsShim.createSourceFile(filePath, sourceText, sourceFileOptions, false);
    const internalSourceFile = sourceFile as tsShim.SourceFile & Partial<ImpliedNodeFormatInfo>;

    internalSourceFile.packageJsonLocations = sourceFileOptions.packageJsonLocations;
    internalSourceFile.packageJsonScope = sourceFileOptions.packageJsonScope;

    return sourceFile;
  }

  // endregion

  /* ********************************************************* */
  // region: Utils
  /* ********************************************************* */

  export function getEmitFormat(
    filePath: string,
    sourceText: string,
    compilerOptions: tsShim.CompilerOptions
  ): TsFileFormat {
    const sourceFile = createFormatSourceFile(filePath, sourceText, compilerOptions);
    const emitKind = tsShim.getEmitModuleFormatOfFileWorker(sourceFile, compilerOptions);

    /*
     * This switch names the Node load format, not the user's exact TypeScript emit target.
     * Transformer source must be compiled to something Node can synchronously load. Known
     * non-Node module wrappers are rejected deliberately, while unknown future module kinds
     * are treated as ESM because new TypeScript module kinds are expected to extend modern
     * ES/Node behavior rather than add another AMD/System-like wrapper.
     */
    switch (emitKind) {
      case undefined:
        // getCompilerOptions() supplies NodeNext by default, so this should be unreachable.
        // If TypeScript still cannot decide, preserve the old non-ESM transformer fallback.
      case tsShim.ModuleKind.None:
        // Historically ts-patch forced TS transformer loading to CommonJS unless ESM was active.
        // Treat an explicit "None" module setting as that legacy CJS runtime fallback.
      case tsShim.ModuleKind.CommonJS:
        return 'commonjs';

      case tsShim.ModuleKind.AMD:
      case tsShim.ModuleKind.UMD:
      case tsShim.ModuleKind.System:
      case tsShim.ModuleKind.Preserve:
        return 'unsupported';

      case tsShim.ModuleKind.ES2015:
      case tsShim.ModuleKind.ES2020:
      case tsShim.ModuleKind.ES2022:
      case tsShim.ModuleKind.ESNext:
      default:
        return 'module';
    }
  }

  // endregion

}
