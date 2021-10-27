import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  testEnvironment: "node",
  preset: 'ts-jest',
  roots: [ '<rootDir>/test/tests' ],
  testRegex: '.*(test|spec)\\.tsx?$',
  moduleFileExtensions: [ 'ts', 'tsx', 'js', 'jsx', 'json', 'node' ],
  globals: {
    'ts-jest': {
      tsconfig: './test/tsconfig.json'
    }
  },
  modulePaths: [ "<rootDir>/node_modules" ],
  coveragePathIgnorePatterns: [
    'src/installer/lib/system/errors.ts$'
  ],
  globalSetup: './test/src/setup.ts',
  globalTeardown: './test/src/teardown.ts',
  testTimeout: 10000,
  transformIgnorePatterns: [
    '/node_modules/(?!(ts-transformer-keys|ts-transformer-enumerate|ts-nameof)/)'
  ]
}

export default config;
