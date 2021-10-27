import type { PluginConfig, TransformerList } from '../../../src/shared/plugin-types';
import { advancedTransformer } from '../../assets/transformers/transform-advanced';
import { simpleTransformer } from '../../assets/transformers/transform-simple';
import { progTransformer1, progTransformer2 } from '../../assets/transformers/program-transformer';
import type TS from 'typescript';
import path from 'path';
import { assetsDir, tmpDir } from '../../src/config';

/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

function createTransformers(PluginCreator: any, config: PluginConfig[]): TransformerList
{
  const pluginCreator = new PluginCreator(config, __dirname);
  const host = { program: {} as TS.Program };
  return pluginCreator.createTransformers(host);
}

const getAsset = (p: string) => path.join(assetsDir, p);

/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

describe(`PluginCreator class`, () => {
  const ts = require(path.join(tmpDir, 'ts-latest'));
  const { PluginCreator } = ts;

  test('PluginCreator initializes', () => {
    const pluginCreator = new PluginCreator([]);
    expect(pluginCreator).toBeInstanceOf(PluginCreator);
  });

  test('Throws with bad config', () => {
    const config = [ { someGarbage: 123 } ] as any;
    expect(() => new PluginCreator(config)).toThrow();
  });

  test('Initializes before transformer ', () => {
    const config: PluginConfig[] = [ { transform: getAsset('transformers/transform-simple.ts') } ];
    expect(createTransformers(PluginCreator, config)).toEqual({
      after: [],
      afterDeclarations: [],
      before: [ simpleTransformer ],
    });
  });

  test('Initializes after transformer', () => {
    const config: PluginConfig[] = [ { transform: getAsset('transformers/transform-simple.ts'), after: true } ];
    expect(createTransformers(PluginCreator, config)).toEqual({
      after: [ simpleTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  test('Initialize advanced after transformer', () => {
    const config: PluginConfig[] = [ { transform: getAsset('transformers/transform-advanced.ts') } ];
    expect(createTransformers(PluginCreator, config)).toEqual({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  test('Works with custom config', () => {
    const config: PluginConfig[] = [ { transform: getAsset('transformers/transform-advanced.ts'), some: 1, bla: 2 } as any ];
    expect(createTransformers(PluginCreator, config)).toEqual({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  test('Initializes Program transformers', () => {
    const config: PluginConfig[] = [
      { transform: getAsset('transformers/program-transformer.ts'), transformProgram: true, import: 'progTransformer1' },
      { transform: getAsset('transformers/program-transformer.ts'), beforeEmit: true, import: 'progTransformer2' }
    ];

    const programTransformers = new Map(new PluginCreator(config, __dirname).getProgramTransformers());
    expect(programTransformers.get(progTransformer1)).toEqual(config[0]);
    expect(programTransformers.get(progTransformer2)).toEqual(config[1]);
  });
});
