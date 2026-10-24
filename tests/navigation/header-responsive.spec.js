const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

test('cada ancho carga el comportamiento del encabezado visible una sola vez', async ({ page }) => {
  const requests = [];
  page.on('request', request => {
    const name = new URL(request.url()).pathname.split('/').pop();
    if (['indicador-navegacion-escritorio.js', 'control-menu-tableta.js', 'indicador-navegacion-movil.js'].includes(name)) requests.push(name);
  });
  await openPublicPage(page, { width: 1025, height: 900 }, '/about');
  await expect.poll(() => requests).toEqual(['indicador-navegacion-escritorio.js']);
  await page.setViewportSize({ width: 768, height: 900 });
  await expect.poll(() => requests).toEqual(['indicador-navegacion-escritorio.js', 'control-menu-tableta.js']);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect.poll(() => requests).toEqual(['indicador-navegacion-escritorio.js', 'control-menu-tableta.js', 'indicador-navegacion-movil.js']);
  await page.setViewportSize({ width: 1120, height: 900 });
  await expect(page.locator('#tt-header-desktop-tablet')).toBeVisible();
  await expect(page.locator('#tt-header-tablet')).toBeHidden();
  expect(requests).toEqual(['indicador-navegacion-escritorio.js', 'control-menu-tableta.js', 'indicador-navegacion-movil.js']);
});

// Geometry and image-origin assertions need the complete unified category menu.
// This is a UI fixture, independent of the product-hydration server fixture.
test.beforeEach(async ({ page }) => {
  const categories = ['bolsos', 'relojes', 'aros', 'collares', 'pulseras', 'anillos', 'tobilleras', 'brazaletes', 'earcuff', 'armcuff', 'gafas', 'joyeros'];
  await page.route('**/api/public-catalog?resource=collections*', route => route.fulfill({
    json: { ok: true, resource: 'collections', items: categories.map(id => ({
      id, data: { name: id, visible: true, image: `/assets-tintin/images/collections/col-${id === 'bolsos' ? 'bags' : id}.webp` }
    })) }
  }));
});

test('los paneles comparten la URL canónica del logo del encabezado', async ({ page }) => {
  await mockGuestNavigation(page);
  await page.goto('/envios.html');
  const logos = page.locator('.tt-header-desktop .tt-logo-img, #cart-drawer .tt-drawer-brand-logo, #collections-sheet .tt-drawer-brand-logo, #account-drawer .tt-account-drawer-logo');
  await expect(logos).toHaveCount(4);
  const sources = await logos.evaluateAll(images => images.map(image => image.src));
  expect(new Set(sources).size).toBe(1);
  expect(new URL(sources[0]).pathname).toBe('/assets-tintin/images/general/logo.png');
});

// Estas dos pruebas verifican superficies, no Firebase. Una resolución real
// tardía podía ocultar la campana simulada o dejar el CTA en restauración.
async function mockGuestNavigation(page) {
  const source = file => fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8')
    .replace(/^import\s[\s\S]*?;\s*$/gm, '').replace(/^export /gm, '');
  await page.route('**/navegacion-autenticacion.js*', route => route.fulfill({
    contentType: 'text/javascript',
    body: source('js/pages/profile/estado-canonico-perfil.mjs') + `
      const auth = { currentUser: null }, db = {};
      const AUTH_STATES = { RESTORING: 'restoring', UNKNOWN: 'unknown' };
      const subscribeSession = callback => callback({ status: 'unauthenticated', user: null });
      const getSessionUser = () => null, readAuthHandoff = () => null;
      const createAuthHandoff = () => {}, clearAuthHandoff = () => {};
      const recordAuthDiagnostic = () => {}, logoutSession = async () => {};
      const ROLES = { CLIENT: 'client' }, SUPER_ADMIN = 'owner@example.com';
      const can = () => false, sanitizeImageUrl = value => value;
      const doc = () => {}, onSnapshot = () => () => {};
    ` + source('js/core/auth/navegacion-autenticacion.js'),
  }));
}

async function mockNotificationData(page) {
  const code = fs.readFileSync(path.resolve(__dirname, '../../js/components/notifications/notificaciones-clientes.js'), 'utf8');
  await page.route('**/notificaciones-clientes.js*', route => route.fulfill({
    contentType: 'text/javascript',
    body: `
      const auth = { currentUser: null }, db = {}, appCheckReady = Promise.resolve();
      const subscribeAuthState = callback => { callback(null); return () => {}; };
      const recordAuthDiagnostic = () => {}, isSuperAdmin = () => false;
      const createLiveActivityNotices = () => ({ clear() {}, update() {} });
      const collection = () => {}, limit = () => {}, onSnapshot = () => () => {}, orderBy = () => {}, query = () => {};
    ` + code.replace(/^import\s[\s\S]*?;\s*$/gm, ''),
  }));
}

