[![npm version](https://badge.fury.io/js/ts-patch.svg)](https://badge.fury.io/js/ts-patch)
[![NPM Downloads](https://img.shields.io/npm/dm/ts-patch.svg?style=flat)](https://npmjs.org/package/ts-patch)
![Build Status](https://github.com/nonara/ts-patch/workflows/Build/badge.svg)

# ts-patch

Patch typescript to allow custom transformers (plugins) during build.

Plugins are specified in `tsconfig.json`, or provided programmatically in `CompilerOptions`.

_Migrating from ttypescript is easy! See: [Method 1: Live Compiler](#method-1-live-compiler)_

## Features

* Patch typescript installation via on-the-fly, in-memory patching _or_ as a persistent patch
* Can patch individual libraries (see `ts-patch /?`)
* Hook build process by transforming the `Program` (see: [Transforming Program](#transforming-program))
* Add, remove, or modify diagnostics (see: [Altering Diagnostics](#altering-diagnostics))
* Fully compatible with legacy [ttypescript](https://github.com/cevek/ttypescript) projects
* **(new)** Experimental support for ES Module based transformers

# Table of Contents

<!-- TOC -->
* [ts-patch](#ts-patch)
  * [Features](#features)
* [Table of Contents](#table-of-contents)
* [Installation](#installation)
* [Usage](#usage)
  * [Method 1: Live Compiler](#method-1-live-compiler)
  * [Method 2: Persistent Patch](#method-2-persistent-patch)
* [Configuration](#configuration)
  * [Plugin Options](#plugin-options)
* [Writing Transformers](#writing-transformers)
  * [Source Transformers](#source-transformers)
    * [Source Transformer Entry Point](#source-transformer-entry-point)
    * [Source Transformer Example](#source-transformer-example)
    * [Altering Diagnostics](#altering-diagnostics)
    * [Note](#note)
  * [Program Transformers](#program-transformers)
    * [Program Transformer Entry Point](#program-transformer-entry-point)
    * [Configuring Program Transformers](#configuring-program-transformers)
    * [Program Transformer Example](#program-transformer-example)
  * [Plugin Package Configuration](#plugin-package-configuration)
    * [Example](#example)
  * [Resources](#resources)
    * [Recommended Reading](#recommended-reading)
    * [Recommended Tools](#recommended-tools)
    * [Discussion](#discussion)
* [Advanced Options](#advanced-options)
* [Maintainers](#maintainers)
  * [Help Wanted](#help-wanted)
* [License](#license)
<!-- TOC -->

# Installation

1. Install package
```sh
<yarn|npm|pnpm> add -D ts-patch
```

# Usage

## Method 1: Live Compiler

The live compiler patches on-the-fly, each time it is run.

**Via commandline:** Simply use `tspc` (instead of `tsc`)

**With tools such as ts-node, webpack, ts-jest, etc:** specify the compiler as  `ts-patch/compiler`

## Method 2: Persistent Patch

Persistent patch modifies the typescript installation within the node_modules path. It requires additional configuration
to remain persisted, but it carries less load time and complexity compared to the live compiler.

1. Install the patch

```shell
# For advanced options, see: ts-patch /?
ts-patch install
```

2. Add `prepare` script (keeps patch persisted after npm install)

`package.json`
 ```jsonc
{
  /* ... */
  "scripts": {
    "prepare": "ts-patch install -s"
  }
}
 ```

# Configuration

**tsconfig.json**: Add transformers to `compilerOptions` in `plugins` array.

**Examples**
```jsonc
{
    "compilerOptions": {
        "plugins": [
            // Source Transformers
            { "transform": "transformer-module" },
            { "transform": "transformer2", "extraOption": 123 },
            { "transform": "trans-with-mapping", "resolvePathAliases": true },
            { "transform": "esm-transformer", "isEsm": true },

            // Program Transformer
            { "transform": "transformer-module5", "transformProgram": true }
        ]
    }
}
```

## Plugin Options

| Option             | Type    | Description                                                                                                   |
|--------------------|---------|:--------------------------------------------------------------------------------------------------------------|
| **transform**      | string  | Module name or path to transformer _(*.ts or *.js)_                                                           |
| after              | boolean | Apply transformer after stock TS transformers                                                                 |
| afterDeclarations  | boolean | Apply transformer to declaration (*.d.ts) files                                                               |
| transformProgram   | boolean | Transform `Program` during `ts.createProgram()` _(see: [Program Transformers](#program-transformers))_        |
| isEsm              | boolean | Transformer is ES Module (_note: experimental_ — requires [esm](https://www.npmjs.com/package/esm))           |
| resolvePathAliases | boolean | Resolve path aliases in transformer (requires [tsconfig-paths](https://www.npmjs.com/package/tsconfig-paths)) |
| type               | string  | See: [Source Transformer Entry Point](#source-transformer-entry-point) (default: 'program')                   |
| import             | string  | Name of exported transformer function _(defaults to `default` export)_                                        |
| tsConfig           | string  | tsconfig.json file _for transformer_ (allows specifying compileOptions, path mapping support, etc)            |
| _..._              |         | Provide your own custom options, which will be passed to the transformer                                      |

_Note: Required options are bold_

# Writing Transformers

For an overview of the typescript compiler (such as what a `SourceFile` and `Program` is) see: [Typescript Compiler Notes](https://github.com/microsoft/TypeScript-Compiler-Notes).

## Source Transformers

Source Transformers will transform the AST of SourceFiles during compilation, allowing you to alter the output of the JS or declarations files.

### Source Transformer Entry Point

```ts
(program: ts.Program, config: PluginConfig, extras: TransformerExtras) => ts.TransformerFactory
```

**PluginConfig**: [Type Declaration](https://github.com/nonara/ts-patch/blob/master/projects/core/shared/plugin-types.ts)  
**TransformerExtras**: [Type Declaration](https://github.com/nonara/ts-patch/blob/master/projects/core/shared/plugin-types.ts)  
**ts.TransformerFactory**: `(context: ts.TransformationContext) => (sourceFile: ts.SourceFile) => ts.SourceFile`

_Note: Additional [legacy signatures](https://github.com/cevek/ttypescript#pluginconfigtype) are supported, but it is not recommended to develop a new transformer using them._

### Source Transformer Example

Transformers can be written in JS or TS.

```ts
import type * as ts from 'typescript';
import type { TransformerExtras, PluginConfig } from 'ts-patch';

/** Changes string literal 'before' to 'after' */
export default function (program: ts.Program, pluginConfig: PluginConfig, { ts: tsInstance }: TransformerExtras) {
  return (ctx: ts.TransformationContext) => {
    const { factory } = ctx;
    
    return (sourceFile: ts.SourceFile) => {
      function visit(node: ts.Node): ts.Node {
        if (tsInstance.isStringLiteral(node) && node.text === 'before') {
          return factory.createStringLiteral('after');
        }
        return tsInstance.visitEachChild(node, visit, ctx);
      }
      return tsInstance.visitNode(sourceFile, visit);
    };
  };
}

```

**Live Examples**:

[`{ transform: "typescript-transform-paths" }`](https://github.com/LeDDGroup/typescript-transform-paths)

[`{ transform: "typescript-is/lib/transform-inline/transformer" }`](https://github.com/woutervh-/typescript-is)

[`{ transform: "typia/lib/transform" }`](https://github.com/samchon/typia) ([💻playground](https://typia.io/playground))

[`{ transform: "@nestia/core/lib/transform" }`](https://github.com/samchon/nestia)

### Altering Diagnostics

Diagnostics can be altered in a Source Transformer.

To alter diagnostics you can use the following, provided from the `TransformerExtras` parameter:

| property           | description                                         |
|--------------------|-----------------------------------------------------|
| diagnostics        | Reference to `Diagnostic` array                     |   
| addDiagnostic()    | Safely add `Diagnostic` to `diagnostics` array      |
| removeDiagnostic() | Safely remove `Diagnostic` from `diagnostics` array | 

### Note

_This alters diagnostics during _emit only_. If you want to alter diagnostics in your IDE as well, you'll need to create a LanguageService plugin to accompany your source transformer_

## Program Transformers

Sometimes you want to do more than just transform source code. For example you may want to:

- TypeCheck code after it's been transformed
- Generate code and add it to the program
- Add or remove emit files during transformation

For this, we've introduced what we call a Program Transformer. The transform action takes place during `ts.createProgram`, and allows
re-creating the `Program` instance that typescript uses.

### Program Transformer Entry Point

```ts
(program: ts.Program, host: ts.CompilerHost | undefined, options: PluginConfig, extras: ProgramTransformerExtras) => ts.Program
```

**ProgramTransformerExtras** >>> [Type Declaration](https://github.com/nonara/ts-patch/blob/master/projects/core/shared/plugin-types.ts)

### Configuring Program Transformers

To configure a Program Transformer, supply `"transformProgram": true` in the config transformer entry.

_Note: The `before`, `after`, and `afterDeclarations` options do not apply to a Program Transformer and will be ignored_

[See Config Example](#configuration)

### Program Transformer Example
```TypeScript
/** 
 * Add a file to Program
 */
import * as path from 'path';
import type * as ts from 'typescript';
import type { ProgramTransformerExtras, PluginConfig } from 'ts-patch';

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

**Live Examples**:

[`{ transform: "@typescript-virtual-barrel/compiler-plugin", transformProgram: true }`](https://github.com/zaguiini/typescript-virtual-barrel)

[`{ transform: "ts-overrides-plugin", transformProgram: true }`](https://github.com/DiFuks/ts-overrides-plugin)

## Plugin Package Configuration

The plugin package configuration allows you to specify custom options for your TypeScript plugin. 
This configuration is defined in the `package.json` of your plugin under the `tsp` property.

An example use case is enabling `parseAllJsDoc` if you require full JSDoc parsing in tsc for your transformer in TS v5.3+. (see: [5.3 JSDoc parsing changes](https://devblogs.microsoft.com/typescript/announcing-typescript-5-3/#optimizations-by-skipping-jsdoc-parsing))

For all available options, see the `PluginPackageConfig` type in [plugin-types.ts](https://github.com/nonara/ts-patch/blob/master/projects/core/shared/plugin-types.ts)

### Example

```jsonc
{
  "name": "your-plugin-name",
  "version": "1.0.0",
  "tsp": {
    "tscOptions": {
      "parseAllJsDoc": true
    }
  }
}
```

## Resources

### Recommended Reading

- How-To: [Advice for working with the TS Compiler API](https://github.com/nonara/ts-patch/discussions/31)
- How-To: [TypeScript Transformer Handbook](https://github.com/madou/typescript-transformer-handbook)
- Article: [How to Write a TypeScript Transform (Plugin)](https://dev.doctorevidence.com/how-to-write-a-typescript-transform-plugin-fc5308fdd943)
- Article: [Creating a TypeScript Transformer](https://43081j.com/2018/08/creating-a-typescript-transform?source=post_page-----731e2b0b66e6----------------------)

### Recommended Tools

| Tool                                                                 | Type        | Description                                                                                 |
|----------------------------------------------------------------------|-------------|---------------------------------------------------------------------------------------------|
| [TS AST Viewer](https://ts-ast-viewer.com/)                          | Web App     | Allows you to see the `Node` structure and other TS properties of your source code.         |
| [ts-expose-internals](https://github.com/nonara/ts-expose-internals) | NPM Package | Exposes internal types and methods of the TS compiler API                                   |

### Discussion

- `#compiler-internals-and-api` on [TypeScript Discord Server](https://discord.com/invite/typescript)
- TSP [Discussions](https://github.com/nonara/ts-patch/discussions) Board

# Advanced Options

**(env) `TSP_SKIP_CACHE`**

Skips patch cache when patching via cli or live compiler.

**(env) `TSP_COMPILER_TS_PATH`**

Specify typescript library path to use for `ts-patch/compiler` (defaults to `require.resolve('typescript')`)

**(env) `TSP_CACHE_DIR`**

Override patch cache directory

**(cli) `ts-patch clear-cache`**

Cleans patch cache & lockfiles

# Maintainers

<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tr>
    <td align="center"><a href="https://github.com/nonara"><img src="https://avatars0.githubusercontent.com/u/1427565?v=4" width="100px;" alt=""/><br /><sub><b>Ron S.</b></sub></a></td>
  </tr>
</table>

## Help Wanted

If you're interested in helping and are knowledgeable with the TS compiler codebase, feel free to reach out!

# License

This project is licensed under the MIT License, as described in `LICENSE.md`
