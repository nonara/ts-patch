module.exports = {
  testEnvironment: "node",
  preset: 'ts-jest',
  roots: [ './test' ],
  testRegex: '.*(test|spec)\\.tsx?$',
  moduleFileExtensions: [ 'ts', 'tsx', 'js', 'jsx', 'json', 'node' ],
  globals: {
    'ts-jest': {
      tsconfig: './test/tsconfig.json'
    }
  },
  modulePaths: [ "<rootDir>/node_modules" ],
  collectCoverageFrom: [
    'src/installer/**/*.ts',
    'src/patch/lib/plugin.ts'
  ],
  coveragePathIgnorePatterns: [
    'src/installer/lib/system/errors.ts$'
  ],

  testTimeout: 10000
}
