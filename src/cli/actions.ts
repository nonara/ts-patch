import * as shell from 'shelljs';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import { TSPOptions } from '@cli/cli';
import { Log, runTasks } from '@cli/helpers';

/* ********************************************************************************************************************
 * Path Constants
 * ********************************************************************************************************************/
// region Path Constants

const SRC_ROOT = path.join(__dirname, 'patch-files');
const SRC_LIB = path.join(SRC_ROOT, 'lib');
const SRC_TSP = path.join(SRC_ROOT, 'ts-patch');

const DEST_ROOT = path.join(path.dirname(require.resolve("typescript/package.json")));
const DEST_LIB = path.join(DEST_ROOT, 'lib');
const DEST_TSP = path.join(DEST_ROOT, 'ts-patch');

// endregion


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/
// region Exports

/**
 * Patch TypeScript installation with TTypeScript
 */
export function install({silent}: TSPOptions) {
  runTasks(
    {
      'create ts-patch directory': () => shell.mkdir('-p', DEST_TSP),

      'copy original files': () => {
        for (let file of glob.sync(path.resolve(SRC_LIB, '*.js'), { nodir: true })) {
          file = path.join(DEST_LIB,path.basename(file));
          const baseFileName = path.basename(file, path.extname(file));
          const originalJs = path.join(DEST_LIB, `${baseFileName}.original.js`);

          // Do not overwrite if original already exists
          if (fs.existsSync(originalJs)) continue;

          // Copy js file to <file>.original.ts
          shell.cp(file, originalJs);

          // Copy d.ts file to <file>.original.d.ts
          const dtsFile = path.join(DEST_LIB, `${baseFileName}.d.ts`);
          if (fs.existsSync(dtsFile))
            shell.cp(dtsFile, path.join(DEST_LIB, `${baseFileName}.original.d.ts`));
        }
      },
      
      'copy patch files': () => shell.cp(path.join(SRC_LIB, '*'), DEST_LIB),

      'copy system files': () => shell.cp(path.join(SRC_TSP, '*'), DEST_TSP),

      'add absolute path to tsserverlibrary': () => {
        // Use exact path in tsserverlibrary (needed to support language service running in IDEs)
        shell.sed('-i',
          /(?<=["'`])\.\.\/ts-patch\/loader(?=["'`])/,
          DEST_TSP.split(path.sep).join('/') + '/loader',
          path.join(DEST_LIB, 'tsserverlibrary.js')
        );
      }
    }
  );
  Log(`ts-patch installed!`,silent);
}

/**
 * Remove TTypeScript patch
 */
export function uninstall({silent}: TSPOptions) {
  runTasks({
    'restore TS files': () => {
      for (let file of glob.sync(path.resolve(DEST_LIB, '*.original.js'), { nodir: true })) {
        // Restore .js file
        shell.mv(
          file,
          file.replace(/\.original.js$/, '.js')
        );

        // Restore d.ts file
        const dtsFile = file.replace(/\.original.js$/, '.original.d.ts');
        if (fs.existsSync(dtsFile))
          shell.mv(
            dtsFile,
            file.replace(/\.original.js$/, '.d.ts'),
          );
      }
    },

    'remove ts-patch files': () => (fs.existsSync(DEST_TSP)) && shell.rm('-rf', DEST_TSP),
  });
  Log('ts-patch removed!', silent);
}

// endregion