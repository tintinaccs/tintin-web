#!/usr/bin/env node
'use strict';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const css = fs.readFileSync(path.join(root, 'css/admin/shopify-commerce-admin.css'), 'utf8');
const rows = Array.from({ length: 14 }, (_, index) => `<tr data-open="order" data-id="order-${index}">
  <td class="checkcol" data-label="Seleccionar"><input type="checkbox"></td>
  <td data-label="Pedido"><div class="tt-commerce-maintext">#TINPED-${1024 - index}</div><div class="tt-commerce-subtext">${index + 1} artículos</div></td>
  <td data-label="Fecha">17/09/2026</td>
  <td data-label="Cliente"><div class="tt-commerce-maintext">Cliente de prueba ${index + 1}</div><div class="tt-commerce-subtext">cliente${index + 1}@example.com</div></td>
  <td data-label="Canal">Tienda web</td>
  <td data-label="Pago"><span class="tt-commerce-badge success">Pagado</span></td>
  <td data-label="Preparación"><span class="tt-commerce-badge warning">En preparación</span></td>
  <td class="tt-commerce-number" data-label="Artículos">${index + 1}</td>
  <td data-label="Entrega"><span class="tt-commerce-delivery">Delivery · San Lorenzo</span></td>
  <td data-label="Total"><span class="tt-commerce-money">135.000 Gs</span></td>
  <td data-label="Acciones"><button type="button" class="tt-commerce-iconbtn" aria-label="Acciones">⋯</button></td>
</tr>`).join('');

