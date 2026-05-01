import Module from 'module';
import path from 'path';
import { runInThisContext } from 'vm';
import { getLiveModule, getLiveTypeScriptPackage } from './get-live-module';
import { getTsModule, TsModule } from './ts-module';


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function runLiveShim(moduleName: TsModule.Name, parentModule: NodeJS.Module) {
  const libraryName = String(moduleName).replace(/\.js$/, '');
  const tsPackage = getLiveTypeScriptPackage();
  const tsModule = getTsModule(tsPackage, moduleName);

  switch (moduleName) {
    case 'tsserver.js':
    case 'tsserverlibrary.js':
      return evaluateModule(
        tsModule.getUnpatchedModuleFile().content,
        parentModule,
        tsModule.moduleContentFilePath,
        createPatchedRequire(tsPackage.libDir, libraryName, tsModule.moduleContentFilePath)
      );

    case 'tsc.js':
    case 'typescript.js': {
      const { js } = getLiveModule(moduleName, { libraryName });
      return evaluateModule(
        js,
        parentModule,
        tsModule.moduleContentFilePath,
        createPatchedRequire(tsPackage.libDir, libraryName, tsModule.moduleContentFilePath)
      );
    }

    default:
      throw new Error(`Unknown live TypeScript module: ${moduleName}`);
  }
}

function createPatchedRequire(libDir: string, libraryName: string, fromFile: string) {
  const nativeRequire = Module.createRequire(fromFile);

  const patchedRequire = ((request: string) => {
    const resolved = nativeRequire.resolve(request);

    if (isTsLibFile(resolved, libDir, 'typescript.js')) {
      return requirePatchedModule('typescript.js', libraryName, resolved);
    }

    if (isTsLibFile(resolved, libDir, '_tsc.js')) {
      return requirePatchedModule('tsc.js', libraryName, resolved);
    }

    return nativeRequire(request);
  }) as NodeJS.Require;

  patchedRequire.resolve = nativeRequire.resolve;
  patchedRequire.cache = nativeRequire.cache;
  patchedRequire.extensions = nativeRequire.extensions;
  patchedRequire.main = nativeRequire.main;

  return patchedRequire;
}

function requirePatchedModule(moduleName: TsModule.Name, libraryName: string, resolvedPath: string) {
  const syntheticModule = new Module(resolvedPath, module) as NodeJS.Module;
  syntheticModule.filename = resolvedPath;
  syntheticModule.paths = (Module as any)._nodeModulePaths(path.dirname(resolvedPath));

  const localRequire = createPatchedRequire(path.dirname(resolvedPath), libraryName, resolvedPath);
  syntheticModule.require = localRequire;

  const { js } = getLiveModule(moduleName, { libraryName });
  evaluateModule(js, syntheticModule, resolvedPath, localRequire);

  return syntheticModule.exports;
}

function isTsLibFile(resolvedPath: string, libDir: string, fileName: string) {
  return path.resolve(resolvedPath) === path.resolve(libDir, fileName);
}

function evaluateModule(code: string, targetModule: NodeJS.Module, filePath: string, localRequire: NodeJS.Require) {
  const script = runInThisContext(`
    (function (exports, require, module, __filename, __dirname) {
      ${code}
    });
  `, { filename: filePath });

  return script.call(
    targetModule.exports,
    targetModule.exports,
    localRequire,
    targetModule,
    filePath,
    path.dirname(filePath)
  );
}

// endregion
