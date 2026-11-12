// Persistent app state: one JSON object, split into namespaces.
//   settings  -> core/settings.js
//   worklog   -> core/worklog.js
//   mod:<id>  -> a module's private data (ctx.ns)
//   _version, _lastBackup, _savedAt -> bookkeeping
// Uses the Electron bridge when present, localStorage in a plain browser.
// In a browser the data can also be mirrored to a real file on the PC (core/filesync.js);
// when that file is linked, whichever copy was saved last (_savedAt) wins at startup.
//
// When the shape of saved data changes, bump VERSION and add a migration.

import * as fileSync from './filesync.js';

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

const serialize = () => JSON.stringify(data, null, 2);
const looksLikeData = (o) => !!o && typeof o === 'object' && !Array.isArray(o)
  && ('worklog' in o || 'settings' in o || 'schedule' in o);

export async function loadStore() {
  data = (await backend.read()) || {};
  if (migrate(data)) backend.write(data);
  await fileSync.init();
  if (fileSync.getState().status === 'on') await reconcile();
}

// Compares the linked file with what this browser has; the most recently saved copy wins.
// Returns 'loaded' (file replaced the browser copy: reload the page), 'saved', 'same' or 'invalid'.
async function reconcile() {
  let text;
  try { text = await fileSync.readText(); } catch (e) { fileSync.fail(e); return 'invalid'; }
  if (!text.trim()) { fileSync.write(serialize()); return 'saved'; }
  let incoming = null;
  try { incoming = JSON.parse(text); } catch {}
  if (!looksLikeData(incoming)) {
    fileSync.reject('That file does not contain Work Companion data, so it was left untouched.');
    return 'invalid';
  }
  migrate(incoming);
  const fileTime = incoming._savedAt ?? '';
  const localTime = data._savedAt ?? '';
  if (fileTime > localTime) { data = incoming; backend.write(data); return 'loaded'; }
  if (fileTime < localTime) { fileSync.write(serialize()); return 'saved'; }
  return 'same';
}

// ── Linked file (see core/filesync.js) ──
export const fileState = fileSync.getState;
export const onFileStatus = fileSync.onStatus;
export const unlinkFile = fileSync.unlink;

// Step 1: the user picks a file. Returns { handle, name, incoming } where `incoming` is the
// existing Work Companion data in that file (null for a new or empty file). Throws AbortError if cancelled.
export async function pickFile() {
  const handle = await fileSync.pick();
  const text = await fileSync.readText(handle);
  let incoming = null;
  if (text.trim()) {
    try { incoming = JSON.parse(text); } catch {}
    if (!looksLikeData(incoming)) throw new Error('That file already contains something else. Choose a new or empty file.');
    migrate(incoming);
  }
  return { handle, name: handle.name, incoming };
}

// Step 2: link it. fromFile=true replaces this browser's data with the file's (caller reloads the page).
export async function useFile(picked, { fromFile = false } = {}) {
  await fileSync.use(picked.handle);
  if (fromFile && picked.incoming) {
    data = picked.incoming;
    backend.write(data);
  } else {
    data._savedAt = new Date().toISOString();
    backend.write(data);
    fileSync.write(serialize());
  }
}

// After a browser restart the permission must be granted again by a click.
export async function reconnectFile() {
  if (!(await fileSync.reconnect())) return 'denied';
  return reconcile();
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
  if (!looksLikeData(incoming)) throw new Error('That file is not a Work Companion backup.');
  migrate(incoming);
  incoming._savedAt = new Date().toISOString();   // a restore counts as the newest save
  data = incoming;
  await backend.write(data);
  fileSync.write(serialize());
}

export const lastBackup = () => data._lastBackup ?? null;

export function get(ns, fallback) {
  return structuredClone(data[ns] ?? fallback);
}

export function set(ns, value) {
  data[ns] = value;
  data._savedAt = new Date().toISOString();
  backend.write(data);
  fileSync.write(serialize());
  listeners.forEach((fn) => fn(ns, value));
}

// fn(namespace, value) — called after every write.
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
