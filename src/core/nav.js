// Hash router: #/<view>/<param>   e.g. #/calendar/2026-11-11
const subs = new Set();
let defaultView = 'today';

export const setDefault = (id) => { defaultView = id; };

export function current() {
  const [view, param] = location.hash.replace(/^#\/?/, '').split('/');
  return { view: view || defaultView, param: param || null };
}

export function go(view, param = null) {
  const next = `#/${view}${param ? '/' + param : ''}`;
  if (location.hash !== next) location.hash = next;
}

// fn({ view, param })
export function onChange(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

window.addEventListener('hashchange', () => { const c = current(); subs.forEach((f) => f(c)); });
