import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { removeFixtureScripts } from '../../scripts/lib/html-layout-fixture.js';
const { parse } = createRequire(import.meta.url)('parse5');

function elements(node, tagName) {
  return Number(node.tagName === tagName) +
    (node.childNodes || []).reduce((count, child) => count + elements(child, tagName), 0) +
    (node.content ? elements(node.content, tagName) : 0);
}

for (const script of [
  '<script>alert(1)</script >',
  '<ScRiPt src="/business.js"></sCrIpT>',
  '<script data-example=">">alert(1)</script>',
  '<template><script>alert(1)</script></template>',
  '<svg><script>alert(1)</script></svg>',
  '<script>alert(1)'
]) {
  test(`layout fixtures remove parsed executable nodes: ${script}`, () => {
    const fixture = removeFixtureScripts(`<main id="layout">Keep layout</main>${script}`);
    assert.equal(elements(parse(fixture), 'script'), 0);
    assert.match(fixture, /<main id="layout">Keep layout<\/main>/);
  });
}

test('Admin fixtures remove module preloads and preserve layout styles', () => {
  const markup = '<link rel="MODULEPRELOAD" href="/business.js"><link rel="stylesheet" href="/layout.css">';
  assert.equal(elements(parse(removeFixtureScripts(markup)), 'link'), 2);
  const isolated = removeFixtureScripts(markup, { removeModulePreloads: true });
  assert.equal(elements(parse(isolated), 'link'), 1);
  assert.match(isolated, /href="\/layout.css"/);
});
