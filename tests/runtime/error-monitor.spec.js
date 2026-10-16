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


test('native Auth emulator cancellation is diagnostic only inside the document-leaving window', async () => {
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
    { name: 'visual studio public cancellation', leaving: true, delta: 11, diagnostic: true, change: { message: '/127.0.0.1:4174/api/visual-studio-global-public due to access control checks.' } },
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
    page.emit('pageerror', { ...nativeError, ...fixture.change });
    expect(monitor.browserDiagnostics.length, fixture.name).toBe(fixture.diagnostic ? 1 : 0);
    expect(monitor.errors.length, fixture.name).toBe(fixture.diagnostic ? 0 : 1);
    // The same text surfaced as an actual unhandled rejection still fails.
    page.emit('console', { text: () => '[runtime-js-rejection] ' + nativeError.message });
    expect(monitor.errors.length, fixture.name + ': JS rejection').toBe(fixture.diagnostic ? 1 : 2);
  }
});
