import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const profile = fs.readFileSync(new URL('../../perfil.html', import.meta.url), 'utf8');
const welcome = fs.readFileSync(new URL('../../js/components/welcome/tutorial-bienvenida.js', import.meta.url), 'utf8');
const theme = fs.readFileSync(new URL('../../css/core/tema-unificado-tintin.css', import.meta.url), 'utf8');

test('Perfil usa el mismo mapa interactivo y geolocalización que el alta', () => {
  assert.match(profile, /\/js\/vendor\/leaflet\/leaflet\.css\?v=leaflet-1\.9\.4/);
  assert.match(profile, /createLocationMap/);
  assert.match(profile, /id="perfil-location-map"/);
  assert.match(profile, /id="perfil-location-locate"/);
  assert.match(profile, /locationMap\?\.getLocation\(\)/);
  assert.doesNotMatch(profile, /attachLocationPicker/);
});

test('la bienvenida mantiene la tienda oculta hasta cerrar el mensaje', () => {
  const home = fs.readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  assert.match(home, /tt-welcome-pending/);
  assert.match(welcome, /releaseWelcomeGate/);
  assert.match(welcome, /releaseWelcomeGate\(\);\r?\n        window\.dispatchEvent/);
});

test('avatar de cuenta y pie público conservan una superficie limpia', () => {
  assert.match(theme, /--tt-footer-surface:#fff/);
  assert.match(theme, /:is\(#tt-header-desktop-tablet,#tt-header-tablet\) \.tt-account-avatar-btn/);
});
