import path from 'path';
import { getTsPackage } from '../../../projects/core/src/package';
import { patchModule } from '../../../projects/core/src/module/patch-module';


/* ****************************************************************************************************************** */
// region: Tests
/* ****************************************************************************************************************** */

describe('Test', () => {
  test('Test', () => {
    const tsPackage = getTsPackage(path.join(__dirname, '../../node_modules/ts-latest'));

    // const patched = tsPackage.moduleNames.map(name => patchModule(tsPackage.getModule(name)));
    const patched = patchModule(tsPackage.getModule('tsc.js'));

    debugger
    expect(patched).toBeTruthy();
  });
});

// endregion
