import { expect } from 'chai';
import { PluginConfig, PluginCreator } from '../../../src/patch/types';
import { advancedTransformer } from '../transforms/transform-advanced';
import { simpleTransformer } from '../transforms/transform-simple';
import * as ts from 'typescript';


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/

function createTransformers(config: PluginConfig[]): ts.CustomTransformers {
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

    expect(createTransformers(config)).to.eql({
      after: [],
      afterDeclarations: [],
      before: [ simpleTransformer ],
    });
  });

  it('should initialize default transformer in after group', () => {
    const config: PluginConfig[] = [ { transform: '../transforms/transform-simple.ts', after: true } ];

    expect(createTransformers(config)).to.eql({
      after: [ simpleTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  it('should initialize advanced transformer in after group', () => {
    const config: PluginConfig[] = [ { transform: '../transforms/transform-advanced.ts' } ];

    expect(createTransformers(config)).to.eql({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });

  it('should provide custom config', () => {
    const config: PluginConfig[] = [ { transform: '../transforms/transform-advanced.ts', some: 1, bla: 2 } as any ];

    expect(createTransformers(config)).to.eql({
      after: [ advancedTransformer ],
      afterDeclarations: [],
      before: [],
    });
  });
}