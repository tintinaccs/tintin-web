const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../js/admin/admin-app.js'), 'utf8');
const functions = ['escapeHtmlAdmin', 'renderAuditLogTable'].map(name => {
  const match = source.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  if (!match) throw new Error('Falta renderer: ' + name);
  return match[0];
}).join('\n');
for (const width of [390, 820, 1440]) test(`Auditoría no interpreta contadores históricos hostiles en ${width}px`, async ({ page }, info) => {
  await page.setViewportSize({ width, height: 900 });
  const requests = [];
  await page.route('**/*', route => { requests.push(route.request().url()); return route.abort(); });
  await page.setContent('<table><tbody id="audit-tbody"></tbody></table>');
  const hostile = '<span id="qa-audit-injection">Contenido inyectado</span><img src="https://untrusted.invalid/track">';
  const rows = [hostile, '12', -1, 1.5, {}, 1000001, 0, 12].map((bulkCount, i) => ({ id: 'qa-' + i, action: 'editar_producto', actorEmail: 'qa@example.invalid', bulk: true, bulkCount, details: hostile, productHistory: [null, 'invalid', { productId: 'qa', priceBefore: hostile }] }));
  await page.addScriptTag({ content: `const _allAuditLogs=${JSON.stringify(rows).replace(/</g, '\\u003c')};const _selectedAuditLogs=new Set();const AUDIT_ACTION_LABELS={};function formatDate(){return 'fecha';}function updateAuditBulkToolbar(){};${functions};renderAuditLogTable();` });
  await expect(page.locator('#audit-tbody tr')).toHaveCount(rows.length);
  await expect(page.locator('#qa-audit-injection,img')).toHaveCount(0);
  await expect(page.locator('#audit-tbody tr').first().locator('.adm-badge')).toHaveText('Masivo');
  await expect(page.locator('#audit-tbody tr').last().locator('.adm-badge')).toHaveText('Masivo (12)');
  await expect(page.locator('#audit-tbody tr').first()).toContainText(hostile);
  expect(requests).toEqual([]);
  await page.screenshot({ path: info.outputPath(`audit-safe-${width}.png`) });
});
