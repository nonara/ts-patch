/** @internal */
namespace tsp {
  declare const createProgram: typeof ts.createProgram;
  declare const originalCreateProgram: typeof ts.createProgram;
  declare const findConfigFile: typeof ts.findConfigFile;
  declare const readConfigFile: typeof ts.readConfigFile;
  declare const parseJsonConfigFileContent: typeof ts.parseJsonConfigFileContent;
  declare const sys: typeof ts.sys;

  export const shim = {
    get createProgram() { return ts.createProgram ?? createProgram },
    get originalCreateProgram() { return ts.originalCreateProgram ?? originalCreateProgram },
    get findConfigFile() { return ts.findConfigFile ?? findConfigFile },
    get readConfigFile() { return ts.readConfigFile ?? readConfigFile },
    get parseJsonConfigFileContent() { return ts.parseJsonConfigFileContent ?? parseJsonConfigFileContent },
    get sys() { return ts.sys ?? sys },
  }
}
