import fs from 'fs';
import os from 'os';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';


describe('Node module hooks', () => {
  test('synchronous registerHooks supports transformer loader requirements', () => {
    const moduleApi = require('node:module');
    const { registerHooks } = moduleApi;

    expect(typeof registerHooks).toBe('function');

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsp-hooks-test-'));
    fs.writeFileSync(path.join(dir, 'entry.cjs'), 'module.exports = require("./helper.ts").value;');
    fs.writeFileSync(path.join(dir, 'esm.mts'), 'export default 42;');

    const hooks = registerHooks({
      resolve(specifier: string, context: any, nextResolve: Function) {
        if (specifier.endsWith('.ts') || specifier.endsWith('.mts')) {
          const parentURL = context.parentURL || pathToFileURL(path.join(dir, 'root.cjs')).href;
          return { url: new URL(specifier, parentURL).href, shortCircuit: true };
        }
        return nextResolve(specifier, context);
      },
      load(fileURL: string, context: any, nextLoad: Function) {
        if (!fileURL.startsWith('file:')) return nextLoad(fileURL, context);
        const filePath = fileURLToPath(fileURL);
        if (filePath.endsWith('helper.ts')) {
          return { format: 'commonjs', source: 'module.exports = { value: 42 };', shortCircuit: true };
        }
        if (filePath.endsWith('esm.mts')) {
          return { format: 'module', source: fs.readFileSync(filePath, 'utf8'), shortCircuit: true };
        }
        return nextLoad(fileURL, context);
      }
    });

    try {
      expect(typeof hooks.deregister).toBe('function');
      expect((moduleApi as any)._load(path.join(dir, 'entry.cjs'), module, false)).toBe(42);
      expect((moduleApi as any)._load(path.join(dir, 'esm.mts'), module, false).default).toBe(42);
    } finally {
      hooks.deregister();
    }
  });
});
