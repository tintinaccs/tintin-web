#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const checks = [];
const check = (id, label, ok) => checks.push({ id, label, ok: Boolean(ok) });

const auth = read('js/core/auth/navegacion-autenticacion.js');
const loader = read('js/components/navigation/compartido/carga-navegacion.js');
const entry = read('js/components/navigation/entrada-navegacion-publica.js');
const config = read('js/components/navigation/compartido/configuracion.js');
const clientNotifications = read('js/components/notifications/notificaciones-clientes.js');
const adminNotifications = read('js/admin/notifications/notificaciones-admin.js');
const desktopHeader = read('js/components/navigation/escritorio/encabezado-escritorio.js');
const tabletHeader = read('js/components/navigation/tableta/encabezado-tableta.js');
const mobileHeader = read('js/components/navigation/movil/encabezado-movil.js');
const reveal = read('js/quality/revelado-desplazamiento-global.js');
const brandReveal = read('js/quality/extension-revelado-marca.js');
const pageLoader = read('js/cargador-pagina.js');

const identityAt = auth.indexOf('publishAuthIdentity(user)');
const roleAt = auth.indexOf('await getUserRole');
check('auth-identity-first', 'Auth publica identidad antes de consultar rol/permisos', identityAt >= 0 && roleAt >= 0 && identityAt < roleAt);
check('auth-identity-cache', 'La identidad inmediata queda disponible para runtimes montados después', auth.includes('window.TintinAuthIdentity=detail'));
check('auth-identity-event', 'La identidad inmediata emite un evento canónico', auth.includes("'tintin:auth-identity'"));

check('notifications-no-demand', 'Notificaciones no dependen de hover/click para arrancar', !loader.includes('bindDemand(NOTIFICATION_TRIGGER_SELECTOR'));
check('notifications-identity-event', 'El shell escucha la identidad instantánea', loader.includes("'tintin:auth-identity'"));
check('notifications-late-shell', 'El shell consume identidad resuelta antes de montar sus listeners', loader.includes('window.TintinAuthIdentity?.resolved'));
check('notifications-auth-prime', 'Auth se puede iniciar antes del montaje visual', loader.includes('export function primeAuthRuntime()'));
const primeAt = entry.indexOf('primeAuthRuntime()');
const logoAt = entry.indexOf('hydrateSharedLogos()');
check('entry-primes-before-logo', 'La entrada pública inicia Auth antes de esperar logo/configuración', primeAt >= 0 && logoAt >= 0 && primeAt < logoAt);
check('entry-activates-after-headers', 'Al existir los headers se activa inmediatamente el contrato de notificaciones', entry.includes('void activateIdentityNotifications();'));

check('guest-desktop-hidden', 'Desktop nace sin campana para visitante', /data-nav-action="notifications"[\s\S]{0,220}\shidden/.test(desktopHeader));
check('guest-tablet-hidden', 'Tablet nace sin campana para visitante', /data-nav-action="notifications"[\s\S]{0,220}\shidden/.test(tabletHeader));
check('guest-mobile-hidden', 'Mobile nace sin campana para visitante', /data-nav-action="notifications"[\s\S]{0,260}\shidden/.test(mobileHeader));
check('client-realtime', 'Cliente escucha notificaciones con Firestore onSnapshot', clientNotifications.includes('onSnapshot(source'));
check('admin-realtime', 'Super Admin escucha notificaciones con Firestore onSnapshot', adminNotifications.includes('onSnapshot(source'));
check('client-current-user-immediate', 'Cliente consume auth.currentUser sin esperar un segundo callback', clientNotifications.includes('if (auth.currentUser) applyClientAuthState(auth.currentUser)') && clientNotifications.includes('appliedAuthKey'));
check('admin-current-user-immediate', 'Super Admin consume auth.currentUser y deduplica por UID', adminNotifications.includes('if (auth.currentUser) applyAdminAuthState(auth.currentUser)') && adminNotifications.includes('appliedAdminAuthKey'));
check('admin-auto-read', 'Super Admin mantiene autolectura al abrir y al recibir snapshot tardío', adminNotifications.includes('panelIsOpen()') && adminNotifications.includes('markVisibleNotificationsRead'));
check('client-auto-read', 'Cliente mantiene autolectura al abrir y al recibir snapshot tardío', clientNotifications.includes('notificationsSurfaceIsOpen()') && clientNotifications.includes('markVisibleNotificationsRead'));

check('reveal-no-repeat-function', 'El reveal global ya no contiene lógica de ocultar para repetir', !reveal.includes('hideForRepeat'));
check('reveal-unobserve', 'Cada elemento revelado se desuscribe del IntersectionObserver', reveal.includes('observer?.unobserve(element)'));
check('reveal-done-marker', 'Cada elemento conserva marca irreversible durante la carga', reveal.includes("element.dataset.ttRevealDone = '1'"));
check('reveal-no-exit-reset', 'Salir del viewport no vuelve a ocultar elementos', !/else\s+[^\n]*remove\(['"]tt-visible/.test(reveal));
check('reveal-admin-enabled', 'Super Admin participa del mismo reveal único global', !reveal.includes('tt-reveal-admin-disabled') && reveal.includes('.adm-section.active .adm-card'));
check('reveal-admin-dynamic', 'Al cambiar módulos Admin se escanea solo la sección activa', reveal.includes("document.querySelector('.adm-section.active')"));
check('brand-reveal-once', 'La extensión de marca también revela una sola vez', brandReveal.includes('observer&&observer.unobserve(el)'));
check('reveal-versioned-loader', 'El loader usa la versión irreversible del reveal', pageLoader.includes('tt-reveal=20260831-irreversible-1'));
check('shell-version', 'El runtime público está versionado para identidad/reveal nuevos', config.includes("tintin-20260831-instant-auth-reveal-once-1"));

const failed = checks.filter(item => !item.ok);
for (const item of checks) console.log(`${item.ok ? 'OK' : 'FALTA'} — ${item.label}`);
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts', 'instant-auth-reveal-audit.json'), JSON.stringify({ generatedAt: new Date().toISOString(), total: checks.length, passed: checks.length - failed.length, failed: failed.length, checks }, null, 2));
if (failed.length) process.exitCode = 1;
