#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const write = (rel, text) => fs.writeFileSync(path.join(ROOT, rel), text, 'utf8');
function one(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: esperada 1 coincidencia, encontradas ${count}`);
  return text.replace(before, after);
}

const NEW_VERSION = 'tintin-20260812-preview-dispositivos-reales-2';

{
  const rel='css/admin/visual-studio-v2.css';
  let text=read(rel);
  text=one(text,
    '.visual-studio-v2 .visual-preview-stage{flex:1;min-height:0;padding:24px;overflow:auto;align-items:flex-start;background:radial-gradient(circle at 50% 20%,#f7f7f8,#e5e6e8 70%)}',
    '.visual-studio-v2 .visual-preview-stage{flex:1;min-height:0;padding:24px;overflow:auto;align-items:flex-start;justify-content:flex-start;background:radial-gradient(circle at 50% 20%,#f7f7f8,#e5e6e8 70%)}','stage');
  text=one(text,
    '.visual-studio-v2 .visual-preview-stage iframe{height:100%;min-height:680px;max-height:none;border:1px solid #d8d9dc;border-radius:12px;box-shadow:0 16px 50px rgba(20,20,30,.12);background:#fff;transition:max-width .22s ease,width .22s ease}',
    '.visual-studio-v2 .visual-preview-stage iframe{flex:0 0 auto;margin-inline:auto;height:100%;min-height:680px;max-height:none;border:1px solid #d8d9dc;border-radius:12px;box-shadow:0 16px 50px rgba(20,20,30,.12);background:#fff;transition:max-width .22s ease,width .22s ease}','iframe');
  text=one(text,
    '.visual-studio-v2 .visual-preview-stage[data-device=mobile] iframe{width:390px;max-width:390px}.visual-studio-v2 .visual-preview-stage[data-device=tablet] iframe{width:768px;max-width:768px}.visual-studio-v2 .visual-preview-stage[data-device=desktop] iframe{width:100%;max-width:1440px}',
    '.visual-studio-v2 .visual-preview-stage[data-device=mobile] iframe{width:390px;min-width:390px;max-width:390px}.visual-studio-v2 .visual-preview-stage[data-device=tablet] iframe{width:768px;min-width:768px;max-width:768px}.visual-studio-v2 .visual-preview-stage[data-device=desktop] iframe{width:100%;min-width:1025px;max-width:1440px}','device widths');
  text=one(text,
    '.visual-studio-v2 .visual-preview-stage[data-device=mobile] iframe{width:min(390px,100%);max-width:100%}',
    '.visual-studio-v2 .visual-preview-stage[data-device=mobile] iframe{width:390px;min-width:390px;max-width:390px}','mobile narrow');
  write(rel,text);
}

{
  const rel='js/admin/appearance/editor-visual-admin.js';
  let text=read(rel);
  text=one(text,
    'css/admin/visual-studio-v2.css?v=tintin-20260812-preview-arriba-1',
    `css/admin/visual-studio-v2.css?v=${NEW_VERSION}`,'css cache tag');
  write(rel,text);
}

{
  const rel='admin.html';
  let text=read(rel);
  text=one(text,
    'js/admin/appearance/editor-visual-admin.js?v=tintin-20260812-apariencia-seleccion-1',
    `js/admin/appearance/editor-visual-admin.js?v=${NEW_VERSION}`,'admin js cache tag');
  write(rel,text);
}

{
  const rel='tests/visual-builder/apariencia-preview-abajo.spec.js';
  let text=read(rel);
  text=one(text,
    '        stage: rect(stage), iframe: rect(iframe),\n        bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,',
    '        stage: rect(stage), iframe: rect(iframe),\n        stageScrollWidth: stage.scrollWidth, stageClientWidth: stage.clientWidth,\n        bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,','test geometry');
  text=one(text,
    '    expect(geometry.iframe.width).toBeLessThanOrEqual(geometry.stage.width + 1);',
    '    expect(geometry.iframe.width).toBeGreaterThanOrEqual(1024);\n    expect(geometry.stageScrollWidth).toBeGreaterThanOrEqual(Math.floor(geometry.iframe.width));','test shrink assertion');
  text += `\n\ntest('Preview usa breakpoints reales de celular, tablet y escritorio', async ({ page }) => {\n  await page.setViewportSize({ width: 640, height: 900 });\n  await page.setContent(html);\n  const stage = page.locator('.visual-preview-stage');\n  const iframe = page.locator('.visual-preview-stage iframe');\n  await iframe.evaluate(node => { node.style.transition = 'none'; });\n  const previewFrame = page.frames().find(frame => frame.parentFrame() === page.mainFrame());\n  expect(previewFrame).toBeTruthy();\n  const measure = async device => {\n    await stage.evaluate((node, value) => { node.dataset.device = value; }, device);\n    await page.waitForTimeout(20);\n    return previewFrame.evaluate(() => ({\n      width: window.innerWidth,\n      mobile: window.matchMedia('(max-width: 767px)').matches,\n      tablet: window.matchMedia('(min-width: 768px) and (max-width: 1024px)').matches,\n      desktop: window.matchMedia('(min-width: 1025px)').matches,\n    }));\n  };\n  const mobile = await measure('mobile');\n  expect(mobile.width).toBe(390);\n  expect(mobile.mobile).toBe(true);\n  const tablet = await measure('tablet');\n  expect(tablet.width).toBe(768);\n  expect(tablet.tablet).toBe(true);\n  expect(tablet.mobile).toBe(false);\n  expect(tablet.desktop).toBe(false);\n  const tabletScroll = await stage.evaluate(node => ({ scrollWidth: node.scrollWidth, clientWidth: node.clientWidth }));\n  expect(tabletScroll.scrollWidth).toBeGreaterThan(tabletScroll.clientWidth);\n  const desktop = await measure('desktop');\n  expect(desktop.width).toBeGreaterThanOrEqual(1025);\n  expect(desktop.desktop).toBe(true);\n  expect(desktop.tablet).toBe(false);\n});\n`;
  write(rel,text);
}

{
  const rel='package.json';
  let text=read(rel);
  text=one(text,
    '"test:visual-builder-ui": "playwright test tests/visual-builder/visual-builder-ui.spec.js tests/visual-builder/visual-builder-runtime.spec.js --project=chromium"',
    '"test:visual-builder-ui": "playwright test tests/visual-builder/visual-builder-ui.spec.js tests/visual-builder/visual-builder-runtime.spec.js tests/visual-builder/apariencia-preview-abajo.spec.js --project=chromium"','visual builder ui script');
  write(rel,text);
}

console.log('Viewport real aplicado sobre main actual.');
