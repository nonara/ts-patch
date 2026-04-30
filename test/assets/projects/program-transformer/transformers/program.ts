import path from 'path';
import type * as ts from 'typescript';
import type { PluginConfig, ProgramTransformerExtras } from 'ts-patch';

type State = {
  addOne: number;
  addTwo: number;
  recursive: number;
  addTwoSawAddOne: boolean;
  originalCreateProgramAvailable: boolean;
}

declare global {
  // eslint-disable-next-line no-var
  var __tspProgramTransformerState: State | undefined;
}

function getState(): State {
  return globalThis.__tspProgramTransformerState ??= {
    addOne: 0,
    addTwo: 0,
    recursive: 0,
    addTwoSawAddOne: false,
    originalCreateProgramAvailable: false
  };
}

function fixturePath(...parts: string[]) {
  return path.resolve(__dirname, '..', ...parts);
}

function addRoot(rootNames: readonly string[], filePath: string) {
  return rootNames.includes(filePath) ? rootNames.slice() : rootNames.concat(filePath);
}

function recreateProgram(
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  tsInstance: typeof ts,
  rootNames: readonly string[],
  createProgram: typeof ts.createProgram = tsInstance.originalCreateProgram
) {
  return createProgram(
    rootNames.slice(),
    program.getCompilerOptions(),
    host ?? tsInstance.createCompilerHost(program.getCompilerOptions()),
    program
  );
}

export function addOne(
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  _config: PluginConfig,
  { ts: tsInstance }: ProgramTransformerExtras
) {
  getState().addOne++;
  return recreateProgram(
    program,
    host,
    tsInstance,
    addRoot(program.getRootFileNames(), fixturePath('src', 'added-one.ts'))
  );
}

export function addTwo(
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  _config: PluginConfig,
  { ts: tsInstance }: ProgramTransformerExtras
) {
  const state = getState();
  state.addTwo++;
  state.addTwoSawAddOne = !!program.getSourceFile(fixturePath('src', 'added-one.ts'));
  if (!state.addTwoSawAddOne) throw new Error('addTwo did not receive the program produced by addOne');

  return recreateProgram(
    program,
    host,
    tsInstance,
    addRoot(program.getRootFileNames(), fixturePath('src', 'added-two.ts'))
  );
}

export function recursive(
  program: ts.Program,
  host: ts.CompilerHost | undefined,
  _config: PluginConfig,
  { ts: tsInstance }: ProgramTransformerExtras
) {
  const state = getState();
  state.recursive++;
  state.originalCreateProgramAvailable = typeof tsInstance.originalCreateProgram === 'function';

  if (state.recursive > 1) throw new Error('recursive program transformer re-entered');

  return recreateProgram(
    program,
    host,
    tsInstance,
    addRoot(program.getRootFileNames(), fixturePath('src', 'recursive-added.ts')),
    tsInstance.createProgram
  );
}
