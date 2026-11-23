// Registry of views (tabs) and modules (cards).
//
// View:   { id, title }                          — a tab; modules are placed on it
// Module: {
//   id,                 unique; also its private store namespace (ctx.ns)
//   title,              card heading
//   view,               which tab it lives on (defaults to the first view)
//   ink,                accent ink: pink | blue | yellow | green | orange
//   span,               optional: 'wide' | 'full'
//   mount(el, ctx),     draw into el; return a cleanup function
//   settings(el, ctx),  optional section in the Settings drawer
// }
// ctx is documented in core/app.js (ctxFor).

const views = [];
const modules = [];
let boardDefs = {};

export function registerView(view) {
  if (views.some((v) => v.id === view.id)) throw new Error(`Duplicate view id: ${view.id}`);
  views.push(view);
}

export function register(mod) {
  if (modules.some((m) => m.id === mod.id)) throw new Error(`Duplicate module id: ${mod.id}`);
  modules.push(mod);
}

export const allViews = () => [...views];
export const allModules = () => [...modules];
export const modulesFor = (viewId) => modules.filter((m) => (m.view ?? views[0]?.id) === viewId);

// Default spot of each module on the widget board: { id: { x, y, w, h, hidden? } } (see core/board.js).
export const setBoardDefaults = (defs) => { boardDefs = defs; };
export const boardDefaults = () => structuredClone(boardDefs);
