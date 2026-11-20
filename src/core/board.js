// Widget board: where each module's card sits when Settings → Layout is "Widget board".
// Saved under the `board` namespace: { items: { <moduleId>: { x, y, w, h, hidden? } } }.
// grow(): one card expands into the empty space beside / below it (never past the board's bottom).
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
  return settle(out);
}

export const save = (items) => store.set('board', { items });
export const reset = () => store.set('board', {});

// Grows one card into the empty cells around it: sideways first, then down to the lowest
// card's bottom (never further, so the board doesn't get taller). Saved like any resize.
export function grow(items, id) {
  const out = structuredClone(items);
  const it = out[id];
  const others = order(out).filter((o) => o !== id).map((o) => out[o]);
  const rows = bottomOf(out);
  const free = (x0, x1, y0, y1) => !others.some((o) => overlaps(o, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }));
  while (it.x + it.w < COLS && free(it.x + it.w, it.x + it.w + 1, it.y, it.y + it.h)) it.w += 1;
  while (it.x > 0 && free(it.x - 1, it.x, it.y, it.y + it.h)) { it.x -= 1; it.w += 1; }
  while (it.y > 0 && free(it.x, it.x + it.w, it.y - 1, it.y)) { it.y -= 1; it.h += 1; }
  while (it.y + it.h < rows && it.h < MAX_H && free(it.x, it.x + it.w, it.y + it.h, it.y + it.h + 1)) it.h += 1;
  return out;
}

// Puts `id` at `next` ({x,y} or {w,h}) and pushes anything it now covers straight down.
// Nothing else moves, so gaps you leave on purpose stay.
export function place(items, id, next) {
  const out = structuredClone(items);
  out[id] = tidy({ ...out[id], ...next });
  return settle(out, id);
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
  return out;
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
      if (!shown.some((o) => overlaps(o, spot))) { out[id] = tidy(spot); return out; }
    }
  }
  const h = rows ? Math.min(it.h, Math.max(MIN_H + 2, Math.round(rows / 2))) : it.h;
  out[id] = tidy({ ...it, h, x: 0, y: rows });
  return out;
}

// Top-to-bottom, left-to-right reading order (used for the narrow stacked layout and keyboard order).
export const order = (items) => Object.keys(items)
  .filter((id) => !items[id].hidden)
  .sort((a, b) => items[a].y - items[b].y || items[a].x - items[b].x);