test('el acordeón del footer se carga al pasar de desktop a móvil y conserva sus enlaces', async ({ page }) => {
  const footerRequests = [];
  page.on('request', request => {
    if (request.url().includes('/acordeon-pie-pagina.js')) footerRequests.push(request.url());
  });
  await openPublicPage(page, { width: 1440, height: 900 }, '/cambios-devoluciones.html');
  expect(footerRequests).toHaveLength(0);
  await expect(page.locator('.tt-footer-col ul').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.locator('.tt-footer-accordion-toggle').first();
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.tt-footer-col ul').first()).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.tt-footer-col ul').first()).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.tt-footer-accordion-toggle')).toHaveCount(3);
  expect(footerRequests).toHaveLength(1);
});

for (const width of [320, 390, 767, 768, 1024, 1025, 1280, 1920]) {
  test(`foto de cuenta respeta el espacio del icono y del botón en ${width}px`, async ({ page }) => {
    await openPublicPage(page, { width, height: 900 });
    // Reproduce la capa tardía que se carga en producto/perfil, además del
    // estado autenticado de seis acciones; el caso con SVG no descubre este bug.
    await page.evaluate(async modulePath => {
      await import(modulePath);
      document.querySelector('#tabbar-notifications').hidden = false;
      const source = document.querySelector('.tt-logo-img,.tt-tablet-logo-img').src;
      for (const button of document.querySelectorAll('[data-auth-account-button],#tabbar-cuenta')) {
        const image = document.createElement('img');
        image.src = source;
        image.alt = 'Foto de prueba';
        image.className = button.id === 'tabbar-cuenta' ? 'tt-tabbar-avatar' : 'tt-account-avatar-btn';
        image.width = image.height = 24;
        button.dataset.ttAccountAvatar = 'true';
        const previous = button.querySelector('svg,img');
        if (previous) previous.replaceWith(image);
      }
    }, '/js/quality/estabilidad-final-publica.js');
    async function assertGeometry() {
      const result = await page.evaluate(() => {
        const visible = e => e.getBoundingClientRect().width > 0 && getComputedStyle(e).visibility !== 'hidden';
        const image = [...document.querySelectorAll('.tt-tabbar-avatar,.tt-account-avatar-btn')].find(visible);
        const button = image.closest('button,a');
        const shell = image.closest('#tt-tabbar,#tt-header-tablet,#tt-header-desktop-tablet');
        const icon = [...shell.querySelectorAll('svg')].find(e => visible(e) && e.closest('button,a')?.getAttribute('aria-label') !== 'Catálogo');
        const rect = e => { const r = e.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}; };
        return { image:rect(image), icon:rect(icon), button:rect(button), buttonInnerWidth:button.getBoundingClientRect().width-parseFloat(getComputedStyle(button).borderLeftWidth)-parseFloat(getComputedStyle(button).borderRightWidth), shell:rect(shell), radius:getComputedStyle(image).borderRadius, fit:getComputedStyle(image).objectFit, overflow:document.documentElement.scrollWidth > innerWidth };
      });
      if(width<768)expect(result.image.width).toBeLessThanOrEqual(26);
      else expect(result.image.width).toBeCloseTo(result.buttonInnerWidth,0);
      expect(result.image.width).toBeCloseTo(result.image.height, 1);
      if(width<768)expect(Math.abs(result.image.width - result.icon.width)).toBeLessThan(2);
      expect(result.radius).toBe('50%');
      expect(result.fit).toBe('cover');
      expect(result.button.width).toBeGreaterThanOrEqual(44);
      expect(result.button.height).toBeGreaterThanOrEqual(44);
      for (const bounds of [result.button, result.shell]) {
        expect(result.image.left).toBeGreaterThanOrEqual(bounds.left - 1);
        expect(result.image.right).toBeLessThanOrEqual(bounds.right + 1);
        expect(result.image.top).toBeGreaterThanOrEqual(bounds.top - 1);
        expect(result.image.bottom).toBeLessThanOrEqual(bounds.bottom + 1);
      }
      expect(result.overflow).toBe(false);
    }
    await assertGeometry();
    if (width < 768) {
      await page.evaluate(() => document.querySelector('#tt-tabbar').classList.add('tt-tabbar-compact'));
      await expect(page.locator('#tt-tabbar .tt-tabbar-avatar')).toHaveCSS('inline-size', '24px');
      await assertGeometry();
    }
  });
}

