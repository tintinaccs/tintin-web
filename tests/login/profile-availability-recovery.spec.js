const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'login.html'), 'utf8');
const checks = html.slice(html.indexOf('  let usernameAvailability'), html.indexOf('  // El mismo componente de mapa'));
const deadline = 'function withDeadline' + fs.readFileSync(path.join(root, 'js/core/auth/estado-perfil-sesion.mjs'), 'utf8').split('export function withDeadline')[1];
const harness = `
${deadline}
const user={getIdToken:async()=>'isolated-token'},AUTH_NETWORK_DEADLINE_MS=15000;
const usernameInput=document.getElementById('login-profile-username'),plan={needsUsername:true};
const isValidUsernameFormat=raw=>raw.length>=3,isReservedUsername=()=>false,normalizeUsername=raw=>raw.toLowerCase();
let resolveOld;
window.__calls=0;
async function fetch(){window.__calls++;if(window.__calls===1)return {ok:true,json:()=>new Promise(resolve=>{resolveOld=resolve;})};return new Promise(()=>{});}
${checks}
window.__resolveOld=()=>resolveOld({available:false});
document.documentElement.classList.remove('login-auth-pending');
document.getElementById('login-profile-block').style.display='block';
document.getElementById('login-profile-username-field').style.display='block';
`;
for (const width of [390, 768, 1440]) {
  test(`disponibilidad descarta datos viejos y libera la comprobación a ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install();
    await page.route('**/*.js*', route => route.fulfill({ contentType: 'text/javascript', body: route.request().url().endsWith('/availability-fixture.js') ? harness : '' }));
    await page.route('**/availability-fixture', route => route.fulfill({ contentType: 'text/html', body: html.replace('</body>', '<script src="/availability-fixture.js"></script></body>') }));
    await page.goto('/availability-fixture');
    await page.locator('#login-profile-username').fill('firstname');
    await page.clock.fastForward(360);
    await expect.poll(() => page.evaluate(() => window.__calls)).toBe(1);
    await page.locator('#login-profile-username').fill('secondname');
    await page.evaluate(() => window.__resolveOld());
    await expect(page.locator('#login-username-status')).toHaveAttribute('data-state', 'idle');
    await page.clock.fastForward(360);
    await expect.poll(() => page.evaluate(() => window.__calls)).toBe(2);
    await page.clock.fastForward(15000);
    await expect(page.locator('#login-username-status')).toHaveAttribute('data-state', 'unknown');
    await expect(page.locator('#login-username-status')).toHaveText('Lo confirmaremos al continuar.');
    await expect(page.locator('#login-profile-username')).toBeEnabled();
  });
}
