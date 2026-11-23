// Persistent app state: one JSON object, split into namespaces.
//   settings  -> core/settings.js
//   worklog   -> core/worklog.js
//   tasks     -> core/tasks.js
//   mod:<id>  -> a module's private data (ctx.ns)
//   _version, _lastBackup, _savedAt -> bookkeeping
// Kept in localStorage. It can also be mirrored to a real file on the PC (core/filesync.js);
// when that file is linked, whichever copy was saved last (_savedAt) wins at startup.
// The file never holds up the start: if it doesn't answer within FILE_WAIT, the app starts from
// localStorage and reloads once if the file then turns out to be newer.
//
// When the shape of saved data changes, bump VERSION and add a migration.

import * as fileSync from './filesync.js';

const LS_KEY = 'work-companion';
const VERSION = 3;
const FILE_WAIT = 2500;

const migrations = {
  // v1 -> v2: fixed per-day hours replaced by "Begin day" + day length.
  2(d) {
    if (d.schedule?.days) d.settings = { ...d.settings, workdays: d.schedule.days.map((x) => !!x.on) };
    delete d.schedule;
    delete d['mod:today'];
    delete d['mod:week'];
  },
  // v2 -> v3: to-dos move out of the day records into one list (core/tasks.js).
  // `created` is recovered from the id (it starts with the creation time), else the day it sat on.
  3(d) {
    const moved = [];
    for (const [key, rec] of Object.entries(d.worklog ?? {})) {
      for (const t of rec.todos ?? []) {
        const ms = parseInt(String(t.id).slice(0, -4), 36);
        const [y, m, day] = (t.from ?? key).split('-').map(Number);
        const created = ms > 1e12 && ms < 4e12 ? new Date(ms) : new Date(y, m - 1, day);
        moved.push({ id: t.id, text: t.text, created: created.toISOString(), done: t.done ?? null });
      }
      delete rec.todos;
      if (!rec.start && !rec.notes?.length && !rec.kind) delete d.worklog[key];
    }
    if (moved.length) d.tasks = [...(d.tasks ?? []), ...moved];
  },
};

let data = {};
const listeners = new Set();

const readLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch { return {}; } };
const writeLocal = (text) => { try { localStorage.setItem(LS_KEY, text); } catch {} };

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
// Saves `data` to the browser and (if linked) the file. Serialized once for both.
function persist({ file = true } = {}) {
  const text = serialize();
  writeLocal(text);
  if (file) fileSync.write(text);
}
const looksLikeData = (o) => !!o && typeof o === 'object' && !Array.isArray(o)
  && ('worklog' in o || 'settings' in o || 'schedule' in o);

export async function loadStore() {
  data = readLocal();
  if (migrate(data)) persist({ file: false });
  const sync = fileSync.init()
    .then((status) => (status === 'on' ? reconcile() : status))
    .catch(() => 'invalid');
  const res = await Promise.race([sync, new Promise((r) => setTimeout(r, FILE_WAIT, 'late'))]);
  if (res === 'late') sync.then((r) => { if (r === 'loaded') location.reload(); });
}

// Compares the linked file with what this browser has; the most recently saved copy wins.
// Returns 'loaded' (file replaced the browser copy: reload the page), 'saved', 'same' or 'invalid'.
async function reconcile() {
  let text;
  try { text = await fileSync.readText(); } catch (e) { fileSync.fail(e); return 'invalid'; }
  if (!text.trim()) { persist(); return 'saved'; }
  let incoming = null;
  try { incoming = JSON.parse(text); } catch {}
  if (!looksLikeData(incoming)) {
    fileSync.reject('That file does not contain Work Companion data, so it was left untouched.');
    return 'invalid';
  }
  migrate(incoming);
  const fileTime = incoming._savedAt ?? '';
  const localTime = data._savedAt ?? '';
  if (fileTime > localTime) { data = incoming; persist({ file: false }); return 'loaded'; }
  if (fileTime < localTime) { persist(); return 'saved'; }
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
    persist({ file: false });
  } else {
    data._savedAt = new Date().toISOString();
    persist();
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
  persist({ file: false });
  return serialize();
}

// Replaces all saved data. Throws on anything that isn't a Work Companion backup.
export async function importData(json) {
  const incoming = JSON.parse(json);
  if (!looksLikeData(incoming)) throw new Error('That file is not a Work Companion backup.');
  migrate(incoming);
  incoming._savedAt = new Date().toISOString();   // a restore counts as the newest save
  data = incoming;
  persist();
}

export const lastBackup = () => data._lastBackup ?? null;

export function get(ns, fallback) {
  return structuredClone(data[ns] ?? fallback);
}

export function set(ns, value) {
  data[ns] = value;
  data._savedAt = new Date().toISOString();
  persist();
  listeners.forEach((fn) => fn(ns, value));
}

// fn(namespace, value) — called after every write.
export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
