import { cleanTemp } from './project';


export default function() {
  try {
    cleanTemp();
  } catch (e) {
    console.error(e);
  }
}
