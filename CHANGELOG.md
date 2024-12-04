# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [3.3.0](https://github.com/nonara/ts-patch/compare/v3.2.1...v3.3.0) (2024-12-04)


### Features

* Add support for ts 5.7+ (closes [#174](https://github.com/nonara/ts-patch/issues/174)) ([396766c](https://github.com/nonara/ts-patch/commit/396766c2e1dbe767a99c2cd277470d3731e87623))

### [3.2.1](https://github.com/nonara/ts-patch/compare/v3.2.0...v3.2.1) (2024-06-26)


### Bug Fixes

* Added TS 5.5.2 support ([31eb80f](https://github.com/nonara/ts-patch/commit/31eb80f1dcca45d15917e4b6621769f80e57ebe1))

## [3.2.0](https://github.com/nonara/ts-patch/compare/v3.1.2...v3.2.0) (2024-06-03)


### Features

* Added support for TS 5.5 ([2c4954d](https://github.com/nonara/ts-patch/commit/2c4954d91def5f0654804bfbf64704720f605840))

### [3.1.2](https://github.com/nonara/ts-patch/compare/v3.1.1...v3.1.2) (2024-01-10)


### Bug Fixes

* don't break if other plugin is added ([f2b591e](https://github.com/nonara/ts-patch/commit/f2b591e1a78636d009af048689f2ae1c0bb89bea))

### [3.1.1](https://github.com/nonara/ts-patch/compare/v3.1.0...v3.1.1) (2023-12-06)


### Bug Fixes

* parseAllJsDoc breaking with < ts 5.3 ([d21e02e](https://github.com/nonara/ts-patch/commit/d21e02ef6401f04301972f8f107799b8c287275b))

## [3.1.0](https://github.com/nonara/ts-patch/compare/v3.0.2...v3.1.0) (2023-12-05)


### Features

* Added Plugin Package Configuration + parseAllJsDoc (closes [#134](https://github.com/nonara/ts-patch/issues/134) closes [#133](https://github.com/nonara/ts-patch/issues/133)) ([15570d0](https://github.com/nonara/ts-patch/commit/15570d05e422dd02635eb3c63dc6b3a036cb543a))
* Added support for chaining transformers in single factory (closes [#122](https://github.com/nonara/ts-patch/issues/122) closes [#120](https://github.com/nonara/ts-patch/issues/120)) ([aabf389](https://github.com/nonara/ts-patch/commit/aabf3894a610047fade6d2d9fb9949f17afe09df))


### Bug Fixes

* TsExtras 'ts' type registering as 'any' (fixes [#127](https://github.com/nonara/ts-patch/issues/127)) ([069411e](https://github.com/nonara/ts-patch/commit/069411e49819aa87c880c7c5ff2ab04ecb68eea3))
* tsp.currentLibrary was not set (detail) ([24d8031](https://github.com/nonara/ts-patch/commit/24d8031bafcd6483fa762ed9ad8437c4a4070093))

### [3.0.2](https://github.com/nonara/ts-patch/compare/v3.0.1...v3.0.2) (2023-07-20)


### Bug Fixes

* Plugins returning TransformerBasePlugin not supported (fixes [#113](https://github.com/nonara/ts-patch/issues/113)) ([12ee3a2](https://github.com/nonara/ts-patch/commit/12ee3a23b9afebb6a42c046b33f257a2bde2467c))

### [3.0.1](https://github.com/nonara/ts-patch/compare/v3.0.0...v3.0.1) (2023-06-22)


### Bug Fixes

* Added explicit error if ts is patched and cached backup is removed ([ac25743](https://github.com/nonara/ts-patch/commit/ac25743140f8f3954aceb8c0e43a731eeeab03a1))
* ESM temp files not cleaned up ([8802054](https://github.com/nonara/ts-patch/commit/8802054481a9f2b4847001cb227db029e0475a72))
* Lock file deletion check ([#102](https://github.com/nonara/ts-patch/issues/102)) ([cacf908](https://github.com/nonara/ts-patch/commit/cacf9084fd4e5a2a1263103f8dc52d2dd7062402))

## [3.0.0](https://github.com/nonara/ts-patch/compare/v2.1.0...v3.0.0) (2023-06-13)


### ⚠ BREAKING CHANGES

* Rewrote for new major v3 (see detail) ([cd69c1c](https://github.com/nonara/ts-patch/commit/cd69c1c02b2e4674731178def7d217d5699bde25)), closes [#58](https://github.com/nonara/ts-patch/issues/58) [#75](https://github.com/nonara/ts-patch/issues/75) [#83](https://github.com/nonara/ts-patch/issues/83) [#93](https://github.com/nonara/ts-patch/issues/93) [#85](https://github.com/nonara/ts-patch/issues/85)

### Features

* Added Live Compiler (on-the-fly, in-memory patching), which allows ttypescript migration
* Added experimental ES Module support (closes #58)
* Added mutex locks (closes #75)
* Updated to support TS v5+ (closes #83 closes #93)
* Added caching

### Bug Fixes

* Fixed patching for non-standard libraries (cannot guarantee they will work as expected in IDEs) (closes #85)

## [2.1.0](https://github.com/nonara/ts-patch/compare/v2.0.2...v2.1.0) (2022-12-08)


### Features

* Updated to support TS 4.9 ([26f6099](https://github.com/nonara/ts-patch/commit/26f6099543d258a2a430f8344b482aba85ac9b0e))

### [2.0.2](https://github.com/nonara/ts-patch/compare/v2.0.1...v2.0.2) (2022-08-10)


### Changes

* Upgraded dependencies ([a878131](https://github.com/nonara/ts-patch/commit/a87813190eb31b918574509e4dfe4ef3b427b212))

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
