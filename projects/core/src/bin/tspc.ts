import { getLiveModule } from '../module';


/* ****************************************************************************************************************** *
 * Entry
 * ****************************************************************************************************************** */

// Run if main module cli
if (require.main === module) {
  getLiveModule('tsc.js');
} else {
  throw new Error('tspc must be run as a CLI');
}
