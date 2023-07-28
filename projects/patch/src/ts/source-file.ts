
namespace tsp {

	/* ********************************************************* *
	 * Patched parseSourceFile()
	 * ********************************************************* */

	export function parseSourceFile(
		fileName: string,
		sourceText: string,
		languageVersion: tsShim.ScriptTarget,
		syntaxCursor: never | undefined,
		setParentNodes = false,
		scriptKind: tsShim.ScriptKind | undefined,
		setExternalModuleIndicatorOverride: ((file: tsShim.SourceFile) => void) | undefined,
		getCompilerOptions: () => tsShim.CompilerOptions
	): tsShim.SourceFile {
		const options = getCompilerOptions();
		const projectDir = getProjectDir(options)
		/* Get Config */

		/* Invoke TS createProgram */
		// @ts-ignore
		let file: tsShim.SourceFile = tsShim.originalParseSourceFile(fileName, sourceText, languageVersion, syntaxCursor, setParentNodes, scriptKind, setExternalModuleIndicatorOverride)

		// /* Prepare Plugins */
		const plugins = preparePluginsFromCompilerOptions(options.plugins);
		const pluginCreator = new PluginCreator(plugins, projectDir ?? process.cwd());

		/* Prevent recursion in Program transformers */
		const transformers = pluginCreator.createTransformers({ program: new Error("Program not available for single source file") as never })

		const transformed = tsShim.transform(file, transformers.before, options);
		transformed.dispose();

		return transformed.transformed[0]
	}
}