const fixture = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
:root{--admin-color-brand:#AD3F67;--admin-color-brand-hover:#8B2642;--admin-color-background-page:#FFF6FA;--admin-color-background-surface:#fff;--admin-color-background-sidebar-active:#FDECF2;--admin-color-border:#F1E4E7;--admin-color-text-primary:#2B2B2B;--admin-color-text-secondary:#7B6F72;--admin-color-text-title:#2B2B2B;--admin-color-table-header-background:#FDECF2;--admin-color-table-row-hover:#FFF9FC;--admin-color-badge-background:#FDECF2;--admin-color-badge-text:#AD3F67;--admin-color-success-background:#e0f5e6;--admin-color-success-text:#166534;--admin-color-warning-background:#fff3e0;--admin-color-warning-text:#bf360c}
*{box-sizing:border-box}html,body{margin:0;max-width:100%;overflow-x:hidden}body{background:var(--admin-color-background-page);font-family:Montserrat}.adm-main{margin-left:260px}.adm-content{width:100%;max-width:1280px;margin:0 auto;padding:24px}.tt-commerce-shell{width:100%}
</style><style>${css}</style></head><body><main class="adm-main"><div class="adm-content"><section class="tt-commerce-shell"><div class="tt-commerce-pagehead"><div class="tt-commerce-titlegroup"><h1 class="tt-commerce-title">Pedidos <span class="tt-commerce-count">14</span></h1><div class="tt-commerce-subtitle">Pago, preparación, entrega y datos del pedido en una sola vista.</div></div><div class="tt-commerce-actions"><button class="tt-commerce-btn">Exportar</button><button class="tt-commerce-btn primary">Nuevo pedido</button></div></div><div class="tt-commerce-order-metrics">${Array.from({length:6},(_,i)=>`<div><strong>${i+1}</strong><span>Métrica ${i+1}</span></div>`).join('')}</div><div class="tt-commerce-card"><div class="tt-commerce-tabs"><button class="tt-commerce-tab active">Todos <span class="n">14</span></button><button class="tt-commerce-tab">Sin pagar</button><button class="tt-commerce-tab">Sin entregar</button><button class="tt-commerce-tab">Entregados</button><button class="tt-commerce-tab">Cancelados</button><button class="tt-commerce-tab">Reembolsados</button></div><div class="tt-commerce-toolbar"><label class="tt-commerce-search"><input class="tt-commerce-input" placeholder="Buscar"></label><select class="tt-commerce-select"><option>Todos los estados</option></select><select class="tt-commerce-select"><option>Todos los pagos</option></select><select class="tt-commerce-select"><option>Más recientes</option></select></div><div class="tt-commerce-tablewrap"><table class="tt-commerce-table tt-commerce-orders-table"><thead><tr><th class="checkcol">✓</th><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Canal</th><th>Pago</th><th>Preparación</th><th>Artículos</th><th>Entrega</th><th>Total</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="tt-commerce-footer"><span>Mostrando 14 de 14 pedidos cargados</span><span>Datos de prueba</span><button class="tt-commerce-btn">Cargar más pedidos</button></div></div></section></div></main><aside class="tt-commerce-drawer"><div class="tt-commerce-drawer-head"><h3 class="tt-commerce-drawer-title">Pedido #TINPED-1024</h3></div></aside></body></html>`;

const viewports = [
  [1440, 900], [1366, 768], [1200, 900], [1024, 768], [900, 900],
  [820, 1180], [768, 1024], [600, 900], [480, 900], [390, 844]
];

function columns(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length;
}

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
const results = [];
try {
  for (const [width, height] of viewports) {
    const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.setContent(fixture, { waitUntil: 'load' });
    const state = await page.evaluate(() => {
      const wrap = document.querySelector('.tt-commerce-tablewrap');
      const table = document.querySelector('.tt-commerce-orders-table');
      const toolbar = document.querySelector('.tt-commerce-toolbar');
      const row = document.querySelector('.tt-commerce-orders-table tbody tr');
      const first = row?.querySelector('td:nth-child(1)');
      const second = row?.querySelector('td:nth-child(2)');
      const drawer = document.querySelector('.tt-commerce-drawer');
      return {
        docWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        tableDisplay: getComputedStyle(table).display,
        rowDisplay: getComputedStyle(row).display,
        wrapOverflow: getComputedStyle(wrap).overflowX,
        wrapClientWidth: wrap.clientWidth,
        wrapScrollWidth: wrap.scrollWidth,
        toolbarColumns: getComputedStyle(toolbar).gridTemplateColumns,
        firstPosition: getComputedStyle(first).position,
        secondPosition: getComputedStyle(second).position,
        labelCount: row ? row.querySelectorAll('td[data-label]').length : 0,
        drawerWidth: drawer?.getBoundingClientRect().width || 0
      };
    });
    const issues = [];
    if (state.docWidth > width + 2 || state.bodyWidth > width + 2) issues.push(`overflow global ${state.docWidth}/${state.bodyWidth} > ${width}`);
    if (width > 900) {
      if (state.tableDisplay !== 'table') issues.push(`tabla desktop no es table: ${state.tableDisplay}`);
      if (state.firstPosition !== 'sticky' || state.secondPosition !== 'sticky') issues.push('checkbox/pedido no quedan fijados');
      if (width <= 1366 && state.wrapScrollWidth <= state.wrapClientWidth) issues.push('falta scroll interno de tabla');
    } else {
      if (state.tableDisplay !== 'block' || state.rowDisplay !== 'grid') issues.push(`tablet/mobile no reorganiza tarjetas: table=${state.tableDisplay}, row=${state.rowDisplay}`);
      if (state.labelCount !== 11) issues.push(`faltan etiquetas de datos: ${state.labelCount}/11`);
    }
    if (width <= 600 && columns(state.toolbarColumns) !== 1) issues.push(`toolbar mobile no apilada: ${state.toolbarColumns}`);
    if (state.drawerWidth > width + 1) issues.push(`drawer ${state.drawerWidth} > viewport ${width}`);
    results.push({ width, height, state, issues, ok: issues.length === 0 });
    await context.close();
  }
} finally {
  await browser.close();
}

for (const result of results) console.log(`${result.ok ? 'OK' : 'FAIL'} — Admin responsive ${result.width}x${result.height}${result.issues.length ? ` · ${result.issues.join('; ')}` : ''}`);
if (results.some(result => !result.ok)) process.exit(1);
console.log(`\nResponsive Super Admin: CORRECTO · ${results.length}/${results.length} viewports.`);


// Shell real del panel: sidebar/topbar/content. Esta segunda matriz evita que
// una regla responsive posterior vuelva a pisar otra sin que el fixture de
// tablas de comercio lo detecte.
const adminShellCss = fs.readFileSync(path.join(root, 'css/admin/admin.css'), 'utf8');
const shellViewports = [
  [1920, 1080], [1440, 900], [1280, 800], [1024, 768],
  [900, 900], [820, 1180], [768, 1024], [600, 900],
  [540, 900], [430, 932], [390, 844], [375, 812], [360, 800], [320, 720]
];

const shellFixture = `<!doctype html><html class="adm-auth-ready"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}html,body{margin:0;width:100%;max-width:100%;overflow-x:hidden}
:root{--admin-color-background-sidebar:#fff;--admin-color-background-sidebar-active:#FDECF2;--admin-color-text-sidebar:#2B2B2B;--admin-color-background-page:#FFF6FA;--admin-color-background-surface:#fff;--admin-color-brand:#AD3F67;--admin-color-text-primary:#2B2B2B;--admin-color-text-secondary:#7B6F72;--admin-color-text-title:#2B2B2B;--admin-color-border:#F1E4E7;--admin-color-table-row-hover:#FFF9FC;--rose:#8B2642}
.adm-notifications-button{width:46px;height:46px;border:0;border-radius:50%}
</style><style>${adminShellCss}</style></head><body>
<aside class="adm-sidebar" id="adm-sidebar">
  <div class="adm-sidebar-logo"><div class="adm-sidebar-logo-text">TINTIN</div><div class="adm-sidebar-logo-sub">Panel de administración</div><button class="adm-sidebar-toggle" type="button">‹</button></div>
  <div class="adm-user-info"><div class="adm-user-avatar">TT</div><div><div class="adm-user-name">Tintin Accesorios y Relojes</div><span class="adm-user-role-badge role-superadmin">SUPER ADMIN</span><div class="adm-live-clock">24/09/2026 · 14:30</div></div></div>
  <nav class="adm-nav">${Array.from({length:12},(_,i)=>`<button class="adm-nav-item${i===2?' active':''}" type="button"><span class="adm-nav-icon">◆</span><span>Sección ${i+1}</span></button>`).join('')}</nav>
</aside>
<main class="adm-main">
  <header class="adm-topbar">
    <div class="adm-topbar-title">Productos</div>
    <div class="adm-topbar-actions"><div class="adm-notifications-wrap"><button class="adm-notifications-button" type="button">○</button></div><a class="adm-topbar-btn" href="#">+ Nuevo pedido</a></div>
  </header>
  <div class="adm-content"><section class="adm-section active"><div class="adm-card"><div class="adm-card-body"><h1>Productos</h1><p>Contenido del panel sin superposición.</p></div></div></section></div>
</main>
<nav class="adm-mobile-tabs" id="adm-mobile-tabs"><button class="adm-mobile-tab" data-mobile-primary>Inicio</button><button class="adm-mobile-tab" data-mobile-primary>Productos</button><button class="adm-mobile-tab" id="adm-mobile-more-toggle">Más</button></nav>
</body></html>`;

const shellBrowser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH } : {}) });
const shellResults = [];
try {
  for (const [width, height] of shellViewports) {
    const context = await shellBrowser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.setContent(shellFixture, { waitUntil: 'load' });
    if (width >= 541 && width <= 900) {
      await page.evaluate(() => document.documentElement.classList.add('adm-sidebar-is-collapsed'));
      await page.hover('.adm-sidebar');
    }
    const state = await page.evaluate(() => {
      const box = selector => document.querySelector(selector)?.getBoundingClientRect() || null;
      const sidebar = document.querySelector('.adm-sidebar');
      const tabs = document.querySelector('.adm-mobile-tabs');
      const main = box('.adm-main');
      const side = box('.adm-sidebar');
      const logo = box('.adm-sidebar-logo');
      const user = box('.adm-user-info');
      const title = box('.adm-topbar-title');
      const actions = box('.adm-topbar-actions');
      return {
        docWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        sidebarDisplay: sidebar ? getComputedStyle(sidebar).display : 'missing',
        sidebarWidth: side?.width || 0,
        mainLeft: main?.left || 0,
        mobileTabsDisplay: tabs ? getComputedStyle(tabs).display : 'missing',
        logoBottom: logo?.bottom || 0,
        userTop: user?.top || 0,
        titleRight: title?.right || 0,
        titleLeft: title?.left || 0,
        actionsLeft: actions?.left || 0,
        actionsRight: actions?.right || 0,
      };
    });
    const issues = [];
    if (state.docWidth > width + 2 || state.bodyWidth > width + 2) issues.push(`overflow global ${state.docWidth}/${state.bodyWidth} > ${width}`);
    if (width > 900) {
      if (Math.abs(state.sidebarWidth - 260) > 2) issues.push(`sidebar desktop ${state.sidebarWidth}px, esperado 260px`);
      if (state.mainLeft < 258) issues.push(`main desktop invade sidebar: left=${state.mainLeft}`);
      if (state.mobileTabsDisplay !== 'none') issues.push('tabs móviles visibles en desktop');
    } else if (width >= 541) {
      if (Math.abs(state.sidebarWidth - 84) > 2) issues.push(`rail tablet ${state.sidebarWidth}px, esperado 84px`);
      if (state.mainLeft < 82) issues.push(`main tablet invade rail: left=${state.mainLeft}`);
      if (state.logoBottom > state.userTop + 1) issues.push(`logo y usuario se pisan: ${state.logoBottom} > ${state.userTop}`);
      if (state.mobileTabsDisplay !== 'none') issues.push('tabs móviles visibles en tablet');
    } else {
      if (state.sidebarDisplay !== 'none') issues.push(`sidebar visible en mobile: ${state.sidebarDisplay}`);
      if (Math.abs(state.mainLeft) > 1) issues.push(`main mobile desplazado: left=${state.mainLeft}`);
      if (state.mobileTabsDisplay === 'none') issues.push('tabs móviles ocultas');
    }
    if (state.titleRight > state.actionsLeft + 1 && state.titleLeft < state.actionsRight - 1) {
      issues.push(`título y acciones se superponen: titleRight=${state.titleRight}, actionsLeft=${state.actionsLeft}`);
    }
    shellResults.push({ width, height, state, issues, ok: issues.length === 0 });
    await context.close();
  }
} finally {
  await shellBrowser.close();
}

for (const result of shellResults) console.log(`${result.ok ? 'OK' : 'FAIL'} — Admin shell ${result.width}x${result.height}${result.issues.length ? ` · ${result.issues.join('; ')}` : ''}`);
if (shellResults.some(result => !result.ok)) process.exit(1);
console.log(`\nShell responsive Super Admin: CORRECTO · ${shellResults.length}/${shellResults.length} viewports.`);
