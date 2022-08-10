# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [2.0.1](https://github.com/nonara/ts-patch/compare/v1.4.5...v2.0.1) (2021-11-01)

### Bug Fixes

* Corrected path error in previous release ([7c56d56](https://github.com/nonara/ts-patch/commit/7c56d56b5165affb9c58a3c65c2753391f3e967a))

## [2.0.0](https://github.com/nonara/ts-patch/compare/v1.4.5...v2.0.0) (2021-11-01)


### Summary

This is not the planned rewrite, but the codebase was in desperate need of an update. The patch build system with rollup was failing with newer versions and was hacky under the best of circumstances, anyway. This new version has a proper custom build system that produces a much leaner patch. Additionally, I reorganized the codebase, improved tests, and dropped old TS support.

_Note: If you absolutely need it, it will still work with older TS. Simply fork and remove the version check_

### Changes

- Soft deprecated `--basedir` (use `--dir`)
- Zero bundled dependencies in patch (much lighter)
- ⚠️ Hard deprecated `--persist` option (use `package.json` -> `prepare` script)
- ⚠️ Requires TS >= 4.0

_(⚠️ denotes potential "breaking" change)_

### Development Changes

- Removed rollup and created light-weight custom build system
- Cleaned up file structure
- Improved test speed & methodology
- Changed patch detection signature

### [1.4.5](https://github.com/nonara/ts-patch/compare/v1.4.4...v1.4.5) (2021-10-25)


### Bug Fixes

* compilation fails if basedir resolves to cwd ([#65](https://github.com/nonara/ts-patch/issues/65)) ([9bac698](https://github.com/nonara/ts-patch/commit/9bac698993cd287de6d62caba48205bf53b4e52e))

### [1.4.4](https://github.com/nonara/ts-patch/compare/v1.4.3...v1.4.4) (2021-08-27)


### Bug Fixes

* `--basedir` flag fails if dir is not a subdir of a package ([5912288](https://github.com/nonara/ts-patch/commit/5912288f36f98a1722252d150a456c139e3f8382))

### [1.4.3](https://github.com/nonara/ts-patch/compare/v1.4.2...v1.4.3) (2021-08-23)


### Bug Fixes

* Relative transform paths do not resolve from project root dir with compiler API (fixes [#59](https://github.com/nonara/ts-patch/issues/59)) ([e38655a](https://github.com/nonara/ts-patch/commit/e38655ac20f3905e61bcf8bfc03b97a5386b76f8))
* ts 3.6.5 does not patch properly (fixes [#55](https://github.com/nonara/ts-patch/issues/55)) ([1babac9](https://github.com/nonara/ts-patch/commit/1babac9284d330983a9658794680a5058e7c64c0))

### [1.4.2](https://github.com/nonara/ts-patch/compare/v1.4.1...v1.4.2) (2021-08-01)


### Bug Fixes

* Patch fails on ts v3.1 - 3.5 (fixes [#54](https://github.com/nonara/ts-patch/issues/54)) ([0fabe3c](https://github.com/nonara/ts-patch/commit/0fabe3c85129357a6ad453e48739dd1759efe18d))

### [1.4.1](https://github.com/nonara/ts-patch/compare/v1.4.0...v1.4.1) (2021-07-13)


### Bug Fixes

* Only patch 'tsc.js' and 'typescript.js' by default (closes [#52](https://github.com/nonara/ts-patch/issues/52)) ([4d029f6](https://github.com/nonara/ts-patch/commit/4d029f666abdf5e2862c773eeba97eeddbb80089))

## [1.4.0](https://github.com/nonara/ts-patch/compare/v1.3.4...v1.4.0) (2021-07-13)


### Features

* Add tsserver.js to supported libraries ([08262ed](https://github.com/nonara/ts-patch/commit/08262ede07c6e69b178751013988da772661ef02))


### Bug Fixes

* Require ts-node installation to be handled by user (fixes [#51](https://github.com/nonara/ts-patch/issues/51)) ([979338c](https://github.com/nonara/ts-patch/commit/979338ca5f0642b233de46dd6d293daa7f552ac4))

### [1.3.4](https://github.com/nonara/ts-patch/compare/v1.3.3...v1.3.4) (2021-06-30)


### Bug Fixes

* Install adds ts-node to deps instead of devDeps (fixes [#38](https://github.com/nonara/ts-patch/issues/38)) ([a2d586b](https://github.com/nonara/ts-patch/commit/a2d586b286a4af0650faf69d3163115442aec8ab))

### [1.3.3](https://github.com/nonara/ts-patch/compare/v1.3.2...v1.3.3) (2021-04-23)


### Bug Fixes

* **patch:** Patched emit does not pass all arguments (fixes [#36](https://github.com/nonara/ts-patch/issues/36)) ([9b130bc](https://github.com/nonara/ts-patch/commit/9b130bc8fd1a5bf3e7b33f796990ed7383aa5449))

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
