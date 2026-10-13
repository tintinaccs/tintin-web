const parse5 = require('parse5');

const HTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
const ALLOWED_TAGS = new Set(['p','div','span','br','h1','h2','h3','h4','h5','h6','strong','b','em','i','u','s','ul','ol','li','a','img','blockquote','hr','table','thead','tbody','tfoot','tr','th','td','caption','pre','code']);
const DISCARD_CONTENT = new Set(['script','style','iframe','object','embed','form','base','meta','link','template','noscript','svg','math']);

function safeUrl(value, tag, origin) {
  try {
    const url = new URL(value, origin);
    const protocols = tag === 'a' ? ['http:','https:','mailto:','tel:'] : ['http:','https:'];
    return protocols.includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}

// Parse HTML once; entity decoding, duplicate attributes and malformed markup
// must follow HTML rules before checking URL schemes or allowed elements.
function sanitizeCustomPageHtml(value, origin) {
  const fragment = parse5.parseFragment(String(value || '').slice(0, 100000));
  let nodes = 0;
  function clean(children, parent, depth) {
    const result = [];
    if (depth > 64) return result;
    for (const node of children || []) {
      if (++nodes > 5000) break;
      if (node.nodeName === '#text') { node.parentNode = parent; result.push(node); continue; }
      if (!node.tagName || node.namespaceURI !== HTML_NAMESPACE || DISCARD_CONTENT.has(node.tagName)) continue;
      if (!ALLOWED_TAGS.has(node.tagName)) { result.push(...clean(node.childNodes, parent, depth + 1)); continue; }
      node.attrs = node.attrs.filter(attribute => {
        if (attribute.namespace || attribute.prefix) return false;
        const { name, value } = attribute;
        if (['title','alt'].includes(name)) return true;
        if (name === 'class') return /^[a-zA-Z0-9 _-]{0,300}$/.test(value);
        if (name === 'href' && node.tagName === 'a') return safeUrl(value, 'a', origin);
        if (name === 'src' && node.tagName === 'img') return safeUrl(value, 'img', origin);
        if (name === 'target' && node.tagName === 'a') return ['_blank','_self'].includes(value);
        if (['width','height','colspan','rowspan'].includes(name)) return /^[1-9][0-9]{0,3}$/.test(value);
        return false;
      });
      if (node.tagName === 'a' && node.attrs.some(attribute => attribute.name === 'target' && attribute.value === '_blank')) {
        node.attrs.push({ name:'rel', value:'noopener noreferrer' });
      }
      node.parentNode = parent;
      node.childNodes = clean(node.childNodes, node, depth + 1);
      result.push(node);
    }
    return result;
  }
  fragment.childNodes = clean(fragment.childNodes, fragment, 0);
  return parse5.serialize(fragment);
}

module.exports.sanitizeCustomPageHtml = sanitizeCustomPageHtml;
