import path from 'path';
import { getTsPackage } from '../../../projects/installer/src/ts-package';
import { patchModule } from '../../../projects/installer/src/ts-module/patch-module';


/* ****************************************************************************************************************** */
// region: Tests
/* ****************************************************************************************************************** */

describe('Test', () => {
  test('Test', () => {
    const tsPackage = getTsPackage(path.join(__dirname, '../../node_modules/ts-latest'));

    // const patched = tsPackage.moduleNames.map(name => patchModule(tsPackage.getModule(name)));
    const patched = patchModule(tsPackage.getModule('tsserverlibrary.js'));

    debugger
    expect(patched).toBeTruthy();
  });
});

// endregion