async function openPublicPage(page, viewport, path = '/index.html') {
  await page.setViewportSize(viewport);
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body.tt-public-shell-mounted');
  // The shell mounts before the stylesheet graph necessarily finishes. Wait
  // for the real CSS/font layout before taking geometry measurements; without
  // this, compact-vs-expanded can race and both states report the same width.
  await page.waitForLoadState('load');
  await page.evaluate(() => document.fonts?.ready);
  await page.evaluate(() => {
    document.documentElement.classList.remove('tt-color-scheme-pending', 'tt-store-gate-pending');
    window.TintinLoader?.hide?.();
  });
}

async function expectNoHorizontalOverlap(locator) {
  const boxes = await locator.evaluateAll(nodes => nodes
    .filter(node => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return !node.hidden && style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    })
    .map(node => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }));

  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const sameRow = a.top < b.bottom - 2 && a.bottom > b.top + 2;
      if (!sameRow) continue;
      expect(Math.min(a.right, b.right) - Math.max(a.left, b.left)).toBeLessThanOrEqual(2);
    }
  }
}

async function expectHeaderBrandHealthy(page) {
  const shell = page.locator('#tt-header-desktop-tablet,#tt-header-tablet,#tt-tablet-menu');
  await expect(shell.locator('.tt-img-error-label')).toHaveCount(0);
  const broken = await shell.locator('img:not([loading="lazy"]):not([data-src])').evaluateAll(images => images
    .filter(image => !image.complete || image.naturalWidth === 0)
    .map(image => ({ alt: image.alt, src: image.currentSrc || image.src })));
  expect(broken).toEqual([]);
  await expect(shell.locator('img[data-tt-shared-logo]')).toHaveCount(0);
}

test('mobile conserva etiquetas, admite Alertas y se compacta sin solaparse', async ({ page }) => {
  await openPublicPage(page, { width: 390, height: 844 });

  const nav = page.locator('#tt-tabbar');
  const visibleButtons = nav.locator('.tt-tabbar-btn:not([hidden])');
  const labels = nav.locator('.tt-tabbar-btn:not([hidden]) > span:last-child');
  await expect(nav).toBeVisible();
  await expect(nav.locator('.tt-tabbar-btn')).toHaveCount(6);
  await expect(visibleButtons).toHaveCount(5);
  await expect(nav.locator('#tabbar-notifications')).toBeHidden();
  await expect(labels).toHaveCount(5);
  await expect(labels.first()).toBeVisible();
  await expect(visibleButtons.nth(0)).toHaveAttribute('aria-label', 'Inicio');
  await expect(visibleButtons.nth(1)).toHaveAttribute('aria-label', 'Buscar');
  await expect(visibleButtons.nth(2)).toHaveAttribute('aria-label', 'Catálogo');

  // Simula el estado autenticado más exigente: aparecen las seis acciones.
  await nav.locator('#tabbar-notifications').evaluate(node => { node.hidden = false; });
  await expect(visibleButtons).toHaveCount(6);
  let columnCount = await nav.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  expect(columnCount).toBe(6);
  // Los botones transparentes dejan visible el halo; la barra sigue siendo sólida.
  await expect(nav).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(nav.locator('#tabbar-notifications')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expectNoHorizontalOverlap(nav.locator('.tt-tabbar-btn:not([hidden])'));

  // Respeta una configuración exclusiva de mobile: Inicio oculto. Con Alertas
  // visible deben quedar cinco columnas reales, no seis con un hueco fantasma.
  await page.evaluate(() => {
    document.documentElement.dataset.ttMobileHome = 'hidden';
    const home = document.querySelector('[data-shell-tab="home"]');
    if (home) home.hidden = true;
  });
  await expect(visibleButtons).toHaveCount(5);
  columnCount = await nav.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  expect(columnCount).toBe(5);
  await expectNoHorizontalOverlap(nav.locator('.tt-tabbar-btn:not([hidden])'));

  const expandedWidth = await nav.evaluate(node => node.getBoundingClientRect().width);
  await page.evaluate(() => window.scrollTo(0, 560));
  await expect(nav).toHaveClass(/tt-tabbar-compact/);
  await expect.poll(
    () => nav.evaluate(node => node.getBoundingClientRect().width),
    { timeout: 1500 },
  ).toBe(expandedWidth);
  await expect(visibleButtons.first()).toHaveCSS('min-height', '58px');
  await expect(labels.first()).toBeVisible();
  await expectNoHorizontalOverlap(nav.locator('.tt-tabbar-btn:not([hidden])'));

  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(nav).not.toHaveClass(/tt-tabbar-compact/);
  await expect(labels.first()).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 560));
  await expect(nav).toHaveClass(/tt-tabbar-compact/);
  await page.locator('#tabbar-tienda').click();
  await expect(nav).not.toHaveClass(/tt-tabbar-compact/);
  await expect(page.locator('#collections-sheet')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#collections-sheet a[href="/contact"]')).toBeVisible();
  await expect(page.locator('#btn-close-sheet')).toHaveCSS('width','44px');
  await expect(page.locator('#btn-close-sheet')).toBeFocused();
});

