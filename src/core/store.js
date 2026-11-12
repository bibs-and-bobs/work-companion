// Persistent app state: one JSON object, split into namespaces.
//   settings  -> core/settings.js
//   worklog   -> core/worklog.js
//   mod:<id>  -> a module's private data (ctx.ns)
//   _version, _lastBackup -> bookkeeping
// Uses the Electron bridge when present, localStorage in a plain browser.
//
// When the shape of saved data changes, bump VERSION and add a migration.

const LS_KEY = 'work-companion';
const VERSION = 2;

const migrations = {
  // v1 -> v2: fixed per-day hours replaced by "Begin day" + day length.
  2(d) {
    if (d.schedule?.days) d.settings = { ...d.settings, workdays: d.schedule.days.map((x) => !!x.on) };
    delete d.schedule;
    delete d['mod:today'];
    delete d['mod:week'];
  },
};

let data = {};
const listeners = new Set();

const backend = window.companion?.store ?? {
  read: async () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } },
  write: async (d) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} },
};

// Brings any saved object (old file or imported backup) up to the current shape.
function migrate(d) {
  const fresh = Object.keys(d).length === 0;
  let v = fresh ? VERSION : (d._version ?? 1);
  const changed = v !== VERSION;
  while (v < VERSION) { v += 1; migrations[v]?.(d); }
  d._version = VERSION;
  return fresh || changed;
}

export async function loadStore() {
  data = (await backend.read()) || {};
  if (migrate(data)) backend.write(data);
}

// ── Backup ──
// Everything is one JSON object, so a backup is just that object.
export function exportData() {
  data._lastBackup = new Date().toISOString();
  backend.write(data);
  return JSON.stringify(data, null, 2);
}

// Replaces all saved data. Throws on anything that isn't a Work Companion backup.
export async function importData(json) {
  const incoming = JSON.parse(json);
  const looksRight = incoming && typeof incoming === 'object' && !Array.isArray(incoming)
    && ('worklog' in incoming || 'settings' in incoming || 'schedule' in incoming);
  if (!looksRight) throw new Error('That file is not a Work Companion backup.');
  migrate(incoming);
  data = incoming;
  await backend.write(data);
}

export const lastBackup = () => data._lastBackup ?? null;

export function get(ns, fallback) {
  return structuredClone(data[ns] ?? fallback);
}

export function set(ns, value) {
  data[ns] = value;
  backend.write(data);
  listeners.forEach((fn) => fn(ns, value));
}

// fn(namespace, value) — called after every write.
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
