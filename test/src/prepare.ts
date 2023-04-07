import { clearProjectTempPath } from './project';


export default function() {
  try {
    clearProjectTempPath();
  } catch (e) {
    console.error(e);
  }
}
