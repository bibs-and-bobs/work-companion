// Widget board: where each module's card sits when Settings → Layout is "Widget board".
// Saved under the `board` namespace: { items: { <moduleId>: { x, y, w, h, hidden? } }, fill? }.
// fill (Auto-fill): cards float up into any empty space after every change, and outside Edit layout
// they also grow into gaps left beside or below them (stretch(), drawing only; not saved).
// x / w are columns (0..COLS), y / h are rows. Missing items fall back to the defaults
// from modules/index.js (setBoardDefaults), and modules with no default go at the bottom.
// Pure layout maths lives here; drawing and dragging live in core/board-view.js.
import * as store from './store.js';
import { allModules, boardDefaults } from './registry.js';

export const COLS = 12;
export const MIN_W = 2;
export const MIN_H = 2;
export const MAX_H = 40;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function tidy(it) {
  const w = clamp(Math.round(it.w) || 4, MIN_W, COLS);
  return {
    x: clamp(Math.round(it.x) || 0, 0, COLS - w),
    y: Math.max(0, Math.round(it.y) || 0),
    w,
    h: clamp(Math.round(it.h) || 6, MIN_H, MAX_H),
    ...(it.hidden ? { hidden: true } : {}),
  };
}

export const overlaps = (a, b) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const bottomOf = (items) => Object.values(items).reduce((m, it) => (it.hidden ? m : Math.max(m, it.y + it.h)), 0);

// Current layout for every registered module: { id: { x, y, w, h, hidden? } }.
export function layout() {
  const saved = store.get('board', {}).items ?? {};
  const defs = boardDefaults();
  const out = {};
  const ids = allModules().map((m) => m.id);
  for (const id of ids) if (saved[id] ?? defs[id]) out[id] = tidy(saved[id] ?? defs[id]);
  for (const id of ids) if (!out[id]) out[id] = tidy({ x: 0, y: bottomOf(out), w: 6, h: 8 });
  return tighten(settle(out));
}

export const isFill = () => !!store.get('board', {}).fill;
export const setFill = (on) => store.set('board', { ...store.get('board', {}), fill: !!on });
export const save = (items) => store.set('board', { ...store.get('board', {}), items });
export const reset = () => store.set('board', isFill() ? { fill: true } : {});   // positions only; Auto-fill stays

// With Auto-fill on, every change ends with the cards floated up.
const tighten = (items) => (isFill() ? compact(items) : items);

// Floats every visible card straight up until it touches another card or the top.
export function compact(items) {
  const out = structuredClone(items);
  const placed = [];
  for (const id of order(out)) {
    const it = out[id];
    while (it.y > 0 && !placed.some((p) => overlaps(p, { ...it, y: it.y - 1 }))) it.y -= 1;
    placed.push(it);
  }
  return out;
}

// Auto-fill, for drawing: each card grows into empty cells below it (down to the lowest card's
// bottom) and beside it, so the board has no holes. Positions you saved are not changed.
export function stretch(items) {
  const out = structuredClone(items);
  const ids = order(out);
  const rows = bottomOf(out);
  const free = (x0, x1, y0, y1, self) => ids.every((id) => id === self
    || !overlaps(out[id], { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }));
  const down = (id) => { const it = out[id]; while (it.y + it.h < rows && free(it.x, it.x + it.w, it.y + it.h, it.y + it.h + 1, id)) it.h += 1; };
  for (const id of ids) down(id);
  for (const id of ids) {
    const it = out[id];
    while (it.x + it.w < COLS && free(it.x + it.w, it.x + it.w + 1, it.y, it.y + it.h, id)) it.w += 1;
    while (it.x > 0 && free(it.x - 1, it.x, it.y, it.y + it.h, id)) { it.x -= 1; it.w += 1; }
  }
  for (const id of ids) down(id);
  return out;
}

// Puts `id` at `next` ({x,y} or {w,h}) and pushes anything it now covers straight down.
// Nothing else moves, so gaps you leave on purpose stay.
export function place(items, id, next) {
  const out = structuredClone(items);
  out[id] = tidy({ ...out[id], ...next });
  return tighten(settle(out, id));
}

// Removes overlaps: `first` keeps its spot, the rest (top to bottom) slide down until free.
function settle(items, first = null) {
  const placed = first ? [items[first]] : [];
  const rest = Object.entries(items)
    .filter(([id, it]) => id !== first && !it.hidden)
    .sort(([, a], [, b]) => a.y - b.y || a.x - b.x);
  for (const [, it] of rest) {
    let hit;
    while ((hit = placed.find((p) => overlaps(p, it)))) it.y = hit.y + hit.h;
    placed.push(it);
  }
  return items;
}

export function hide(items, id) {
  const out = structuredClone(items);
  out[id] = { ...out[id], hidden: true };
  return tighten(out);
}

// Shows a hidden widget again: in an empty gap big enough for it if there is one, otherwise at
// the bottom. The board fits the window, so every added row shrinks the rest: a widget added at
// the bottom is capped at half the board's current height (resize it afterwards as you like).
export function show(items, id) {
  const out = structuredClone(items);
  const { hidden, ...it } = out[id];
  const rows = bottomOf(out);
  const shown = Object.values(out).filter((o) => !o.hidden);
  for (let y = 0; y + it.h <= rows; y++) {
    for (let x = 0; x + it.w <= COLS; x++) {
      const spot = { x, y, w: it.w, h: it.h };
      if (!shown.some((o) => overlaps(o, spot))) { out[id] = tidy(spot); return tighten(out); }
    }
  }
  const h = rows ? Math.min(it.h, Math.max(MIN_H + 2, Math.round(rows / 2))) : it.h;
  out[id] = tidy({ ...it, h, x: 0, y: rows });
  return tighten(out);
}

// Top-to-bottom, left-to-right reading order (used for the narrow stacked layout and keyboard order).
export const order = (items) => Object.keys(items)
  .filter((id) => !items[id].hidden)
  .sort((a, b) => items[a].y - items[b].y || items[a].x - items[b].x);
