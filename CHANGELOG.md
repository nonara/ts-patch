# Changelog

Notable changes are documented in this file.

Project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [1.2.0] (05-20-2020)

### Changed: `beforeEmit` -> `tranformProgram`

The mechanism of action for `Program` transformation has been moved from inside
`program.emit()` to `ts.createProgram()`. 

In the new methodology, the `Program` instance is transformed at the point of creation _before_ it is returned from the 
factory function, which is a far better approach.

While the option name has been updated for clarity, the old `beforeEmit` will still work, so this is not a breaking change.

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

[1.2.0]: https://github.com/nonara/ts-patch/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/nonara/ts-patch/compare/v1.0.10...v1.1.0
[1.0]: https://github.com/nonara/ts-patch/releases/tag/v1.0.0...v1.0.10
