// Local audit adapter: choose an existing Chromium executable without modifying
// repository tests, fixtures, assertions, deadlines or application sources.
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../../package.json',import.meta.url));
if(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH){
 const {chromium}=require('playwright');
 const launch=chromium.launch.bind(chromium);
 chromium.launch=(options={})=>launch({...options,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH});
}
