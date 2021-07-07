import { TsModule, TsModuleBase } from './ts-module'
import { OneOrMore, PartialSome } from '@crosstype/common';
import * as path from 'path';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface TspConfig {
  /**
   * Override location for `.tsp` directory (stores cache, etc)
   *
   * @configurable
   * @default './tsp'
   */
  tspDir: string

  /**
   * TypeScript Modules
   *
   * @configurable
   * @default { "module": "typescript" }
   */
  tsModule: OneOrMore<TsModule.Configurable>

  /**
   * Base config for typescript modules (applies as root config for all modules in tsModule)
   *
   * @configurable
   */
  baseModuleConfig?: TsModuleBase.Configurable

  /**
   * Manually specify npm client used for package management (otherwise, attempts to auto-detect)
   *
   * @configurable
   */
  npmClient?: 'yarn' | 'npm' | 'pnpm'

  /**
   * @internal
   */
  userConfig: undefined | {
    configFile: string | undefined
    data: TspConfig.Configurable
  }
}

export namespace TspConfig {
  export type Configurable = PartialSome<Omit<TspConfig, 'userConfig'>, keyof ReturnType<typeof getDefaults>>
  export const getDefaults = () => ({
    tsModule: { 'module': 'typescript' },
    tspDir: './tsp'
  });
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function createTspConfig(config?: TspConfig.Configurable, configFilePath?: string): TspConfig {
  const res = Object.assign({}, TspConfig.getDefaults(), config);

  // Resolve dir
  return Object.assign(res, {
    tspDir: path.resolve(res.tspDir),
    userConfig: config && {
      configFile: configFilePath,
      data: config
    }
  });
}

// endregion

