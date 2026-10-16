// Distinguish real JavaScript exceptions from WebKit's native cancellation diagnostics.
async function installRuntimeErrorMonitor(page,context){
  const errors=[],browserDiagnostics=[];
  let leavingAt=0;
  page.on('console',message=>{
    const text=message.text();
    if(text==='[runtime-document-leaving]')leavingAt=Date.now();
    if(text.startsWith('[runtime-js-error]') || text.startsWith('[runtime-js-rejection]'))errors.push(text);
  });
  page.on('pageerror',error=>{
    const leavingDocument=leavingAt && Date.now()-leavingAt<1000;
    const nativeAccessCancellation=/^(?:Fetch API|XMLHttpRequest) cannot load http/.test(error.name) &&
      error.message.endsWith(' due to access control checks.');
    const firestoreChannel=/^\/127\.0\.0\.1:8080\/google\.firestore\.v1\.Firestore\/(?:Listen|Write)\/channel\?/.test(error.message) &&
      error.message.includes('database=projects%2Fdemo-tintin-interactions%2Fdatabases%2F(default)') &&
      error.stack?.includes('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    // CI traces 38140539333/38902851773: WebKit cancels the same demo Auth
    // lookup 5–11 ms after beforeunload. Its frame can be native fetch or
    // the pinned Auth SDK caller; an active-page error/JS rejection still fails.
    const authLookup=error.message==='/127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key due to access control checks.' &&
      (error.stack?.endsWith('    at fetch ([native code]:0:0)') ||
        error.stack?.includes('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js:'));
    // Trace 38282508656: WebKit cancels batchGet 6 ms after beforeunload.
    // Only this demo emulator endpoint and Firebase SDK stack are diagnostic.
    const firestoreBatchGet=error.message==='/127.0.0.1:8080/v1/projects/demo-tintin-interactions/databases/(default)/documents:batchGet due to access control checks.' &&
      error.stack?.includes('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
    // CI38908416317: la lectura pública local se cancela 4ms después de
    // beforeunload. WebKit puede señalar fetch nativo o su caller canónico.
    // Se exige el endpoint del fixture, diagnóstico nativo y ventana de salida.
    const visualStudioPublic=error.message==='/127.0.0.1:4174/api/visual-studio-global-public due to access control checks.' &&
      (error.stack?.endsWith('    at fetch ([native code]:0:0)') ||
        error.stack?.includes('    at fetchGlobalVisualStudioConfig (http://127.0.0.1:4174/js/components/navigation/compartido/apariencia-global.js?'));
    const navigationCancellation=leavingDocument && nativeAccessCancellation && (firestoreChannel || firestoreBatchGet || authLookup || visualStudioPublic);
    if(navigationCancellation)browserDiagnostics.push({kind:'native-emulator-channel-cancelled-on-navigation',message:error.message});
    else errors.push(error.message);
  });
  await context.addInitScript(()=>{
    window.addEventListener('beforeunload',()=>console.debug('[runtime-document-leaving]'));
    window.addEventListener('pagehide',()=>console.debug('[runtime-document-leaving]'));
    window.addEventListener('error',event=>{if(event.message)console.error('[runtime-js-error]',event.message);});
    window.addEventListener('unhandledrejection',event=>console.error('[runtime-js-rejection]',String(event.reason)));
  });
  return {errors,browserDiagnostics};
}
module.exports={installRuntimeErrorMonitor};
