// Use the existing Firebase CLI with a temporary absolute Rules path. Firebase
// forbids ../.. rules paths relative to a nested --config project directory.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'tintin-phase01-emulator-'));
try {
 const config=JSON.parse(fs.readFileSync(new URL('emulator-config.json',import.meta.url),'utf8'));
 config.firestore.rules=path.join(root,'firestore.rules');
 const configFile=path.join(folder,'firebase.json');fs.writeFileSync(configFile,JSON.stringify(config));
 const result=spawnSync(process.execPath,[path.join(root,'node_modules/firebase-tools/lib/bin/firebase.js'),'emulators:exec','--only','firestore','--project','demo-tintin-phase01','--config',configFile,'node scripts/agent/phase01-audit/rules-probe.mjs'],{cwd:root,stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
} finally {fs.rmSync(folder,{recursive:true,force:true});}
