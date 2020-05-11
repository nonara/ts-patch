[![npm version](https://badge.fury.io/js/ts-patch.svg)](https://badge.fury.io/js/ts-patch)
[![Build Status](https://travis-ci.org/nonara/ts-patch.svg?branch=master)](https://travis-ci.org/nonara/ts-patch)
[![Coverage Status](https://coveralls.io/repos/github/nonara/ts-patch/badge.svg?branch=master)](https://coveralls.io/github/nonara/ts-patch?branch=master)

ts-patch
=======================================

## Description
ts-patch is a tool which directly patches a typescript installation to allow custom transformers (plugins). Plugins are specified in `tsconfig.json`, or provided programmatically in `CompilerOptions`.

It now also supports 'transforming' the `Program` instance prior to emit. See [Transforming Program](#transforming-program) for more info!

Logic based on [ttypescript](https://github.com/cevek/ttypescript). It is also fully compatible. 
(Credit and thanks to [cevek](https://github.com/cevek) for the excellent work!)

## Features
* Easy to patch or unpatch any version of typescript (2.7+)
* One step setup - no complicated install process
* Optionally, enable **persistence**, which re-patches typescript automatically if it is updated
* Advanced options for patching individual files, specific locations, etc. (see `ts-patch /?`)
* Can transform `Program` instance used for emit

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
| Option                | Description |
| --------------------- |  :----------- |
| **transform**         | Module name or path to transformer _(*.ts or *.js)_ |
| type              | Plugin entry point format _(see [Plugin Types](#plugin-types))_ |
| import            | Name of exported transformer function _(defaults to `default` export)_ |
| after             | Apply transformer after stock TS transformers. |
| afterDeclarations | Apply transformer to declaration (*.d.ts) files _(TypeScript 2.9+)_. |
| beforeEmit        | Transform `Program` before `program.emit()` is called _(See [Transforming Program](#transforming-program))_ |
| _..._    |  Provide your own custom options, which will be passed to the transformer |

_Note: Required options are bold_

### Plugin Types

#### program (default)
Factory signature (`program` as first argument):
```ts
(program: ts.Program, config: PluginConfig | undefined, helpers: { ts: typeof ts, addDiagnostic: (diag: ts.Diagnostic) => void }) => ts.TransformerFactory
// ts.TransformerFactory = (context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => ts.SourceFile
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
            { "transform": "transformer-module1", "after": true },
            { "transform": "transformer-module2", "afterDeclarations": true },
            { "transform": "transformer-module3", "type": "ls" },
            { "transform": "transformer-module4", "beforeEmit": true }
        ]
    }
}
```

## Transforming Program

There are some cases where a transformer isn't enough. Some of the biggest examples are if you're trying to:

- TypeCheck code after it's been transformed
- Add or remove emit files during transformation

In order to do this, you'd normally have to create a custom build tool which manually creates `Program` and manipulates 
or re-creates it as you need.

The good news is, you can now integrate this into standard tsc behaviour via a `beforeEmit` plugin.

### Export Signature

`(program: ts.Program, host?: ts.CompilerHost, options?: PluginConfig) => ts.Program`

### Notes

- A Program transformer is not a TS transformer. The signature does not change, so the `type` config option is ignored!
- The `before` and `after` config options also do not apply if `beforeEmit: true` is specified

### Example
```TypeScript
/** 
 * Add a file to Program
 */
import * as ts from 'typescript';
import * as path from 'path';

export const newFile = path.resolve(__dirname, 'added-file.ts');

export default function (program: ts.Program, host?: ts.CompilerHost) {
  return ts.createProgram(
    /* rootNames */ program.getRootFileNames().concat([ newFile ]),
    program.getCompilerOptions(),
    host,
    /* oldProgram */ program
  );
}
```


## Transformers

Transformers can be written in JS or TS.

```ts
// transformer1-module
import * as ts from 'typescript';
export default function(program: ts.Program, pluginOptions: any) {
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

### Recommended Reading

- [TypeScript Transformer Handbook](https://github.com/madou/typescript-transformer-handbook) (**must read**, whether new or experienced)
- Article: [How to Write a TypeScript Transform (Plugin)](https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943)
- Article: [Creating a TypeScript Transformer](https://43081j.com/2018/08/creating-a-typescript-transform?source=post_page-----731e2b0b66e6----------------------)

### Recommended Tools

| Tool | Type | Description |
| ---- | ---- | ----------- |
| [TS AST Viewer](https://ts-ast-viewer.com/) | Website | Allows you to see the `Node` structure of any TS/JS source, including Flags, `Type`, and `Symbol`. This is the go-to tool for all things TypeScript AST.
| [ts-query](https://www.npmjs.com/package/@phenomnomnominal/tsquery) | NPM Module |  Perform fast CSS-like queries on AST to find specific nodes (by attribute, kind, name, etc)
| [ts-query Playground](https://tsquery-playground.firebaseapp.com/) | Website | Test `ts-query` in realtime

### Example Transformers:

[`{ transform: "typescript-is/lib/transform-inline/transformer" }`](https://github.com/woutervh-/typescript-is) 

[`{ transform: "ts-transformer-keys/transformer" }`](https://github.com/kimamula/ts-transformer-keys) 

[`{ transform: "ts-transformer-enumerate/transformer" }`](https://github.com/kimamula/ts-transformer-enumerate)

[`{ transform: "ts-transform-graphql-tag/dist/transformer" }`](https://github.com/firede/ts-transform-graphql-tag) 

[`{ transform: "ts-transform-img/dist/transform", type: "config" }`](https://github.com/longlho/ts-transform-img) 

[`{ transform: "ts-transform-css-modules/dist/transform", type: "config" }`](https://github.com/longlho/ts-transform-css-modules) 

[`{ transform: "ts-transform-react-intl/dist/transform", import: "transform", type: "config" }`](https://github.com/longlho/ts-transform-react-intl) 

[`{ transform: "ts-nameof", type: "raw" }`](https://github.com/dsherret/ts-nameof) 

[`{ transform: "typescript-transform-jsx" }`](https://github.com/LeDDGroup/typescript-transform-jsx) 

[`{ transform: "typescript-transform-paths" }`](https://github.com/LeDDGroup/typescript-transform-paths) 

[`{ transform: "typescript-transform-macros" }`](https://github.com/LeDDGroup/typescript-transform-macros) 

[`{ transform: "ts-transformer-minify-privates" }`](https://github.com/timocov/ts-transformer-minify-privates) 

[`{ transform: "typescript-plugin-styled-components", type: "config" }`](https://github.com/Igorbek/typescript-plugin-styled-components#ttypescript-compiler)

### Credit

* [Ron S.](https://twitter.com/Ron) `ts-patch`
* [cevek](https://github.com/cevek) `ttypescript`

### HALP!!!

If you understand the basics but get stuck, feel free to ask a question in Issues. I'll flag it as a usage question, and I (or a kind soul) will do what we can to answer!

If you're new to this sort of thing, please be sure to go through the [Recommended Reading](#recommended-reading) before posting.

### License

This project is licensed under the MIT License
