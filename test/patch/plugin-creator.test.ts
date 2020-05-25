import { PluginConfig, TransformerList } from '../../src/installer';
import { PluginCreator } from '../../src/patch/lib/plugin';
import { advancedTransformer } from '../assets/transformers/transform-advanced';
import { simpleTransformer } from '../assets/transformers/transform-simple';
import { progTransformer1, progTransformer2 } from '../assets/transformers/program-transformer';
import * as ts from 'typescript';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

function createTransformers(config: PluginConfig[]): TransformerList
{
  const pluginCreator = new PluginCreator(config, __dirname);
  const host = { program: {} as ts.Program };
  return pluginCreator.createTransformers(host);
}


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`PluginCreator class`, () => {
  beforeAll(() => (<any>globalThis).ts = require('typescript'));
  afterAll(() => delete (<any>globalThis)['ts']);

  test('should be initialized with empty config', () => {
    const pluginCreator = new PluginCreator([]);
    expect(pluginCreator).toBeInstanceOf(PluginCreator);
  });

  test('should throw error if wrong config entry given', () => {
    const config = [ { someGarbage: 123 } ] as any;
    expect(() => new PluginCreator(config)).toThrow();
  });

  test('should initialize default transformer in before group', () => {
    const config: PluginConfig[] = [ { transform: '../assets/transformers/transform-simple.ts' } ];
    expect(createTransformers(config)).toEqual({
      after: [],
      afterDeclarations: [],
      before: [ simpleTransformer ],
    });
  });

  test('should initialize default transformer in after group', () => {
    const config: PluginConfig[] = [ { transform: '../assets/transformers/transform-simple.ts', after: true } ];
    expect(createTransformers(config)).toEqual({
      after: [ simpleTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  test('should initialize advanced transformer in after group', () => {
    const config: PluginConfig[] = [ { transform: '../assets/transformers/transform-advanced.ts' } ];
    expect(createTransformers(config)).toEqual({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  test('should provide custom config', () => {
    const config: PluginConfig[] = [ { transform: '../assets/transformers/transform-advanced.ts', some: 1, bla: 2 } as any ];
    expect(createTransformers(config)).toEqual({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  test('should initialize Program transformers', () => {
    const config: PluginConfig[] = [
      { transform: '../assets/transformers/program-transformer.ts', transformProgram: true, import: 'progTransformer1' },
      { transform: '../assets/transformers/program-transformer.ts', beforeEmit: true, import: 'progTransformer2' }
    ];

    const programTransformers = new Map(new PluginCreator(config, __dirname).getProgramTransformers());
    expect(programTransformers.get(progTransformer1)).toEqual(config[0]);
    expect(programTransformers.get(progTransformer2)).toEqual(config[1]);
  });
});