test('tablet reserva espacio para logo y cuatro acciones sin colisiones', async ({ page }) => {
  await openPublicPage(page, { width: 768, height: 1024 });

  await expect(page.locator('#tt-header-tablet')).toBeVisible();
  await expect(page.locator('#tt-header-desktop-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expect(page.locator('#tt-header-tablet .tt-tablet-logo-img')).toBeVisible();
  await expectHeaderBrandHealthy(page);
  await expect(page.locator('#btn-notifications-tablet')).toBeHidden();

  for (const control of await page.locator('#btn-menu-tablet,.tt-tablet-actions > button:not([hidden])').all()) {
    const box = await control.evaluate(node => node.getBoundingClientRect());
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }

  await page.locator('#btn-notifications-tablet').evaluate(node => { node.hidden = false; });
  await expect(page.locator('.tt-tablet-actions > button:not([hidden])')).toHaveCount(4);
  await expect(page.locator('#btn-notifications-tablet')).toHaveCSS('background-color', 'rgb(238, 241, 244)');

  const tabletGeometry = await page.evaluate(() => {
    const menu = document.getElementById('btn-menu-tablet').getBoundingClientRect();
    const logo = document.querySelector('.tt-tablet-logo-link').getBoundingClientRect();
    const actions = document.querySelector('.tt-tablet-actions').getBoundingClientRect();
    const header = document.getElementById('tt-header-tablet');
    return {
      menuRight: menu.right,
      logoLeft: logo.left,
      logoRight: logo.right,
      actionsLeft: actions.left,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
    };
  });
  expect(tabletGeometry.menuRight).toBeLessThanOrEqual(tabletGeometry.logoLeft);
  expect(tabletGeometry.logoRight).toBeLessThanOrEqual(tabletGeometry.actionsLeft);
  expect(tabletGeometry.scrollWidth).toBeLessThanOrEqual(tabletGeometry.clientWidth + 1);

  await page.locator('#btn-menu-tablet').click();
  await expect(page.locator('#tt-tablet-menu')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#btn-tablet-close')).toBeFocused();
  await expect(page.locator('#btn-tablet-close')).toHaveCSS('width','44px');
  await expect(page.locator('#btn-tablet-close')).toHaveCSS('border-radius','50%');
  await page.locator('#btn-tablet-tienda').click();
  await expect(page.locator('#tt-tablet-menu')).toHaveClass(/tt-tablet-shop-view/);
  await expect(page.locator('#tablet-cats .tt-tablet-cats-grid a')).toHaveCount(11);
  await expect(page.locator('#tablet-cats .tt-tablet-ver-todo')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#tt-tablet-menu')).toHaveAttribute('aria-hidden', 'true');
});

test('desktop conserva un solo indicador para Tienda y acciones sólidas', async ({ page }) => {
  await openPublicPage(page, { width: 1440, height: 900 });

  const header = page.locator('#tt-header-desktop-tablet');
  await expect(header).toBeVisible();
  await expect(page.locator('#tt-header-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await expect(header.locator('.tt-logo-img')).toBeVisible();
  await expectHeaderBrandHealthy(page);
  await expect(header.locator('[data-desktop-nav-item]')).toHaveCount(4);

  await page.locator('#btn-notifications').evaluate(node => { node.hidden = false; });
  await expect(page.locator('#btn-notifications')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expectNoHorizontalOverlap(header.locator('.tt-nav-desktop [data-desktop-nav-item],.tt-header-actions > button:not([hidden])'));

  await page.locator('#btn-tienda').click();
  const tiendaStyle = await page.locator('#btn-tienda').evaluate(node => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      boxShadow: style.boxShadow,
    };
  });
  expect(tiendaStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(tiendaStyle.borderTopColor).toBe('rgba(0, 0, 0, 0)');
  expect(tiendaStyle.boxShadow).toBe('none');

  const dropdown = page.locator('#tt-tienda-dropdown-panel');
  await expect(dropdown).toHaveAttribute('aria-hidden', 'false');
  await expect(dropdown.locator('a[href^="/catalogo?cat="], a[href^="catalogo.html?cat="]')).toHaveCount(11);
  const bounds = await dropdown.evaluate(node => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, viewport: document.documentElement.clientWidth };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(bounds.viewport);

  await page.keyboard.press('Escape');
  await page.locator('#btn-cuenta').click();
  const accountPanel = page.locator('#account-panel');
  await expect(accountPanel).toBeVisible();
  await expect.poll(async () => {
    const guestLinks = await accountPanel.locator('a[href="/login"], a[href="login.html"]').count();
    const neutralStatus = await accountPanel.locator('[role="status"]').count();
    if (guestLinks === 2) return 'guest';
    if (guestLinks === 0 && neutralStatus === 1) return 'session-restoring';
    return 'invalid';
  }, { timeout: 15000 }).toMatch(/^(guest|session-restoring)$/);
  const accountState = await accountPanel.evaluate(panel =>
    panel.querySelectorAll('a[href="/login"], a[href="login.html"]').length === 2
      ? 'guest'
      : 'session-restoring'
  );
  if (accountState === 'session-restoring') {
    await expect(accountPanel.locator('[role="status"]')).toContainText(/Comprobando tu sesión|No pudimos verificar tu sesión/);
    await expect(accountPanel.locator('a[href="/login"], a[href="login.html"]')).toHaveCount(0);
  }
  await expect(page.locator('#account-drawer')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});

test('desktop compacto 1025px reserva las cuatro acciones autenticadas', async ({ page }) => {
  await openPublicPage(page, { width: 1025, height: 768 });

  const header = page.locator('#tt-header-desktop-tablet');
  await expect(header).toBeVisible();
  await expect(page.locator('#tt-header-tablet')).toBeHidden();
  await expect(page.locator('#tt-tabbar')).toBeHidden();
  await page.locator('#btn-notifications').evaluate(node => { node.hidden = false; });
  await expect(page.locator('.tt-header-actions > button:not([hidden])')).toHaveCount(4);

  const geometry = await page.evaluate(() => {
    const logo = document.querySelector('#tt-header-desktop-tablet .tt-logo-link').getBoundingClientRect();
    const nav = document.getElementById('tt-nav-desktop-tablet').getBoundingClientRect();
    const actions = document.querySelector('#tt-header-desktop-tablet .tt-header-actions').getBoundingClientRect();
    const header = document.getElementById('tt-header-desktop-tablet');
    return {
      logoRight: logo.right,
      navLeft: nav.left,
      navRight: nav.right,
      actionsLeft: actions.left,
      scrollWidth: header.scrollWidth,
      clientWidth: header.clientWidth,
    };
  });

  expect(geometry.logoRight).toBeLessThanOrEqual(geometry.navLeft);
  expect(geometry.navRight).toBeLessThanOrEqual(geometry.actionsLeft);
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
  await expectNoHorizontalOverlap(header.locator('.tt-nav-desktop [data-desktop-nav-item],.tt-header-actions > button:not([hidden])'));
});

test('las imágenes de Tienda usan el mismo origen absoluto en desktop, tablet y mobile fuera de Inicio', async ({ page }) => {
  const cases = [
    { viewport: { width: 1440, height: 900 }, path: '/contact', open: '#btn-tienda', image: '#tt-tienda-dropdown-panel .tt-dropdown-icon img' },
    { viewport: { width: 768, height: 1024 }, path: '/product', open: '#btn-tablet-tienda', image: '#tablet-cats .tt-tablet-cat-img img', beforeOpen: '#btn-menu-tablet' },
    { viewport: { width: 390, height: 844 }, path: '/about', open: '#tabbar-tienda', image: '#collections-sheet .tt-sheet-item-img img' },
  ];

  for (const entry of cases) {
    await openPublicPage(page, entry.viewport, entry.path);
    if (entry.beforeOpen) await page.locator(entry.beforeOpen).click();
    await page.locator(entry.open).click();
    const images = page.locator(entry.image);
    await expect(images.first()).toBeVisible();
    const sources = await images.evaluateAll(nodes => nodes.map(node => new URL(node.getAttribute('src'), location.href).pathname));
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.every(source => source.startsWith('/assets-tintin/images/collections/'))).toBe(true);
  }
});

for (const [width,height] of [[390,844],[667,375],[768,1024],[1024,768],[1440,900]]) test(`Alertas usa la superficie compartida sólida y conserva el foco ${width}x${height}`, async ({ page }) => {
  await mockGuestNavigation(page);
  await mockNotificationData(page);
  await openPublicPage(page, { width, height }, '/contact');
  await expect(page.locator('#account-panel .tt-account-primary')).toBeAttached();

  // El evento representa la resolución autenticada del coordinador sin
  // depender de una cuenta ni de datos remotos para probar la superficie.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('tintin:auth-nav-updated', {
      detail: { authenticated: true },
    }));
  });

  const trigger = page.locator(width < 768 ? '#tabbar-notifications' : width <= 1024 ? '#btn-notifications-tablet' : '#btn-notifications');
  await expect(trigger).toBeVisible();
  await trigger.click();

  const drawer = page.locator('#notifications-drawer');
  await expect(drawer).toHaveAttribute('aria-hidden', 'false');
  await expect(drawer.locator('#btn-notifications-close')).toBeFocused();
  await expect(drawer).toHaveCSS('z-index', '1460');
  await expect(drawer).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(drawer).toHaveCSS('background-image', 'none');

  await page.evaluate(() => {
    window.hiddenWithFocus = [];
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function(name, value) {
      if (name === 'aria-hidden' && value === 'true' && this.contains(document.activeElement)) {
        window.hiddenWithFocus.push(this.id);
      }
      return setAttribute.call(this, name, value);
    };
  });
  for (const close of ['escape', 'button']) {
    if (close === 'escape') await page.keyboard.press('Escape');
    else await drawer.locator('#btn-notifications-close').click();
    await expect(drawer).toHaveAttribute('aria-hidden', 'true');
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => window.hiddenWithFocus)).toEqual([]);
    if (close === 'escape') {
      await trigger.click();
      await expect(drawer.locator('#btn-notifications-close')).toBeFocused();
    }
  }
});

