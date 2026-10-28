import test from 'node:test';
import {adminEventAttributes} from '../../js/admin/eventos-dinamicos-admin.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const parse5 = createRequire(import.meta.url)('parse5');
import { sanitizeCustomPageHtml } from '../../cloudflare/contenido-pagina-seguro.js';

const origin = 'https://tintinaccesorios.pages.dev/pages/fixture';
const walk = node => [node, ...(node.childNodes || []).flatMap(walk)];
const attrs = node => Object.fromEntries((node.attrs || []).map(attribute => [attribute.name, attribute.value]));
for (const payload of [
  '<a href="java&#x73;cript:alert(1)">link</a>',
  '<a href="jav&#x09;ascript:alert(1)">link</a>',
  '<a href="JAVASCRIPT:alert(1)">link</a>',
  '<img src="data:image/svg+xml,x" onerror="alert(1)">',
  '<svg><a xlink:href="javascript:alert(1)">link</a></svg>',
  '<script src="/js/admin/admin-app.js"></script><iframe srcdoc="bad"></iframe>',
  '<scr<script>ipt>alert(1)</scr<script>ipt>',
  '<math><mtext><table><mglyph><style><!--</style><img title="--><img src=x onerror=alert(1)>">',
  '<a href="javascript:alert(1)" href="https://example.test">link</a>'
]) test('página personalizada elimina contenido activo: ' + payload.slice(0, 45), () => {
  const result = sanitizeCustomPageHtml(payload, origin);
  for (const node of walk(parse5.parseFragment(result))) {
    assert.ok(!['script','style','iframe','svg','math','form'].includes(node.tagName));
    for (const [name, value] of Object.entries(attrs(node))) {
      assert.ok(!/^on|srcdoc|xlink|xmlns/.test(name));
      if (['href','src'].includes(name)) assert.ok(['https:','http:','mailto:','tel:'].includes(new URL(value, origin).protocol));
    }
  }
  assert.equal(sanitizeCustomPageHtml(result, origin), result);
});
test('conserva HTML básico, caracteres y enlaces/imágenes autorizados', () => {
  const output = sanitizeCustomPageHtml('<h2>Guía &amp; detalles</h2><p>Texto <strong>importante</strong></p><ul><li>Uno</li></ul><a href="/catalogo?x=1&amp;y=2" target="_blank">Catálogo</a><img src="https://res.cloudinary.com/demo/image/upload/a.png" alt="Foto &quot;dorada&quot;">', origin);
  const nodes = walk(parse5.parseFragment(output));
  assert.equal(attrs(nodes.find(node => node.tagName === 'a')).href, '/catalogo?x=1&y=2');
  assert.equal(attrs(nodes.find(node => node.tagName === 'a')).rel, 'noopener noreferrer');
  assert.equal(attrs(nodes.find(node => node.tagName === 'img')).alt, 'Foto "dorada"');
  assert.ok(nodes.some(node => node.tagName === 'strong'));
});
test('contenido profundamente anidado y excesivo conserva límites del editor sin desbordar la pila', () => {
  assert.doesNotThrow(() => sanitizeCustomPageHtml('<div>'.repeat(1000) + 'texto' + '</div>'.repeat(1000), origin));
  assert.ok(sanitizeCustomPageHtml('a'.repeat(100001), origin).length <= 100000);
});

const source = fs.readFileSync(new URL('../../js/admin/admin-app.js', import.meta.url), 'utf8') + '\n' + fs.readFileSync(new URL('../../js/admin/correos/correos-admin.js', import.meta.url), 'utf8');
function body(name) {
  const match = source.match(new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(match, name); return match[0];
}
test('historial y dashboard representan etiquetas y IDs hostiles como datos', () => {
  const key = '<img src=x onerror="window.pwned=1">';
  const id = 'log\"\');window.pwned=1;//';
  const elements = new Map();
  const document = { getElementById: name => {
    if (!elements.has(name)) elements.set(name, { value:'', innerHTML:'' });
    return elements.get(name);
  }};
  const deps = { document, adminEventAttributes, allEmailLogs:[{id,type:key,status:'failed',category:'pedido'}], allEmailTemplates:[], allEmailCampaigns:[], emailSettingsCache:{senderEmail:key}, EMAIL_WEBHOOK_URL:'',EMAIL_SENDER_ADDRESS:'sender@example.test', ORDER_TYPE_NAMES:{},_selectedLogs:new Set(),formatDate:()=> 'fecha',updateLogsBulkToolbar:()=>{} };
  const run = new Function('deps', 'const {'+Object.keys(deps).join(',')+'}=deps;'+['escapeHtmlAdmin','templateLabel_','logStatusBadge_','categoryBadge_','renderCorreosHistorialTab','renderCorreosDashboard'].map(body).join('\n')+'; renderCorreosHistorialTab(); renderCorreosDashboard();');
  run(deps);
  for (const name of ['hist-tbody','hist-filter-type','correos-dash-recent','correos-system-status']) {
    for (const node of walk(parse5.parseFragment(elements.get(name).innerHTML))) assert.ok(!['img','svg','script'].includes(node.tagName));
  }
  const options = walk(parse5.parseFragment(elements.get('hist-filter-type').innerHTML)).filter(node => node.tagName === 'option');
  assert.equal(attrs(options[1]).value, key);
  const nodes = walk(parse5.parseFragment(elements.get('hist-tbody').innerHTML));
  assert.equal(attrs(nodes.find(node => node.tagName === 'input'))['data-id'], id);
  const captured=[];
  const window={viewLogDetail:value=>captured.push(value),retryFailedLog:value=>captured.push(value)};
  for (const node of nodes.filter(node => node.tagName === 'button')) {
    const attributes=attrs(node);
    assert.equal(attributes.onclick,undefined);
    assert.ok(['viewLogDetail','retryFailedLog'].includes(attributes['data-admin-click']));
    window[attributes['data-admin-click']](...JSON.parse(attributes['data-admin-click-args']));
  }
  assert.deepEqual(captured, [id,id]);assert.equal(window.pwned, undefined);
});
test('el ID real de Firestore conserva autoridad frente a un campo id del documento', () => {
  for (const pattern of ['allEmailLogs = snapshot.docs.map(item => ({ ...item.data(), id: item.id }))','allEmailLogs = logsSnap.docs.map(d => ({ ...d.data(), id: d.id }))']) assert.ok(source.includes(pattern));
});

test('OTP rechaza la cola del entero de 32 bits y mantiene seis dígitos', () => {
  const otp = fs.readFileSync(new URL('../../functions/api/email-otp-send.js', import.meta.url), 'utf8');
  const fn = otp.match(/function generateCode\(\) \{[\s\S]*?\n\}/)[0];
  for (const [values, expected] of [[[0],'000000'],[[999999],'999999'],[[1000000],'000000'],[[4294967295,4294000000,4293999999],'999999']]) {
    const samples=[...values];let calls=0;
    const crypto={getRandomValues:buffer=>{calls++;buffer[0]=samples.shift();return buffer;}};
    const generate=new Function('crypto',fn+';return generateCode;')(crypto);
    assert.equal(generate(),expected);assert.equal(calls,values.length);
  }
});
