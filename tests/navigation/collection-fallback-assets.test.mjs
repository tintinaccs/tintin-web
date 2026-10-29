import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { collectionImageUrl, CATEGORY_ICONS } from '../../js/components/navigation/compartido/iconos.js';
test('todo fallback apunta a un archivo existente, incluso categorías personalizadas',()=>{
 for(const slug of [...Object.keys(CATEGORY_ICONS),'bags','mochilas','../inexistente','',null]){
  const path=collectionImageUrl(slug);
  assert.ok(existsSync('.'+path),`${slug}: ${path}`);
 }
 assert.match(collectionImageUrl('mochilas'),/col-placeholder\.webp$/);
 assert.match(collectionImageUrl('bolsos'),/col-bags\.webp$/);
});