test('cuenta mantiene cabecera rosa con logo y título blancos centrados y CTA legible', async ({ page }) => {
  await mockGuestNavigation(page);
  for (const viewport of [{width:1920,height:1080},{width:1440,height:900},{width:1280,height:720},{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:320,height:568}]) {
    await openPublicPage(page, viewport, '/contact');
    await page.waitForFunction(() => [...document.querySelectorAll('link[rel="stylesheet"],link[data-tt-style-bundle]')].some(link =>
      link.href.includes('pulido-marca-responsive-tintin.css') &&
      (link.disabled && link.dataset.ttStyleBundle ? document.getElementById(link.dataset.ttStyleBundle) : link)?.sheet));
    const trigger = viewport.width < 768 ? '#tabbar-cuenta' : viewport.width <= 1024 ? '#btn-cuenta-tablet' : '#btn-cuenta';
    await page.locator(trigger).click();
    const drawer=page.locator('#account-drawer');
    await expect(drawer).toBeVisible();
    const header=drawer.locator('.tt-account-drawer-header');
    await expect(header).toHaveCSS('background-image','none');
    await expect(header).toHaveCSS('background-color','rgb(248, 170, 202)');
    await expect(header.locator('h2')).toHaveCSS('color','rgb(255, 255, 255)');
    await expect(drawer.locator('.tt-account-primary')).toHaveCSS('color','rgb(34, 34, 34)');
    await expect(header.locator('.tt-account-drawer-logo')).toBeVisible();
    await expect(header.locator('.tt-account-drawer-logo')).toHaveCSS('filter','brightness(0) invert(1)');
    const overlap=await header.evaluate(el => { const logo=getComputedStyle(el,'::before'); const title=el.querySelector('h2').getBoundingClientRect(); const close=el.querySelector('button').getBoundingClientRect(); const box=el.getBoundingClientRect(); return {duplicateLogo:logo.content,titleRight:title.right,closeLeft:close.left,centerOffset:Math.abs(title.x+title.width/2-(box.x+box.width/2))}; });
    expect(overlap.duplicateLogo).toBe('none');
    expect(overlap.titleRight).toBeLessThanOrEqual(overlap.closeLeft);
    expect(overlap.centerOffset).toBeLessThanOrEqual(1);
    await page.keyboard.press('Escape');
  }
});


