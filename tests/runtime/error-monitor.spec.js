const {test,expect}=require('@playwright/test');
const {installRuntimeErrorMonitor}=require('./runtime-error-monitor.js');
// Calibration only: this fixture is not a storefront or service-integration claim.
test('el monitor falla ante excepciones reales y promesas sin capturar',async({page,context})=>{
  const {errors,browserDiagnostics}=await installRuntimeErrorMonitor(page,context);
  await page.route('**/__monitor',route=>route.fulfill({contentType:'text/html',body:'<title>Monitor calibration</title>'}));
  await page.goto('/__monitor');
  await page.evaluate(()=>{
    queueMicrotask(()=>{throw new Error('runtime-monitor-uncaught-probe');});
    void Promise.reject(new Error('runtime-monitor-rejection-probe'));
  });
  await expect.poll(()=>errors.some(message=>message.includes('runtime-monitor-uncaught-probe'))).toBe(true);
  await expect.poll(()=>errors.some(message=>message.includes('runtime-monitor-rejection-probe'))).toBe(true);
  expect(browserDiagnostics).toEqual([]);
});


test('native reads cancelled on navigation are diagnostic only for known callers inside the leaving window', async () => {
  const fs = require('node:fs');
  const vm = require('node:vm');
  const { EventEmitter } = require('node:events');
  const source = fs.readFileSync(require.resolve('./runtime-error-monitor.js'), 'utf8');
  const nativeError = {
    name: 'Fetch API cannot load http',
    message: '/127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key due to access control checks.',
    stack: 'Fetch API cannot load http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key due to access control checks.\n    at fetch ([native code]:0:0)',
  };
  for (const fixture of [
    { name: 'confirmed native cancellation', leaving: true, delta: 11, diagnostic: true },
    { name: 'confirmed Auth SDK cancellation', leaving: true, delta: 5, diagnostic: true, change: { stack: 'Fetch API cannot load http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=demo-key due to access control checks.\n    at unknown (https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js:1:34862)' } },
    { name: 'active-page Auth SDK failure', leaving: false, delta: 5, change: { stack: '    at unknown (https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js:1:34862)' } },
    { name: 'visual studio public cancellation', leaving: true, delta: 11, diagnostic: true, change: { message: '/127.0.0.1:4174/api/visual-studio-global-public due to access control checks.' } },
    { name: 'confirmed public reader cancellation', leaving: true, delta: 4, diagnostic: true, change: { message: '/127.0.0.1:4174/api/visual-studio-global-public due to access control checks.', stack: 'Fetch API cannot load http://127.0.0.1:4174/api/visual-studio-global-public due to access control checks.\n    at fetchGlobalVisualStudioConfig (http://127.0.0.1:4174/js/components/navigation/compartido/apariencia-global.js?v=tintin-20261016-footer-gradient-layout-1:173:30)' } },
    { name: 'active public reader failure', leaving: false, delta: 4, change: { message: '/127.0.0.1:4174/api/visual-studio-global-public due to access control checks.', stack: '    at fetchGlobalVisualStudioConfig (http://127.0.0.1:4174/js/components/navigation/compartido/apariencia-global.js?v=tintin-20261016-footer-gradient-layout-1:173:30)' } },
    { name: 'unrelated public reader stack', leaving: true, delta: 4, change: { message: '/127.0.0.1:4174/api/visual-studio-global-public due to access control checks.', stack: '    at otherReader (http://127.0.0.1:4174/js/other-reader.js:1:1)' } },
    ...[
      { name:'version read cancelled on redirect', leaving:true, delta:39, diagnostic:true },
      { name:'active-page version access failure', leaving:false, delta:39 },
      { name:'version read after leaving window', leaving:true, delta:1000 },
      { name:'unrelated version reader', leaving:true, delta:39, stack:'    at otherReader (http://127.0.0.1:4174/js/other-reader.js:1:1)' },
      { name:'production version endpoint', leaving:true, delta:39, message:'/tintinaccs.com/site-version.json due to access control checks.' },
      { name:'actual version JavaScript exception', leaving:true, delta:39, errorName:'Error' },
    ].map(fixture => ({ ...fixture, change: {
      name:fixture.errorName || nativeError.name,
      message:fixture.message || '/127.0.0.1:4174/site-version.json due to access control checks.',
      stack:fixture.stack || 'Fetch API cannot load http://127.0.0.1:4174/site-version.json due to access control checks.\n    at fetchSiteVersion (http://127.0.0.1:4174/js/quality/vigilancia-version.js?v=tintin-20261017-update-notice-1:39:33)',
    }})),
    { name: 'normal document access failure', leaving: false, delta: 11 },
    { name: 'expired leaving window', leaving: true, delta: 1000 },
    { name: 'JavaScript exception', leaving: true, delta: 11, change: { name: 'Error' } },
    { name: 'missing native stack', leaving: true, delta: 11, change: { stack: '' } },
    { name: 'another emulator endpoint', leaving: true, delta: 11, change: { message: nativeError.message.replace('accounts:lookup', 'accounts:signInWithPassword') } },
    { name: 'production service', leaving: true, delta: 11, change: { message: nativeError.message.replace('/127.0.0.1:9099/', '/identitytoolkit.googleapis.com/') } },
  ]) {
    let now = 100000;
    const sandbox = { module: { exports: {} }, Date: { now: () => now } };
    vm.runInNewContext(source, sandbox);
    const page = new EventEmitter();
    const context = { addInitScript: async () => {} };
    const monitor = await sandbox.module.exports.installRuntimeErrorMonitor(page, context);
    if (fixture.leaving) page.emit('console', { text: () => '[runtime-document-leaving]' });
    now += fixture.delta;
    const candidate = { ...nativeError, ...fixture.change };
    page.emit('pageerror', candidate);
    expect(monitor.browserDiagnostics.length, fixture.name).toBe(fixture.diagnostic ? 1 : 0);
    expect(monitor.errors.length, fixture.name).toBe(fixture.diagnostic ? 0 : 1);
    // The same text surfaced as an actual unhandled rejection still fails.
    page.emit('console', { text: () => '[runtime-js-rejection] ' + candidate.message });
    expect(monitor.errors.length, fixture.name + ': JS rejection').toBe(fixture.diagnostic ? 1 : 2);
  }
});
