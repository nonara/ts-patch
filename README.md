[comment]: <> ([![npm version]&#40;https://badge.fury.io/js/ts-patch.svg&#41;]&#40;https://badge.fury.io/js/ts-patch&#41;)

[comment]: <> (![Build Status]&#40;https://github.com/nonara/ts-patch/workflows/Build%20&#40;CI&#41;/badge.svg&#41;)

[comment]: <> ([![Coverage Status]&#40;https://coveralls.io/repos/github/nonara/ts-patch/badge.svg?branch=master&#41;]&#40;https://coveralls.io/github/nonara/ts-patch?branch=master&#41;)

# TS Patch

Augment the TypeScript compiler to support extended functionality via extension packages. Extensions can be comprised of
any number of patches, transformers, and language service plugins.

## ⚠ v2+ Changes ⚠

v2 has been _completely rewritten_ to afford a faster, more complete plugin architecture for the TypeScript ecosystem. 

The following are the pertinent highlights in the differences between the two:

- Installation and patch methods are entirely new 
- Configuration is new, however v2 supports the transformer packages and config patterns of both v1 and [ttypescript](https://github.com/cevek/ttypescript)
- Many improvements and features have been added

**Note:** v1 will be in maintenance mode until at least January, 2023

## Pre-release Notice

The code for v2 is currently under development and subject to change until a release candidate is presented.

## Installation

### 1. Add dev dependency
```sh
# Yarn
yarn add -D ts-patch

# NPM
npm i -D ts-patch
```

### 2. Add prepare script
Add `tsp` to `prepare` lifecycle script (this ensures patches and config remain applied after new dependencies installed)

`package.json`
```jsonc
{
  // ...
  "scripts": {
    "prepare": "tsp"
  }
}
```

## Table of Contents

[comment]: <> (  - []&#40;#&#41;)
[comment]: <> (      - []&#40;#&#41;)
  - [License](#license)
  
## License

This project is licensed under the MIT License
