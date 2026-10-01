import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  MAX_SAVED_LOCATIONS, readAddressBook, addressBookPatch, addAddress, removeAddress, makePrimary
} from '../../js/pages/profile/libreta-direcciones.mjs';

const loc = n => ({ lat: -25 - n / 100, lng: -57 - n / 100, name: `Casa ${n}`, address: `Calle ${n}` });

test('el tope es 5 y la sexta dirección se rechaza', () => {
  assert.equal(MAX_SAVED_LOCATIONS, 5);
  let list = [];
  for (let i = 1; i <= 5; i++) list = addAddress(list, loc(i)).list;
  assert.equal(list.length, 5);
  const sixth = addAddress(list, loc(6));
  assert.equal(sixth.ok, false);
  assert.equal(sixth.reason, 'full');
  assert.equal(sixth.list.length, 5);
});

test('rechaza duplicadas y datos inválidos', () => {
  const list = addAddress([], loc(1)).list;
  assert.equal(addAddress(list, loc(1)).reason, 'duplicate');
  assert.equal(addAddress(list, { name: 'x', lat: 'a', lng: 1 }).reason, 'invalid');
  assert.equal(addAddress(list, null).reason, 'invalid');
});

test('una cuenta con solo savedLocation (anterior) ve esa dirección como principal', () => {
  const book = readAddressBook({ savedLocation: loc(1) });
  assert.deepEqual(book, [loc(1)]);
  assert.deepEqual(readAddressBook({}), []);
});

test('readAddressBook pone la principal primero, sin repetir y con tope 5', () => {
  const stored = [loc(2), loc(1), loc(3), loc(4), loc(5), loc(6), loc(7)];
  const book = readAddressBook({ savedLocation: loc(1), savedLocations: stored });
  assert.equal(book.length, 5);
  assert.deepEqual(book[0], loc(1));
});

test('eliminar la principal promueve la siguiente y la última deja savedLocation en null', () => {
  let list = [loc(1), loc(2)];
  list = removeAddress(list, 0);
  assert.deepEqual(addressBookPatch(list).savedLocation, loc(2));
  list = removeAddress(list, 0);
  const patch = addressBookPatch(list);
  assert.equal(patch.savedLocation, null);
  assert.deepEqual(patch.savedLocations, []);
  assert.equal('address' in patch, false);
});

test('hacer principal mueve la dirección al primer lugar y actualiza el espejo', () => {
  const list = makePrimary([loc(1), loc(2), loc(3)], 2);
  assert.deepEqual(list.map(l => l.name), ['Casa 3', 'Casa 1', 'Casa 2']);
  const patch = addressBookPatch(list);
  assert.deepEqual(patch.savedLocation, loc(3));
  assert.equal(patch.address, 'Calle 3');
});

test('las reglas de Firestore limitan savedLocations a una lista de máximo 5', async () => {
  const rules = await fs.readFile('firestore.rules', 'utf8');
  assert.match(rules, /data\.savedLocations is list && data\.savedLocations\.size\(\) <= 5/);
});
