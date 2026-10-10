const { parse, serialize } = require('parse5');

// These fixtures retain repository markup for layout tests. Remove executable
// nodes through the HTML parser before adding each test's isolated behavior.
function removeFixtureScripts(markup, { removeModulePreloads = false } = {}) {
  const document = parse(markup);
  function visit(node) {
    if (node.childNodes) {
      node.childNodes = node.childNodes.filter(child => {
        if (child.tagName === 'script') return false;
        return !(removeModulePreloads && child.tagName === 'link' &&
          child.attrs.some(attr => attr.name === 'rel' &&
            attr.value.toLowerCase().split(/\s+/).includes('modulepreload')));
      });
      node.childNodes.forEach(visit);
    }
    if (node.content) visit(node.content);
  }
  visit(document);
  return serialize(document);
}

module.exports = { removeFixtureScripts };
