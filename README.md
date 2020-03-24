[![npm version](https://badge.fury.io/js/ts-patch.svg)](https://badge.fury.io/js/ts-patch)
[![Build Status](https://travis-ci.org/nonara/ts-patch.svg?branch=master)](https://travis-ci.org/nonara/ts-patch)
[![Coverage Status](https://coveralls.io/repos/github/nonara/ts-patch/badge.svg?branch=master)](https://coveralls.io/github/nonara/ts-patch?branch=master)

ts-patch
=======================================

## Description
ts-patch is a tool which patches typescript to allow custom transformers (plugins) to be specified in tsconfig.json.

Its logic is based on [ttypescript](https://github.com/cevek/ttypescript). (Credit and thanks to [cevek](https://github.com/cevek) for the excellent work!)

## Features
* Easy to patch or unpatch any version of typescript (2.7+)
* One step setup - no complicated install process
* Optionally, enable **persistence**, which re-patches typescript automatically if it is updated
* Advanced options for patching individual files, specific locations, etc. (see `ts-patch /?`)

## Installation
```
npm i -g ts-patch
```

## Patch
```
ts-patch install
```
For more options, use: ```ts-patch /?```

## Transformers Usage

### tsconfig.json

Add transformers to `compilerOptions` in `plugin` array:
```JSON
{
    "compilerOptions": {
        "plugins": [
            { "transform": "transformer-module" }
        ]
    }
}
```

### Plugin Options

* **transform** - path to transformer or module name
* **type** (optional) - Plugin entry point format (see below for options)
* **import** (optional) - Name of exported transform plugin in transformer module.
* **after** (optional) - Apply transformer after all others
* **afterDeclarations** (optional) - Apply transformer to d.ts files (supported in TypeScript 2.9+)
* _[custom options]_ - Supply additional options to transformer

_Note: `transform` can accept npm module or local file path (.ts or .js) relative to to `tsconfig.json` path_

### Plugin Types

#### program (default)
Factory signature (`program` as first argument):
```ts
(program: ts.Program, config: PluginConfig | undefined, helpers: { ts: typeof ts, addDiagnostic: (diag: ts.Diagnostic) => void }) => ts.TransformerFactory
where 
ts.TransformerFactory = (context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => ts.SourceFile
```
Config Example: `{ "transform": "transformer-module" }`.
_Note: `addDiagnostic()` can only add `Diagnostic` entries to `EmitResult.diagnostic` It cannot be used to alter semantic diagnostics_

#### config
Signature with transformer's config:
```ts
(config: PluginConfig) => ts.TransformerFactory
```
Config Example: `{ "transform": "transformer-module", type: "config" }`.

#### checker
Signature with ts.TypeChecker:
```ts
(checker: ts.TypeChecker, config?: PluginConfig) => ts.TransformerFactory
```
Config Example: `{ "transform": "transformer-module", type: "checker" }`.

#### raw
Signature without factory wrapper:
```ts
ts.TransformerFactory
```
Config Example: `{ "transform": "transformer-module", type: "raw" }`.

#### compilerOptions
```ts
(compilerOpts: ts.CompilerOptions, config?: PluginConfig) => ts.TransformerFactory
```
Config Example: `{ "transform": "transformer-module", type: "compilerOptions" }`.

### Examples
```json
{
    "compilerOptions": {
        "plugins": [
            { "transform": "transformer-module", "someOption1": 123, "someOption2": 321 },
            { "transform": "./transformers/my-transformer.ts" },
            { "transform": "transformer-module", "after": true },
            { "transform": "transformer-module", "afterDeclarations": true },
            { "transform": "transformer-module", "type": "ls" }
        ]
    }
}
```

## Transformers

You can write transformers in TypeScript or JavaScript

```ts
// transformer1-module
import * as ts from 'typescript';
export default function(program: ts.Program, pluginOptions: {}) {
    return (ctx: ts.TransformationContext) => {
        return (sourceFile: ts.SourceFile) => {
            function visitor(node: ts.Node): ts.Node {
                // if (ts.isCallExpression(node)) {
                //     return ts.createLiteral('call');
                // }
                return ts.visitEachChild(node, visitor, ctx);
            }
            return ts.visitEachChild(sourceFile, visitor, ctx);
        };
    };
}

```

### Example Transformers:

[`{ "transform": "ts-optchain/transform" }`](https://github.com/rimeto/ts-optchain) 

[`{transform: "typescript-is/lib/transform-inline/transformer"}`](https://github.com/woutervh-/typescript-is) 

[`{transform: "ts-transformer-keys/transformer"}`](https://github.com/kimamula/ts-transformer-keys) 

[`{transform: "ts-transformer-enumerate/transformer"}`](https://github.com/kimamula/ts-transformer-enumerate)

[`{transform: "ts-transform-graphql-tag/dist/transformer"}`](https://github.com/firede/ts-transform-graphql-tag) 

[`{transform: "ts-transform-img/dist/transform", type: "config"}`](https://github.com/longlho/ts-transform-img) 

[`{transform: "ts-transform-css-modules/dist/transform", type: "config"}`](https://github.com/longlho/ts-transform-css-modules) 

[`{transform: "ts-transform-react-intl/dist/transform", import: "transform", type: "config"}`](https://github.com/longlho/ts-transform-react-intl) 

[`{transform: "ts-nameof", type: "raw"}`](https://github.com/dsherret/ts-nameof) 

[`{transform: "typescript-transform-jsx" }`](https://github.com/LeDDGroup/typescript-transform-jsx) 

[`{transform: "typescript-transform-paths" }`](https://github.com/LeDDGroup/typescript-transform-paths) 

[`{transform: "typescript-transform-macros" }`](https://github.com/LeDDGroup/typescript-transform-macros) 

[`{transform: "ts-transformer-minify-privates" }`](https://github.com/timocov/ts-transformer-minify-privates) 

[`{transform: "typescript-plugin-styled-components", type: "config"}`](https://github.com/Igorbek/typescript-plugin-styled-components#ttypescript-compiler)

[`{ "transform": "@zoltu/typescript-transformer-append-js-extension" }`](https://github.com/Zoltu/typescript-transformer-append-js-extension)

### Helpful Links
* [How to Write a TypeScript Transform (Plugin)](https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943)
* [Creating a TypeScript Transformer](https://43081j.com/2018/08/creating-a-typescript-transform?source=post_page-----731e2b0b66e6----------------------)

### Authors

* [Ron S.](https://twitter.com/Ron)
* [cevek](https://github.com/cevek) 

### License

This project is licensed under the MIT License
