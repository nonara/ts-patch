const { compilerOptions } = require('./tsconfig');

module.exports = {
  testEnvironment: "node",
  preset: 'ts-jest',
  testRegex: '.*(test|spec)\\.tsx?$',
  moduleFileExtensions: [ 'ts', 'tsx', 'js', 'jsx', 'json', 'node' ],
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/test/tsconfig.json'
    }
  },
  modulePaths: [ "<rootDir>" ],
  testTimeout: 10000,
  roots: [ '<rootDir>' ],
}
