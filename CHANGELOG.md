# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.3.2](https://github.com/nonara/ts-patch/compare/v1.3.1...v1.3.2) (2021-01-31)

## [1.3.1] (11-25-2020)

### Fixed
- Fixed #21 (Could not specify `--basedir` with dir name other than `typescript` - affected yarn aliasing)

## [1.3.0] (07-26-2020)

### Added
- Added ability to specify tsconfig.json file for transformer (`tsConfig` option)
  Note: This opens up the door to specify compilerOptions, which can be useful
- Added path mapping support (requires [tsconfig-paths](https://npmjs.com/tsconfig-paths))

## [1.2.2] (05-23-2020)

### Fixed
- Possible recursion issue with program transformer
- In some older TS versions, tsc wasn't passing diagnostics array
- Various CLI bugs

### Added
- Added 'library' to TspExtras
- install and patch actions now will proceed to run if already patched but current version is out-dated

### Code
- Substantial re-design of certain parts (see release commit message for more)

## [1.2.0] (05-20-2020)

### Changed: `beforeEmit` -> `tranformProgram`

The mechanism of action for `Program` transformation has been moved from inside
`program.emit()` to `ts.createProgram()`. 

In the new methodology, the `Program` instance is transformed at the point of creation _before_ it is returned from the 
factory function, which is a far better approach.

While the option name has been updated to reflect the new behaviour, the old `beforeEmit` can still function as an alias
to the new behaviour, so this is not a breaking change.

### Added: Inspect or alter diagnostics

Using the `program` type entry point, the `extras` field has been revised.

 | property | status | description |
 | -------- | ------ | ----------- |
 | diagnostics | _new_ | Reference to `Diagnostic[]` created during `ts.emitFilesAndReportErrors()` (works with tsc also)
 | addDiagnostic | _changed_ | Directly add `Diagnostic` to `diagnostics` array |
 | removeDiagnostic | _new_ | Directly remove `Diagnostic` from `diagnostics` array (uses splice, for safe removal)
 
See `README.md` for full detail.

## [1.1.0] (05-08-2020)

### Added
- Added `beforeEmit` option, which allows 'transforming' `Program` instance before `program.emit()` is called.

## [1.0] (2019 - 2020)

### Fixed
- Updated for Node v14
  _(Addresses [#7](https://github.com/nonara/ts-patch/issues/8), [shelljs/shelljs#991](https://github.com/shelljs/shelljs/issues/991))_  
- Adjusted ts-node compilerOptions to ES2018
  _(Fixes [#7](https://github.com/nonara/ts-patch/issues/7))_  
- Exposed & fixed `addDiagnostic` helper
  _(Fixes [#6](https://github.com/nonara/ts-patch/issues/6))_
- Rolled `resolve` package into patch
  _(Fixes [#5](https://github.com/nonara/ts-patch/issues/5))_
- Converted EOL to LF (MacOS support)
  _(Fixes [#3](https://github.com/nonara/ts-patch/issues/3) [#4](https://github.com/nonara/ts-patch/issues/4))_
- Edge cases occurred in which TypeScript based transformers using CommonJS were not being interpretted properly. 
  _(Should address [issue #1](https://github.com/nonara/ts-patch/issues/1))_

[1.3.1]: https://github.com/nonara/ts-patch/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/nonara/ts-patch/compare/v1.2.2...v1.3.0
[1.2.2]: https://github.com/nonara/ts-patch/compare/v1.1.0...v1.2.2
[1.2.0]: https://github.com/nonara/ts-patch/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/nonara/ts-patch/compare/v1.0.10...v1.1.0
[1.0]: https://github.com/nonara/ts-patch/releases/tag/v1.0.0...v1.0.10
