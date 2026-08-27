import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPageSchema,
  getSiteStructurePage,
  sanitizeSiteSectionOrder,
} from '../../js/core/store/esquema-contenido.js';
import { sanitizeVisualConfig } from '../../cloudflare/visual-builder-core.js';

test('Producto expone todas sus superficies pero conserva barreras comerciales', () => {
  const schema = getPageSchema('product');
  assert.deepEqual(Object.keys(schema.sections), [
    'product_detail', 'benefits', 'selection', 'related', 'footer',
  ]);
  assert.equal(schema.sections.product_detail.visualEditable, false);
  assert.equal(schema.sections.product_detail.blockAnchor, false);
  assert.equal(schema.sections.selection.visualEditable, false);
  assert.equal(schema.sections.selection.blockAnchor, false);
  assert.equal(schema.sections.benefits.visualEditable, true);
  assert.equal(schema.sections.related.visualEditable, true);
});

test('un payload manipulado no puede cruzar zonas protegidas de Producto', () => {
  const clean = sanitizeVisualConfig('product', {
    sectionOrder: ['related', 'selection', 'benefits', 'product_detail'],
    sections: {
      product_detail: { background: '#123456', textColor: '#654321' },
      benefits: { background: '#abcdef' },
    },
    customBlocks: [
      { id: 'intento-core', type: 'text', afterSection: 'product_detail', title: 'No entra al core' },
      { id: 'seguro-related', type: 'text', afterSection: 'related', title: 'Sí puede ir aquí' },
    ],
  });

  assert.deepEqual(clean.sectionOrder, ['product_detail', 'benefits', 'selection', 'related']);
  assert.equal(clean.sections.product_detail.background, '');
  assert.equal(clean.sections.product_detail.textColor, '');
  assert.equal(clean.sections.benefits.background, '#abcdef');
  assert.equal(clean.customBlocks[0].afterSection, 'benefits');
  assert.equal(clean.customBlocks[1].afterSection, 'related');
});

test('Catálogo mantiene el runtime operativo fijo aunque el JSON pida invertirlo', () => {
  const clean = sanitizeVisualConfig('catalogo', {
    sectionOrder: ['catalog_runtime', 'header'],
    sections: { catalog_runtime: { background: '#ff0000' } },
    customBlocks: [{ id: 'malo', type: 'text', afterSection: 'catalog_runtime' }],
  });
  assert.deepEqual(clean.sectionOrder, ['header', 'catalog_runtime']);
  assert.equal(clean.sections.catalog_runtime.background, '');
  assert.equal(clean.customBlocks[0].afterSection, 'header');
});

test('404 no acepta bloques libres porque no tiene anclas seguras', () => {
  const clean = sanitizeVisualConfig('404', {
    customBlocks: [{ id: 'extra', type: 'text', afterSection: 'not_found' }],
  });
  assert.deepEqual(clean.customBlocks, []);
  assert.deepEqual(clean.sectionOrder, ['not_found']);
});

test('el contrato conserva zonas contiguas y nunca mueve superficies fijas', () => {
  for (const pageId of ['index', 'nosotros', 'catalogo', 'collections', 'product', 'contact', 'envios', 'faq', 'cambios', 'terminos', 'privacidad', '404']) {
    const page = getSiteStructurePage(pageId);
    const seenZones = new Set();
    let previousZone = '';
    for (const section of page.sections) {
      assert.ok(section.zone, `${pageId}/${section.id} debe declarar zona`);
      if (section.zone !== previousZone) {
        assert.ok(!seenZones.has(section.zone), `${pageId}: la zona ${section.zone} no puede reaparecer después de otra`);
        seenZones.add(section.zone);
        previousZone = section.zone;
      }
      if (section.visualEditable === false) assert.equal(section.blockAnchor, false, `${pageId}/${section.id}: una superficie no visual no puede ser ancla`);
    }
    const reversed = [...page.sections].reverse().map(section => section.id);
    const cleanOrder = sanitizeSiteSectionOrder(pageId, reversed);
    page.sections.filter(section => !section.movable).forEach(section => {
      assert.equal(cleanOrder.indexOf(section.id), page.sections.indexOf(section), `${pageId}/${section.id}: la sección fija debe conservar posición canónica`);
    });
  }
});

test('Checkout, Login y Perfil siguen fuera del CMS libre y sin anclas', () => {
  for (const pageId of ['checkout', 'login', 'perfil']) {
    const page = getSiteStructurePage(pageId);
    assert.equal(page.mode, 'protected');
    assert.equal(page.allowTopBlocks, false);
    assert.ok(page.sections.every(section => section.blockAnchor === false));
    assert.equal(getPageSchema(pageId), null);
  }
});
