import type { Config } from '@jest/types';
import * as os from 'os';

const config: Config.InitialOptions = {
  testEnvironment: "node",
  preset: 'ts-jest',
  roots: [ '<rootDir>/test/tests' ],
  testRegex: '.*(test|spec)\\.tsx?$',
  moduleFileExtensions: [ 'ts', 'tsx', 'js', 'jsx', 'json', 'node' ],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: './test/tsconfig.json' }],
  },
  modulePaths: [ "<rootDir>/node_modules" ],
  // coveragePathIgnorePatterns: [
  //   'src/installer/lib/system/errors.ts$'
  // ],
  globalSetup: '<rootDir>/test/src/prepare.ts',
  globalTeardown: '<rootDir>/test/src/cleanup.ts',
  testTimeout: 10000,
  transformIgnorePatterns: [
    '/node_modules/(?!(ts-transformer-keys|ts-transformer-enumerate|ts-nameof)/)'
  ],
  maxConcurrency: os.cpus().length
}

export default config;
