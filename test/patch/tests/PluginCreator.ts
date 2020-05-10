import { expect } from 'chai';
import { PluginConfig, PluginCreator, ProgramTransformer, TransformerList } from '../../../src/patch/types';
import { advancedTransformer } from '../transforms/transform-advanced';
import { simpleTransformer } from '../transforms/transform-simple';
import { progTransformer1, progTransformer2 } from '../transforms/program-transformer';
import * as ts from 'typescript';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

function createTransformers(config: PluginConfig[]):
  { transformers: TransformerList, programTransformers: [ ProgramTransformer, PluginConfig ][] }
{
  const pluginCreator = new PluginCreator(config, __dirname);
  const host = { program: {} as ts.Program };
  return pluginCreator.createTransformers(host);
}


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

export default function suite() {
  it('should be initialized with empty config', () => {
    const pluginCreator = new PluginCreator([]);

    expect(pluginCreator).to.be.instanceOf(PluginCreator)
  });

  it('should throw error if wrong config entry given', () => {
    const config = [ { someGarbage: 123 } ] as any;

    expect(() => new PluginCreator(config)).to.throw;
  });

  it('should initialize default transformer in before group', () => {
    const config: PluginConfig[] = [ { transform: '../transforms/transform-simple.ts' } ];

    expect(createTransformers(config).transformers).to.eql({
      after: [],
      afterDeclarations: [],
      before: [ simpleTransformer ],
    });
  });

  it('should initialize default transformer in after group', () => {
    const config: PluginConfig[] = [ { transform: '../transforms/transform-simple.ts', after: true } ];

    expect(createTransformers(config).transformers).to.eql({
      after: [ simpleTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  it('should initialize advanced transformer in after group', () => {
    const config: PluginConfig[] = [ { transform: '../transforms/transform-advanced.ts' } ];

    expect(createTransformers(config).transformers).to.eql({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  it('should provide custom config', () => {
    const config: PluginConfig[] = [ { transform: '../transforms/transform-advanced.ts', some: 1, bla: 2 } as any ];

    expect(createTransformers(config).transformers).to.eql({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  it('should initialize Program transformers', () => {
    const config: PluginConfig[] = [
      { transform: '../transforms/program-transformer.ts', beforeEmit: true, import: 'progTransformer1' },
      { transform: '../transforms/program-transformer.ts', beforeEmit: true, import: 'progTransformer2' }
    ];

    const programTransformers = new Map(createTransformers(config).programTransformers);
    expect(programTransformers.get(progTransformer1)).to.eql(config[0]);
    expect(programTransformers.get(progTransformer2)).to.eql(config[1]);
  });
}
