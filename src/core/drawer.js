// The Settings drawer: Work day, Layout, each module's own section (mod.settings), Your data,
// and the signature at the bottom.
import { h } from './dom.js';
import * as store from './store.js';
import * as settings from './settings.js';
import * as board from './board.js';
import { allModules } from './registry.js';
import { dataPanel } from './data-panel.js';
import { DAY_NAMES } from './time.js';

export const openDrawer = (open) => document.body.classList.toggle('drawer-open', open);

// ctxFor(mod) builds a module's ctx (core/app.js) for its own Settings section.
export function drawer(ctxFor) {
  const body = h('div.drawer-body',
    h('section.drawer-section', h('h3', 'Work day'), workDayPanel()),
    h('section.drawer-section', h('h3', 'Layout'), layoutPanel()));
  for (const mod of allModules()) {
    if (!mod.settings) continue;
    const el = h('section.drawer-section', h('h3', mod.title));
    try { mod.settings(el, ctxFor(mod)); body.append(el); } catch (err) { console.error(`[${mod.id}] settings`, err); }
  }
  body.append(h('section.drawer-section', h('h3', 'Your data'), dataPanel({ h, store })));
  // Signature at the very bottom of Settings, printed like a faint riso watermark.
  body.append(h('footer.drawer-sign', { 'aria-label': 'Made by The Wizard King, Dmytro The First, 2026' },
    h('span.sign-by', 'by'),
    h('span.sign-name.reg-text', 'The Wizard King, Dmytro The First'),
    h('span.sign-year', '© 2026')));
  return h('aside.drawer', { 'aria-label': 'Settings' },
    h('div.drawer-head', h('h2', 'Settings'), h('button.btn', { onclick: () => openDrawer(false) }, 'Close')),
    body);
}

// ── Work day: time at work, unpaid break, workdays ──
const hoursText = (min) => `${+(min / 60).toFixed(2)}`;

function workDayPanel() {
  const s = settings.get();
  const hint = h('span.field-hint');
  const showHint = () => {
    const c = settings.get();
    hint.textContent = `A full day counts ${hoursText(c.dayLengthMin - c.breakMin)} hours of work.`;
  };

  const number = (value, min, max, fallback, onSave) => h('input.input', {
    type: 'number', min, max, step: 0.25, value: hoursText(value),
    onchange: (e) => {
      const v = Math.min(max, Math.max(min, Number(e.target.value) || fallback));
      e.target.value = v;
      onSave(Math.round(v * 60));
      showHint();
    },
  });

  const len = number(s.dayLengthMin, 1, 16, 9, (m) => settings.set({ dayLengthMin: m }));
  const brk = number(s.breakMin, 0, 4, 1, (m) => settings.set({ breakMin: m }));

  const days = DAY_NAMES.map((name, i) => h('label.chip',
    h('input', { type: 'checkbox', checked: s.workdays[i], onchange: (e) => {
      const workdays = settings.get().workdays;
      workdays[i] = e.target.checked;
      settings.set({ workdays });
    } }),
    h('span', name)));

  showHint();
  return h('div.form',
    h('label.field', h('span.field-label', 'Time at work (hours)'), len,
      h('span.field-hint', 'From Begin day until you go home. This is the countdown.')),
    h('label.field', h('span.field-label', 'Unpaid break (hours)'), brk, hint),
    h('div.field', h('span.field-label', 'Workdays'), h('div.chips', days),
      h('span.field-hint', 'Used for the week total. You can still begin a day off.')));
}

// ── Layout: Tabs or Widget board, and Auto-fill.
function layoutPanel() {
  const s = settings.get();
  const fill = h('input', { type: 'checkbox', checked: board.isFill(), onchange: () => board.setFill(fill.checked) });
  store.onChange((ns) => { if (ns === 'board') fill.checked = board.isFill(); });
  const opt = (value, label) => h('label.chip',
    h('input', { type: 'radio', name: 'layout', value, checked: s.layout === value,
      onchange: () => settings.set({ layout: value }) }),
    h('span', label));
  return h('div.form',
    h('div.field', h('span.field-label', 'Show the app as'), h('div.chips', opt('tabs', 'Tabs'), opt('board', 'Widget board')),
      h('span.field-hint', 'Widget board puts everything on one screen. Use Edit layout to move, resize and hide widgets. Tabs is the classic look; your board is kept for next time.')),
    h('div.field', h('span.field-label', 'Widget board'), h('div.chips', h('label.chip', fill, h('span', 'Auto-fill gaps'))),
      h('span.field-hint', 'Widgets move up into empty space and grow to fill gaps, so the board has no holes.')));
}
