[![npm version](https://badge.fury.io/js/ts-patch.svg)](https://badge.fury.io/js/ts-patch)
![Build Status](https://github.com/nonara/ts-patch/workflows/Build%20(CI)/badge.svg)
[![Coverage Status](https://coveralls.io/repos/github/nonara/ts-patch/badge.svg?branch=master)](https://coveralls.io/github/nonara/ts-patch?branch=master)

# TS Patch

Directly patch typescript installation to allow custom transformers (plugins).  

- Plugins are specified in `tsconfig.json`, or provided programmatically in `CompilerOptions`.
- Logic based on [ttypescript](https://github.com/cevek/ttypescript) - 100% compatibility with `ttypescript` configuration + transformers.

## Features
* Easy to patch or unpatch any version of typescript (2.7+)
* One step setup - no complicated install process
* Optionally, enable **persistence**, which re-patches typescript automatically if it is updated
* Advanced options for patching individual files, specific locations, etc. (see `ts-patch /?`)
* _(New)_ Supports 'transforming' the `Program` instance during creation. (see: [Transforming Program](#transforming-program))
* _(New)_ Add, remove, or modify diagnostics! (see: [Altering Diagnostics](#altering-diagnostics))

## Installation
```
$ npm i ts-patch -D
$ ts-patch install
```
For more options, use: ```ts-patch /?```

## Table of Contents
  - [Configuring](#configuring)
      - [tsconfig.json](#tsconfigjson)
      - [Plugin Options](#plugin-options)
      - [Source Transformer Signatures](#source-transformer-signatures)
  - [Usage](#usage)
      - [Transforming AST Nodes](#transforming-ast-nodes)
          - [Example Node Transformers](#example-node-transformers)
      - [Transforming Program](#transforming-program)
          - [Example Program Transformer](#example-program-transformer)
      - [Altering Diagnostics](#altering-diagnostics)  
  - [Resources](#resources)
      - [Recommended Reading](#recommended-reading)
      - [Recommended Tools](#recommended-tools)
  - [Credit](#credit)
  - [HALP!!!](#halp)
  - [License](#license)
  
## Configuring
### tsconfig.json

Add transformers to `compilerOptions` in `plugins` array.  

**Examples**
```jsonc
{
    "compilerOptions": {
        "plugins": [
            // Source Transformer -> 'type' defaults to 'program'
            { "transform": "transformer-module", "someOption1": 123, "someOption2": 321 },

            // Source Transformer -> program signature 
            { "transform": "./transformers/my-transformer.ts", "type": "program" },

            // Source Transformer -> program signature, applies after TS transformers
            { "transform": "transformer-module1", "type": "config", "after": true },

            // Source Transformer -> checker signature, applies to TS declarations
            { "transform": "transformer-module2", "type": "checker", "afterDeclarations": true }, 
            
            // Source Transformer -> raw signature
            { "transform": "transformer-module3", "type": "raw" },

            // Source Transformer -> compilerOptions signature 
            { "transform": "transformer-module4", "type": "compilerOptions" },

            // Program Transformer -> Only has one signature - notice no type specified, because it does not apply
            { "transform": "transformer-module5", "transformProgram": true }
        ]
    }
}
```

### Plugin Options
| Option            | Type    | Description |
| ------------------| ------- | :----------- |
| **transform**     | string  | Module name or path to transformer _(*.ts or *.js)_ |
| type              | string  | *Source Transformer* entry point signature _(see: [Source Transformer Signatures](#source-transformer-signatures))_ |
| import            | string  | Name of exported transformer function _(defaults to `default` export)_ |
| tsConfig          | string  | tsconfig.json file _for transformer_ (allows specifying compileOptions, path mapping support, etc) |
| after             | boolean | Apply transformer after stock TS transformers. |
| afterDeclarations | boolean | Apply transformer to declaration (*.d.ts) files _(TypeScript 2.9+)_. |
| transformProgram  | boolean | Transform `Program` during `ts.createProgram()` _(see: [Transforming Program](#transforming-program))_ |
| _..._             |         | Provide your own custom options, which will be passed to the transformer |

_Note: Required options are bold_

### Source Transformer Signatures
The following are the possible values for the `type` option and their corresponding entry point signatures.  
_Note: These apply to Source Transformers only._

#### program (default)

Signature with `ts.Program` instance:
```ts
(program: ts.Program, config: PluginConfig, extras: TransformerExtras) => ts.TransformerFactory
```

_ts.TransformerFactory_ >>> `(context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => ts.SourceFile`  
_TransformerExtras_ >>> [See Type Declaration](https://github.com/nonara/ts-patch/blob/master/src/installer/plugin-types.ts#L76)  

_Note: This is *not* the configuration for a [Program Transformer](#transforming-program)._

#### config
Signature with transformer's config:
```ts
(config: PluginConfig) => ts.TransformerFactory
```

#### checker
Signature with `ts.TypeChecker`:
```ts
(checker: ts.TypeChecker, config: PluginConfig) => ts.TransformerFactory
```

#### raw
Signature without `ts-patch` wrapper:
```ts
/* ts.TransformerFactory */ 
(context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => ts.SourceFile
```

#### compilerOptions
```ts
(compilerOpts: ts.CompilerOptions, config: PluginConfig) => ts.TransformerFactory
```

## Usage
### Transforming AST Nodes

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

#### Example Node Transformers

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

### Transforming Program

There are some cases where a transformer isn't enough. Several examples are if you want to:

- TypeCheck code after it's been transformed
- Add or remove emit files during transformation

For this, we've introduced what we call a Program Transformer. The transform action takes place during `ts.createProgram`, and allows
re-creating the `Program` instance that typescript uses.

#### Configuring Program Transformer

To configure a Program Transformer, supply `"transformProgram": true` in the config transformer entry.

_Note: The `type`, `before`, and `after` options do not apply to a Program Transformer and will be ignored_

[See Config Example](#tsconfigjson)

#### Signature

There is only one possible signature for a Program Transformer entry point.

```TS
(program: ts.Program, host: ts.CompilerHost | undefined, options: PluginConfig, extras: ProgramTransformerExtras) => ts.Program
```

_ProgramTransformerExtras_ >>> [See Type Declaration](https://github.com/nonara/ts-patch/blob/master/src/installer/plugin-types.ts#L90)  

#### Example Program Transformer
```TypeScript
/** 
 * Add a file to Program
 */
import * as ts from 'typescript';
import * as path from 'path';
import { ProgramTransformerExtras, PluginConfig } from 'ts-patch';

export const newFile = path.resolve(__dirname, 'added-file.ts');

export default function (
  program: ts.Program, 
  host: ts.CompilerHost | undefined, 
  options: PluginConfig, 
  { ts: tsInstance }: ProgramTransformerExtras
) {
  return tsInstance.createProgram(
    /* rootNames */ program.getRootFileNames().concat([ newFile ]),
    program.getCompilerOptions(),
    host,
    /* oldProgram */ program
  );
}
```

**Note:** For a more complete example, see [Transforming Program with additional AST transformations](https://github.com/nonara/ts-patch/discussions/29#discussioncomment-325979)

### Altering Diagnostics

Diagnostics can be altered in a Source Transformer.

To alter diagnostics, use the [program type signature](#program-default), and use the following properties from the 
`TransformerExtras` parameter

| property | description |
| -------- |----------- |
| diagnostics | Reference to `Diagnostic[]` created during `ts.emitFilesAndReportErrors()` (works with tsc also)
| addDiagnostic() | Directly add `Diagnostic` to `diagnostics` array |
| removeDiagnostic() | Directly remove `Diagnostic` from `diagnostics` array (uses splice, for safe removal)

#### Notes
- This alters diagnostics during _emit only_. If you want to alter diagnostics in your IDE, create a LanguageService plugin
- If an emit method other than `ts.emitFilesAndReportErrors()` is used, any diagnostics added via `addDiagnostic()` 
will still be merged into the result of `program.emit() -> diagnostics`


## Resources

### Recommended Reading

- [Advice for working with the TS Compiler API](https://github.com/nonara/ts-patch/discussions/31) (**must read**)
- [TypeScript Transformer Handbook](https://github.com/madou/typescript-transformer-handbook) (**must read**)
- Article: [How to Write a TypeScript Transform (Plugin)](https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943)
- Article: [Creating a TypeScript Transformer](https://43081j.com/2018/08/creating-a-typescript-transform?source=post_page-----731e2b0b66e6----------------------)

### Recommended Tools

| Tool | Type | Description |
| ---- | ---- | ----------- |
| [TS AST Viewer](https://ts-ast-viewer.com/) | Website | Allows you to see the `Node` structure of any TS/JS source, including Flags, `Type`, and `Symbol`. This is the go-to tool for all things TypeScript AST.
| [ts-query](https://www.npmjs.com/package/@phenomnomnominal/tsquery) | NPM Package |  Perform fast CSS-like queries on AST to find specific nodes (by attribute, kind, name, etc)
| [ts-query Playground](https://tsquery-playground.firebaseapp.com/) | Website | Test `ts-query` in realtime
| [ts-expose-internals](https://github.com/nonara/ts-expose-internals) | NPM Package | Exposes internal types and methods of the TS compiler API 

## Credit
| Author                |  Module |
| --------------------- |  ----------- |
| [Ron S.](https://twitter.com/Ron) | [ts-patch](https://github.com/nonara/ts-patch/) |
| [cevek](https://github.com/cevek) | [ttypescript](https://github.com/cevek/ttypescript) |

## HALP!!!

- If you're new to this sort of thing, please be sure to go through the [Recommended Reading](#recommended-reading).
- A good place to ask questions is [StackOverflow](https://stackoverflow.com/questions/tagged/typescript-compiler-api) (with the `#typescript-compiler-api` tag).
- Read the handbook and still stuck? [Ask in Discussions](https://github.com/nonara/ts-patch/discussions), and I or someone else may help when they have some time!
- Check out the `#compiler` room on the [TypeScript Discord Server](https://discord.com/invite/typescript).

## License

This project is licensed under the MIT License
