const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const login = fs.readFileSync('login.html','utf8');
const feedback = login.slice(login.indexOf('function showOtpFeedback('),login.indexOf('</script>',login.indexOf('function showOtpFeedback(')));
for (const [outcome, state, text] of [['success','success','Código confirmado'],['code_mismatch','error','Código incorrecto'],['network_error','warning','No pudimos completar']]) {
  test(`código: ${state} visible y sin acceso falso`, async ({page}) => {
    await page.setContent('<input id="login-otp-input" value="123456"><button id="btn-verify-otp">Confirmar código</button>');
    await page.addStyleTag({path:'css/pages/login/login.css'});
    await page.evaluate(({feedback,outcome}) => {
      window.explicitLoginInProgress=false; window.loginSessionGeneration=0; window.otpEmail='fixture@example.invalid';
      window.hideMessages=()=>document.getElementById('login-otp-feedback')?.remove();
      window.showOverlay=window.hideLoginOverlay=()=>{};
      window.showError=()=>{}; window.otpErrorMessage=code=>code;
      window.verifyOtpCode=async()=> { if(outcome!=='success') throw {code:outcome}; return {uid:'fixture'}; };
      window.finishOtpLogin=async()=> { window.didFinish=true; };
      (0,eval)(feedback);
    },{feedback,outcome});
    await page.locator('button').click();
    await expect(page.locator('[role="status"]')).toHaveAttribute('data-state',state);
    await expect(page.locator('[role="status"]')).toContainText(text);
    await expect(page.locator('[role="status"]')).toBeInViewport();
    await page.screenshot({path:`/tmp/tintin-otp-${state}.png`});
    if(outcome==='success') {
      expect(await page.evaluate(()=>!!window.didFinish)).toBe(false);
      await expect.poll(()=>page.evaluate(()=>!!window.didFinish)).toBe(true);
    } else expect(await page.evaluate(()=>!!window.didFinish)).toBe(false);
  });
}

test('transferencia: alias legible, datos largos y copiado identificable', async({page})=>{
  const source=fs.readFileSync('js/pages/checkout/checkout-metodos-pago.js','utf8');
  const helpers=source.slice(source.indexOf('function escapeHtml'),source.indexOf('function methodHtml'));
  await page.setViewportSize({width:320,height:640});
  await page.setContent('<div id="root"></div>');
  await page.addStyleTag({path:'css/components/payments/payment-methods.css'});
  await page.evaluate(helpers => {
    (0,eval)(helpers);
    document.getElementById('root').innerHTML='<div class="ck-payment-runtime-item is-selected">'+paymentDetailsHtml({id:'transferencia',instructions:'Enviá el comprobante',details:[{label:'Banco Familiar',value:'Alias: 123456789012345678901234567890\nTitular: Nombre de prueba'}]})+'</div>';
  },helpers);
  await expect(page.locator('.is-alias')).toContainText('123456789012345678901234567890');
  await expect(page.getByRole('button',{name:'Copiar Banco Familiar'})).toHaveText('Copiar alias');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'/tmp/tintin-bank.png'});
});
