// Run the full-page suite with isolated real services. Existing CI calls this
// through audit:login-profile; missing browsers/services are hard failures.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {webkit}=require('playwright');
const root=path.resolve(import.meta.dirname,'..');
const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tintin-runtime-'));
const htmlReport=path.join(temporary,'html-report');
process.env.TINTIN_RUNTIME_HTML_DIR=htmlReport;
function run(args){return new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{cwd:root,stdio:'inherit',env:process.env});const stop=()=>child.kill('SIGTERM');process.once('SIGTERM',stop);process.once('SIGINT',stop);child.once('error',reject);child.once('exit',code=>{process.removeListener('SIGTERM',stop);process.removeListener('SIGINT',stop);code===0?resolve():reject(new Error(`Command failed (${code}): ${args[0]}`));});});}
try{
  // CI already installs Chromium. Add WebKit only when it isn't installed;
  // do not reinstall dependencies or Chromium in the repair/test cycle.
  if(process.env.CI && !fs.existsSync(webkit.executablePath())){
    await run(['node_modules/playwright/cli.js','install','--with-deps','webkit']);
  }
  const config=path.join(temporary,'firebase.json');
  fs.writeFileSync(config,JSON.stringify({firestore:{rules:path.join(root,'firestore.rules')},emulators:{auth:{host:'127.0.0.1',port:9099},firestore:{host:'127.0.0.1',port:8080},ui:{enabled:false},singleProjectMode:true}}));
  await run(['node_modules/firebase-tools/lib/bin/firebase.js','emulators:exec','--only','auth,firestore','--project','demo-tintin-interactions','--config',config,'node node_modules/playwright/cli.js test --config=playwright.runtime.config.js']);
}catch(error){console.error(error.message);process.exitCode=1;}
finally{
  if(fs.existsSync(htmlReport)){
    const artifact=path.join(root,'artifacts/real-interactions/runtime-report.zip');
    fs.mkdirSync(path.dirname(artifact),{recursive:true});
    try{fs.rmSync(artifact,{force:true});if(process.platform==='win32')execFileSync('tar.exe',['-a','-c','-f',artifact,'.'],{cwd:htmlReport});else execFileSync('zip',['-qr',artifact,'.'],{cwd:htmlReport});}
    catch(error){console.error('Could not archive runtime HTML report:',error.message);process.exitCode=1;}
  }
  fs.rmSync(temporary,{recursive:true,force:true});
}
