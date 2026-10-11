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
    const navigationCancellation=leavingAt && Date.now()-leavingAt<1000 &&
      /^(?:Fetch API|XMLHttpRequest) cannot load http/.test(error.name) &&
      /^\/127\.0\.0\.1:8080\/google\.firestore\.v1\.Firestore\/(?:Listen|Write)\/channel\?/.test(error.message) &&
      error.message.includes('database=projects%2Fdemo-tintin-interactions%2Fdatabases%2F(default)') &&
      error.message.endsWith(' due to access control checks.') &&
      error.stack?.includes('https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js');
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
