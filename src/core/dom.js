// Tiny helper: h('div.card', {onclick}, child, 'text')
export function h(tag, attrs, ...children) {
  const isAttrs = attrs && typeof attrs === 'object' && !attrs.nodeType && !Array.isArray(attrs);
  if (!isAttrs) { if (attrs != null) children.unshift(attrs); attrs = {}; }
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : String(c));
  return el;
}
