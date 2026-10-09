import test from 'node:test';
import assert from 'node:assert/strict';
import { projectAccountPresentation } from '../../js/pages/profile/estado-canonico-perfil.mjs';

test('la presentación conservada no contiene permisos ni el documento privado completo', () => {
  const presentation = projectAccountPresentation({
    firstName: 'Ana', lastName: 'Ruiz', phone: '0912345678', username: 'ana',
    avatarURL: '/avatar.png', role: 'superadmin', blocked: false,
    permissions: { manageUsers: true }, token: 'never-keep', purchaseCount: 42,
    savedLocation: { lat: 0, lng: 0 },
  });
  assert.deepEqual(presentation, { name: 'Ana Ruiz', phone: '0912345678', username: 'ana', address: '', avatarURL: '/avatar.png' });
});

test('presentación limita tamaño y conserva datos históricos de nombre/teléfono', () => {
  const presentation = projectAccountPresentation({ nombre: 'Ana', apellido: 'Ruiz', telefono: '9'.repeat(200), direccion: 'A'.repeat(2000) });
  assert.equal(presentation.name, 'Ana Ruiz');
  assert.equal(presentation.phone.length, 32);
  assert.equal(presentation.address.length, 240);
});
