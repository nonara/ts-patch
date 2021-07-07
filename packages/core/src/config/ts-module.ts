import { PartialSome } from '@crosstype/common'
import * as module from 'module';


/* ****************************************************************************************************************** */
// region: Types & Defaults
/* ****************************************************************************************************************** */

export enum TsLibrary {
  TypeScript = 'typescript',
  TsServerLibrary = 'tsserverlibrary',
  TsServer = 'tsserver',
  TSC = 'tsc',
  TypeScriptServices = 'typescriptServices',
}

export interface TsModule extends TsModuleBase {
  /**
   * TypeScript module name or path
   *
   * @configurable
   * @example
   * 'typescript' // Use node resolution to resolve path for typescript module
   *
   * './node_modules/typescript' // Specific path to typescript
   */
  module: string

  /**
   * Assign a custom name for patched module
   *
   * Using the same module name as `module` will allow you to expropriate the name. TSP will rename the original
   * to @ts-patch/base-[module_name].
   *
   * Note: Does not apply if 'module' is a direct path
   *
   * @configurable
   * @example
   * // The following will cause ./node_modules/typescript to point to our patched version
   * // and the packaged typescript will be installed as @ts-patch/base-typescript
   * {
   *   "tsModule": {
   *     "module": "typescript",
   *     "patchedModuleName": "typescript"
   *   }
   * }
   *
   * @default @ts-patch/patched-[module_name] or undefined if `module` is a direct path
   */
  patchedModuleName: string | undefined

  /**
   * True if `module` is a resolvable module instead of a direct path
   * @internal
   */
  isPackageModule: boolean

  /**
   * Specific name of module (undefined if isPackageModule = false)
   * @internal
   */
  moduleName: string | undefined
}

export interface TsModuleBase {
  /**
   * Which libraries to patch (typescript, tsserverlibrary, tsc, typescriptServices, tsserver)
   *
   * @configurable
   * @default [ 'tsc' ]
   */
  libraries: `${TsLibrary}`

  /**
   * Optionally, override the core patch applied to the module (module name or relative path)
   * Note: This is for advanced users only! You probably do not need to use this.
   *
   * @configurable
   * @default '@ts-patch/patch-core'
   */
  corePatch: string

  /**
   * Override the `bin` section of package.json for patched module
   *
   * @configurable
   * @example
   * {
   *   // Links 'ptsc' and 'ptsserver' instead of defaults
   *   "binLinks": {
   *     "ptsc": "./bin/tsc",
   *     "ptsserver": "./bin/tsserver",
   *   }
   * }
   */
  binLinks?: Record<string, string>

  /**
   * Optionally, override cache module path
   * @configurable
   */
  cacheDir?: string
}

export namespace TsModule {
  export type Configurable = PartialSome<TsModule, keyof ReturnType<typeof getDefaults>>
  export const getDefaults = (isPackageModule: boolean, module: string) => ({
    ...TsModuleBase.getDefaults(),
    patchedModuleName: !isPackageModule ? void 0 : `@ts-patch/patched-${module}`,
  })
}

export namespace TsModuleBase {
  export type Configurable = PartialSome<TsModuleBase, keyof ReturnType<typeof getDefaults>>
  export const getDefaults = () => ({
    corePatch: '@ts-patch/patch-core',
    libraries: [ TsLibrary.TSC ]
  })
}

// endregion


/* ****************************************************************************************************************** */
// region: Utilities
/* ****************************************************************************************************************** */

export function createTsModule(config: TsModule.Configurable): TsModule {
  // TODO - Make this work
  const isPackageModule = true;

  // Merge options with defaults
  const res: TsModule = Object.assign({}, TsModule.getDefaults(isPackageModule, config.module), config);

  return Object.assign(res, {
    isPackageModule,
    moduleName: (isPackageModule && res.module === res.patchedModuleName) ? `@ts-patch/base-${module}` :
                !isPackageModule ? void 0 :
                module
  });
}

// endregion
