// Boots the app: loads state, draws the shell (masthead, tabs, settings drawer)
// and mounts every registered module onto its view.
import * as store from './store.js';
import * as settings from './settings.js';
import * as worklog from './worklog.js';
import * as time from './time.js';
import * as nav from './nav.js';
import { onTick } from './clock.js';
import { allViews, allModules, modulesFor } from './registry.js';
import { h } from './dom.js';
import { settingsPanel } from './settings-panel.js';
import { dataPanel } from './data-panel.js';
import { initPwa, onInstallable, install } from './pwa.js';
import * as keys from './keys.js';
import '../modules/index.js';

// Everything a module may use. Modules never import core files directly.
const ctxFor = (mod) => ({
  h,          // element builder (core/dom.js)
  settings,   // get() / set(patch) / dayLengthMs()
  worklog,    // day records + dayStats/weekStats + actions
  time,       // date helpers and formatters
  nav,        // go(view, param) / current() / onChange(fn)
  keys,       // shortcut('N') -> '⌘N' on Mac, 'Ctrl+N' elsewhere; isMac
  onTick,     // onTick(fn(now)) every second; returns unsubscribe
  onData: store.onChange, // onData(fn) after any saved change; returns unsubscribe
  ns: {       // the module's private saved data
    get: (fallback) => store.get(`mod:${mod.id}`, fallback),
    set: (value) => store.set(`mod:${mod.id}`, value),
  },
});

const openDrawer = (open) => document.body.classList.toggle('drawer-open', open);

function masthead() {
  const date = h('div.masthead-date');
  const clock = h('div.masthead-clock');
  const tick = (now) => {
    date.textContent = time.fmtDate(now);
    clock.textContent = time.fmtTime(now);
  };
  tick(new Date());
  onTick(tick);

  const tabs = allViews().map((v, i) => h('button.tab', {
    'data-view': v.id, title: `${v.title} (${keys.shortcut(i + 1)})`, onclick: () => nav.go(v.id),
  }, v.title));

  const installBtn = h('button.btn', { onclick: install, title: 'Install as an app on this computer', hidden: true }, 'Install app');
  onInstallable((can) => { installBtn.hidden = !can; });

  return h('header.masthead',
    h('div.masthead-row',
      h('div.masthead-title', h('span.reg', { 'data-text': 'Work' }, 'Work'), h('span.reg.alt', { 'data-text': 'Companion' }, 'Companion')),
      h('div.masthead-meta', date, clock)),
    h('div.masthead-row',
      h('nav.tabs', tabs),
      h('div.btn-row', installBtn, h('button.btn', { onclick: () => openDrawer(true), title: `Settings (${keys.shortcut(',')})` }, 'Settings'))));
}

function drawer() {
  const body = h('div.drawer-body',
    h('section.drawer-section', h('h3', 'Work day'), settingsPanel({ h, settings })));
  for (const mod of allModules()) {
    if (!mod.settings) continue;
    const el = h('section.drawer-section', h('h3', mod.title));
    mod.settings(el, ctxFor(mod));
    body.append(el);
  }
  body.append(h('section.drawer-section', h('h3', 'Your data'), dataPanel({ h, store })));
  return h('aside.drawer', { 'aria-label': 'Settings' },
    h('div.drawer-head', h('h2', 'Settings'), h('button.btn', { onclick: () => openDrawer(false) }, 'Close')),
    body);
}

function card(mod) {
  const content = h('div.card-body');
  const el = h(`article.card.ink-${mod.ink || 'blue'}${mod.span ? '.span-' + mod.span : ''}`,
    { 'data-module': mod.id },
    h('h2.card-title', mod.title), content);
  try {
    mod.mount(content, ctxFor(mod));
  } catch (err) {
    console.error(`[${mod.id}]`, err);
    content.append(h('p.muted', 'This module could not load.'));
  }
  return el;
}

function showView({ view }) {
  const known = allViews().some((v) => v.id === view);
  const active = known ? view : allViews()[0].id;
  document.querySelectorAll('[data-view]').forEach((el) => {
    if (el.classList.contains('tab')) el.classList.toggle('is-active', el.dataset.view === active);
    else el.hidden = el.dataset.view !== active;
  });
}

async function boot() {
  initPwa();
  await store.loadStore();
  nav.setDefault(allViews()[0].id);

  const views = allViews().map((v) =>
    h('main.grid.view', { 'data-view': v.id }, modulesFor(v.id).map(card)));

  document.getElementById('app').replaceChildren(
    masthead(), ...views,
    h('div.scrim', { onclick: () => openDrawer(false) }),
    drawer());

  showView(nav.current());
  nav.onChange(showView);

  // Desktop app menu (Electron): "Settings…" in the app menu opens the drawer.
  window.companion?.onOpenSettings?.(() => openDrawer(true));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') openDrawer(false);
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault();
      openDrawer(true);
    }
    const n = Number(e.key);
    if ((e.ctrlKey || e.metaKey) && n >= 1 && n <= allViews().length) {
      e.preventDefault();
      nav.go(allViews()[n - 1].id);
    }
  });
}

boot();
