import * as shell from 'shelljs';
import * as path from 'path';
import * as fs from 'fs';
import glob from 'glob';
import { TSPOptions } from './cli';


/* ********************************************************************************************************************
 * Path Constants
 * ********************************************************************************************************************/
// region Path Constants

const TTS_ROOT = path.dirname(require.resolve("ttypescript/package.json"));
const DEST_ROOT = path.dirname(require.resolve("typescript/package.json"));
const PATCH_LIB = path.join(DEST_ROOT,'lib-patch');
const TS_LIB = path.join(DEST_ROOT,'lib-ts');
const MAIN_LIB = path.join(DEST_ROOT,'lib');

// endregion


/* ********************************************************************************************************************
 * Helpers
 * ********************************************************************************************************************/
// region Helpers

/**
 * Create symbolic link / Junction for directory
 * @param srcDir - Directory to link
 * @param destDir - Name for new link
 */
function ln_dir(srcDir: string, destDir: string) {
  try {
    return shell.ln('-sf', destDir, srcDir);
  } catch (e) {
    // Make directory junction (windows)
    return shell.exec(`mklink /J ${destDir} ${srcDir}`, { silent: true }).stderr
  }
}

/**
 * Execute a series of tasks and throw if any shelljs errors
 */
function runTasks(tasks: { [x:string]: () => string | false }) {
  for (let [caption, task] of Object.entries(tasks))
    if (task() && shell.error())
      throw new Error(`Error while trying to ${caption}: ${shell.error()}`);
}

function Log(msg: string, silent?: boolean) {
  if (!silent) console.log(msg);
}

// endregion


/* ********************************************************************************************************************
 * Exports
 * ********************************************************************************************************************/
// region Exports

/**
 * Patch TypeScript installation with TTypeScript
 */
export function install({silent}: TSPOptions) {
  if (fs.existsSync(PATCH_LIB)) uninstall({silent: true});

  runTasks(
    {
      'copy patch': () => shell.cp('-R', path.join(TTS_ROOT, 'lib'), PATCH_LIB),

      'setup patch routing': () => shell.sed('-i',
        /(?<=')typescript(?=['\/\\])/,
        '../lib-ts/typescript',
        glob.sync(path.resolve(PATCH_LIB,'*'), { nodir: true })
      ),

      'move TS lib': () => shell.mv(path.join(DEST_ROOT,'lib'), TS_LIB),

      'symlink patch lib': () => ln_dir(PATCH_LIB, MAIN_LIB),
    }
  );
  Log(`ts-patch installed!`,silent);
}

/**
 * Remove TTypeScript patch
 */
export function uninstall({silent}: TSPOptions) {
  runTasks({
    'remove patch lib': () => shell.rm('-rf', PATCH_LIB),

    'restore TS lib': () => (fs.existsSync(TS_LIB)) &&
      shell.rm('-rf', MAIN_LIB) &&
      shell.mv('-f', TS_LIB, MAIN_LIB)
  });
  Log('ts-patch removed!', silent);
}

/**
 * Disable TTypeScript patch
 */
export function disable({silent}: TSPOptions) {
  runTasks({
    'unlink patch lib': () =>
      shell.rm('-rf', MAIN_LIB) &&
      ln_dir(TS_LIB, MAIN_LIB)
  });
  Log('ts-patch disabled!', silent);
}

/**
 * Disable TTypeScript patch
 */
export function enable({silent}: TSPOptions) {
  runTasks({
    'link patch lib': () =>
      shell.rm('-rf', MAIN_LIB) &&
      ln_dir(PATCH_LIB, MAIN_LIB)
  });
  Log('ts-patch enabled!', silent);
}

// endregion