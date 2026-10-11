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
