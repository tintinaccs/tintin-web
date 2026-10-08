const {test,expect}=require('@playwright/test');
const fs=require('node:fs');
const source=fs.readFileSync('checkout.html','utf8');
const handler=source.slice(source.indexOf('function refreshPaymentOptions()'),source.indexOf('// Datos bancarios reales'));
for(const width of [320,768,1440]) test(`encomienda sólo transferencia y limpia efectivo previo (${width}px)`,async({page})=>{
 const fixture=source.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace('</body>',`<script>let efectivoAdminOn=true,transferenciaAdminOn=true;const orderData={shippingMethod:'delivery',paymentMethod:''};${handler}
 window.setShipping=(method)=>{orderData.shippingMethod=method;refreshPaymentOptions()};
 document.querySelectorAll('.ck-panel').forEach(el=>el.classList.toggle('active',el.id==='panel-3'));
 document.documentElement.classList.remove('tt-color-scheme-pending','tt-store-gate-pending');refreshPaymentOptions();</script></body>`);
 await page.route('**/__encomienda-payment',route=>route.fulfill({contentType:'text/html',body:fixture}));
 await page.setViewportSize({width,height:900});await page.goto('/__encomienda-payment');
 await page.locator('label[for="pay-efectivo"]').click();await expect(page.locator('#pay-efectivo')).toBeChecked();
 await page.evaluate(()=>window.setShipping('encomienda'));
 await expect(page.locator('#pay-option-efectivo')).toBeHidden();await expect(page.locator('#pay-efectivo')).toBeDisabled();await expect(page.locator('#pay-efectivo')).not.toBeChecked();
 await expect(page.locator('#pay-transferencia')).toBeEnabled();await page.locator('label[for="pay-transferencia"]').click();await expect(page.locator('#pay-transferencia')).toBeChecked();
 await expect(page.locator('.ck-pay-note')).toContainText('sólo transferencia bancaria antes del despacho');
 await page.evaluate(()=>window.setShipping('delivery'));await expect(page.locator('#pay-efectivo')).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
