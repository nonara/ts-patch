# Changelog

Notable changes are documented in this file.

Project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## [1.0.4] - 2019-10-31

### Fixed
- Edge cases occurred in which TypeScript based transformers using CommonJS were not being interpretted properly. 
  _(Should address [issue #1](https://github.com/nonara/ts-patch/issues/1))_

## [1.0.3] - 2019-10-31

### Added
- Added changelog file

### Changed
- Updated rewire implementation in tests (broken with Node 13)
- Locked Rollup to version 1.25.2 (Awaiting fix for [rollup-plugin-dts issue #64](https://github.com/Swatinem/rollup-plugin-dts/issues/64))

## [1.0.2] - 2019-10-15

### Changed 
- Refactored patch tests to use package TS version

## [1.0.1] - 2019-10-15

### Fixed
- Corrected a few docstring / comments for accuracy
- Set license to MIT

## [1.0.0] - 2019-10-14

- Initial project release

[1.0.4]: https://github.com/nonara/ts-patch/compare/v1.0.3...v1.0.4
[1.0.3]: https://github.com/nonara/ts-patch/compare/v1.0.2...v1.0.3
[1.0.2]: https://github.com/nonara/ts-patch/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/nonara/ts-patch/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/nonara/ts-patch/releases/tag/v1.0.0