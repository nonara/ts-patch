import { getLiveModule } from '../../dist/module';


/* ****************************************************************************************************************** */
// region: Tests
/* ****************************************************************************************************************** */

describe('live compiler routes', () => {
  test('compiler route exposes patched TypeScript', () => {
    const ts = require('../../dist/compiler');
    expect(typeof ts.createProgram).toBe('function');
    expect(typeof ts.originalCreateProgram).toBe('function');
  });

  test('tsserverlibrary route exposes patched TypeScript with service identity', () => {
    const tsserverLibrary = require('../../dist/compiler/tsserverlibrary');
    expect(typeof tsserverLibrary.createProgram).toBe('function');
    expect(typeof tsserverLibrary.originalCreateProgram).toBe('function');

    const { js } = getLiveModule('typescript.js', { libraryName: 'tsserverlibrary' });
    expect(js).toContain(`tsp.currentLibrary = 'tsserverlibrary'`);
  });

  test('tsserver live route can generate a patched TypeScript dependency with service identity', () => {
    const { js } = getLiveModule('typescript.js', { libraryName: 'tsserver' });
    expect(js).toContain(`tsp.currentLibrary = 'tsserver'`);
  });
});

// endregion