for(const route of ['/catalogo?cat=pulseras','/collections','/about','/contact','/envios','/preguntas-frecuentes','/privacidad'])for(const [width,height]of [[320,700],[390,844],[768,1024],[1024,768],[1440,900]])test(`encabezado global compacto y cuenta clara: ${route} ${width}`,async({page})=>{
 await mockGuestNavigation(page);await openPublicPage(page,{width,height},route);
 if(width<768){const brand=page.locator('#tt-mobile-brand');await expect(brand).toBeVisible();expect((await brand.boundingBox()).height).toBeLessThanOrEqual(70);}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 const button=page.locator(width<768?'#tabbar-cuenta':width<=1024?'#btn-cuenta-tablet':'#btn-cuenta');
 await button.evaluate((el,mobile)=>{const image=document.createElement('img');image.className=mobile?'tt-tabbar-avatar':'tt-account-avatar-btn';image.alt='Foto clara';image.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><path fill="white" d="M0 0h48v48H0z"/></svg>');image.width=mobile?24:48;image.height=mobile?24:48;el.querySelector('svg')?.replaceWith(image);},width<768);
 await expect(button.locator('img')).toHaveCSS('border-top-color','rgb(34, 34, 34)');expect(await button.locator('img').evaluate(el=>parseFloat(getComputedStyle(el).borderTopWidth))).toBeGreaterThanOrEqual(1);
 if(route.startsWith('/catalogo')&&width<768){await page.waitForFunction(()=>document.querySelector('.cat-hero')?.hasAttribute('data-tt-flow-block'));const layer=await page.locator('.cat-hero > [data-tt-flow-background]').boundingBox(),tabs=await page.locator('#cat-tabs-mobile').boundingBox();expect(layer.y+layer.height).toBeLessThanOrEqual(tabs.y+1);}
 if(route.startsWith('/catalogo')&&width===390)await page.screenshot({path:test.info().outputPath('global-corregido-390.png')});
});

for (const [width, height] of [[320,568],[350,724],[390,844],[600,960],[768,1024],
  [769,1024],[844,390],[1024,768],[1025,768],[1440,900],[2560,1440]]) {
  test(`catálogo compacto conserva categorías y márgenes ${width}x${height}`, async ({ page }) => {
    await mockGuestNavigation(page);
    await openPublicPage(page, { width, height }, '/catalogo?cat=bags');
    const header = page.locator(width < 768 ? '#tt-mobile-brand' : width <= 1024 ? '#tt-header-tablet' : '#tt-header-desktop-tablet');
    const hero = page.locator('.cat-hero');
    const headerBox = await header.boundingBox(), heroBox = await hero.boundingBox();
    const gap = heroBox.y - (headerBox.y + headerBox.height);
    expect(gap).toBeGreaterThanOrEqual(0);
    expect(gap).toBeLessThanOrEqual(32);
    const nav = page.locator('#cat-tabs-mobile');
    if (await nav.isVisible()) {
      const navBox = await nav.boundingBox(), subtitle = await page.locator('#cat-subtitulo').boundingBox();
      expect(navBox.y - (subtitle.y + subtitle.height)).toBeLessThanOrEqual(28);
      const filter = await page.locator('#filter-toggle').boundingBox();
      expect(filter.y - (navBox.y + navBox.height)).toBeGreaterThanOrEqual(8);
      expect(filter.y - (navBox.y + navBox.height)).toBeLessThanOrEqual(16);
      expect(filter.height).toBeGreaterThanOrEqual(44);
      await page.waitForFunction(() => document.querySelector('.cat-hero > [data-tt-flow-background]'));
      const paint = await page.locator('.cat-hero > [data-tt-flow-background]').boundingBox();
      expect(paint.y + paint.height).toBeLessThanOrEqual(navBox.y + 1);
    } else {
      const layout = await page.locator('.cat-layout').boundingBox();
      expect(layout.y - (heroBox.y + heroBox.height)).toBeGreaterThanOrEqual(8);
      expect(layout.y - (heroBox.y + heroBox.height)).toBeLessThanOrEqual(24);
    }
    if ([350,1440].includes(width)) await page.screenshot({ path: test.info().outputPath('catalogo-compacto.png') });
    await page.locator('#cat-titulo').evaluate(n => { n.textContent = 'Bags y accesorios para acompañarte todos los días'; });
    // El fondo del hero ocupa deliberadamente todo el viewport. Medir el
    // contenido del título distingue ese sangrado de un texto recortado.
    expect(await page.locator('#cat-titulo').evaluate(n => n.scrollWidth <= n.clientWidth + 1)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const [width, height] of [[320,375],[320,700],[390,844],[667,375],[768,1024],[844,390],[1024,768],[1180,820],[1366,768],[1440,900],[1920,1080]]) {
  test(`paneles del header: acciones, foco y límites ${width}x${height}`, async ({ page }) => {
    await mockGuestNavigation(page);
    await openPublicPage(page, { width, height }, '/envios');
    const mobile = width < 768, tablet = width <= 1024;
    const actions = [
      [mobile ? '#tabbar-tienda' : tablet ? '#btn-menu-tablet' : '#btn-tienda', mobile ? '#collections-sheet' : tablet ? '#tt-tablet-menu' : '#tt-tienda-dropdown-panel'],
      [mobile ? '#tabbar-search' : tablet ? '#btn-search-tablet' : '#btn-search', '#search-panel'],
      [mobile ? '#tabbar-cart' : tablet ? '#btn-cart-tablet' : '#btn-cart', '#cart-drawer'],
      [mobile ? '#tabbar-cuenta' : tablet ? '#btn-cuenta-tablet' : '#btn-cuenta', '#account-drawer'],
    ];
    for (const [trigger, panel] of actions) {
      await page.locator(trigger).click();
      await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('open');
      await expect(page.locator(panel)).toHaveAttribute('aria-hidden','false');
      const bounds = await page.locator(panel).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(-1);
      expect(bounds.y).toBeGreaterThanOrEqual(-1);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height + 1);
      if (mobile) {
        const nav = await page.locator('#tt-tabbar').boundingBox();
        expect(bounds.y + bounds.height).toBeLessThanOrEqual(nav.y);
        await expect(page.locator(panel)).toHaveCSS('border-top-left-radius','24px');
        await expect(page.locator(panel)).toHaveCSS('border-color','rgb(253, 236, 242)');
        if (panel === '#collections-sheet') {
          for (const link of await page.locator('#collections-sheet .tt-sheet-footer a').all()) {
            await expect(link).toBeVisible();
            await link.click({trial:true});
          }
        }
      }
      if (panel === '#search-panel') await expect(page.locator('#search-input')).toBeFocused();
      if (width === 390 && panel === '#collections-sheet') await page.screenshot({ path:test.info().outputPath('mobile-dropup.png') });
      await page.keyboard.press('Escape');
      await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('idle');
      await expect(page.locator(trigger)).toBeFocused();
      expect(await page.evaluate(() => document.documentElement.classList.contains('tt-surface-locked'))).toBe(false);
    }
  });
}

test('el dropup anima, permite cambiar durante el cierre y libera el fondo', async ({ page }) => {
  await mockGuestNavigation(page);
  await openPublicPage(page,{width:390,height:844},'/envios');
  await page.evaluate(() => {
    window.__sheetFrames = [];
    const element = document.getElementById('collections-sheet');
    const animate = element.animate.bind(element);
    element.animate = (frames, options) => {
      window.__sheetFrames.push(frames);
      return animate(frames, options);
    };
  });
  await page.locator('#tabbar-tienda').click();
  await expect.poll(() => page.evaluate(() => window.__sheetFrames.flat().some(k => k.translate === '0 100%'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('open');
  await page.locator('#tabbar-search').click();
  await page.locator('#tabbar-cuenta').click();
  await expect.poll(() => page.evaluate(() => [window.TintinSurfaceController.surface,window.TintinSurfaceController.state])).toEqual(['account','open']);
  await expect(page.locator('[data-tt-surface].open')).toHaveCount(1);
  for (const key of ['Tab', 'Shift+Tab']) {
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press(key);
      expect(await page.evaluate(() => !!document.activeElement.closest('#account-drawer,#tt-tabbar,#tt-privacy-consent'))).toBe(true);
    }
  }
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('idle');
  expect(await page.locator('.tt-footer').evaluate(el => !!el.closest('[inert]'))).toBe(false);
});

test('búsqueda se adapta al teclado y cierra al cruzar de dispositivo', async ({ page }) => {
  await mockGuestNavigation(page);
  await openPublicPage(page,{width:390,height:844},'/envios');
  await page.locator('#tabbar-search').click();
  await expect(page.locator('#search-input')).toBeFocused();
  await page.evaluate(() => {
    const viewport = new EventTarget();
    viewport.height = 420; viewport.offsetTop = 24;
    Object.defineProperty(window,'visualViewport',{value:viewport,configurable:true});
    // Invoke the same resize path used by the real visual viewport.
    window.dispatchEvent(new Event('resize'));
  });
  await expect.poll(() => page.locator('#search-panel').evaluate(el => Math.round(el.getBoundingClientRect().bottom))).toBe(432);
  await expect(page.locator('#search-input')).toBeFocused();
  await page.setViewportSize({width:1024,height:768});
  await expect(page.locator('#search-panel')).toHaveAttribute('aria-hidden','true');
  await expect(page.locator('html')).not.toHaveClass(/tt-surface-locked/);
});

test('movimiento reducido abre y cierra sin animación de desplazamiento', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await mockGuestNavigation(page);
  await openPublicPage(page,{width:390,height:844},'/envios');
  await page.locator('#tabbar-cart').click();
  await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('open');
  expect(await page.locator('#cart-drawer').evaluate(el => el.getAnimations().length)).toBe(0);
  await page.locator('#btn-cart-close').click();
  await expect(page.locator('#tabbar-cart')).toBeFocused();
});

test('las categorías se desplazan con el dedo y el fondo conserva su posición', async ({ page }) => {
  await mockGuestNavigation(page);
  await openPublicPage(page,{width:390,height:844},'/envios');
  await page.evaluate(() => scrollTo(0,200));
  await page.locator('#tabbar-tienda').click();
  await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('open');
  const grid = page.locator('#collections-sheet .tt-sheet-grid');
  const box = await grid.boundingBox();
  const session = await page.context().newCDPSession(page);
  const x = box.x + box.width / 2, y = box.y + box.height - 30;
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for (let step=1;step<=8;step++) {
    await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:y-step*30}]});
    await page.waitForTimeout(20);
  }
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await expect.poll(() => grid.evaluate(el => el.scrollTop)).toBeGreaterThan(0);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.TintinSurfaceController.state)).toBe('idle');
  await expect.poll(() => page.evaluate(() => Math.round(scrollY))).toBe(200);
});
