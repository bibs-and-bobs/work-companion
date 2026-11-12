// Optional mirror of the saved data to a real file on this PC.
// Uses the browser's File System Access API (Edge / Chrome). The browser keeps the
// permission for the chosen file; after a restart it asks once per session ("Reconnect").
// Browser storage (localStorage) is still written too, so nothing is lost if the file is unreachable.
//
// store.js owns *what* is written and which copy wins; this file only talks to the file.

const DB = 'work-companion-fs';
const TABLE = 'kv';
const KEY = 'handle';

const supported = typeof window.showSaveFilePicker === 'function' && !window.companion;

// status: 'unsupported' | 'off' | 'on' | 'needs-permission' | 'error'
const state = { status: supported ? 'off' : 'unsupported', name: '', savedAt: null, error: '' };
const subs = new Set();
let handle = null;
let pending = null;
let timer = null;
let writing = false;

const emit = () => subs.forEach((fn) => fn({ ...state }));
function setState(patch) { Object.assign(state, patch); emit(); }

export const getState = () => ({ ...state });
export function onStatus(fn) { subs.add(fn); fn({ ...state }); return () => subs.delete(fn); }

// ── Remember the chosen file between visits (a file handle can be stored in IndexedDB) ──
const openDb = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(TABLE);
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
async function idb(mode, fn) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const q = fn(db.transaction(TABLE, mode).objectStore(TABLE));
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
  });
}

export async function init() {
  if (!supported) return state.status;
  try {
    handle = (await idb('readonly', (t) => t.get(KEY))) ?? null;
    if (!handle) return setState({ status: 'off' }), 'off';
    const perm = await handle.queryPermission({ mode: 'readwrite' });
    setState({ name: handle.name, status: perm === 'granted' ? 'on' : 'needs-permission', error: '' });
  } catch {
    handle = null;
    setState({ status: 'off' });
  }
  return state.status;
}

// Shows the browser's file picker. Returns a handle without linking it yet. Throws AbortError if cancelled.
export const pick = () => window.showSaveFilePicker({
  suggestedName: 'work-companion.json',
  types: [{ description: 'Work Companion data', accept: { 'application/json': ['.json'] } }],
});

export async function use(picked) {
  handle = picked;
  await idb('readwrite', (t) => t.put(picked, KEY));
  setState({ name: picked.name, status: 'on', error: '', savedAt: null });
}

export async function unlink() {
  clearTimeout(timer);
  pending = null;
  handle = null;
  try { await idb('readwrite', (t) => t.delete(KEY)); } catch {}
  setState({ status: supported ? 'off' : 'unsupported', name: '', error: '', savedAt: null });
}

// Must be called straight from a click: browsers only show the permission prompt then.
export async function reconnect() {
  if (!handle) return false;
  try {
    const ok = (await handle.requestPermission({ mode: 'readwrite' })) === 'granted';
    setState({ status: ok ? 'on' : 'needs-permission', error: '' });
    return ok;
  } catch (e) {
    fail(e);
    return false;
  }
}

export async function readText(h = handle) {
  return (await h.getFile()).text();
}

export function fail(e) {
  if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') return setState({ status: 'needs-permission' });
  setState({ status: 'error', error: e?.name === 'NotFoundError' ? 'The file was moved or deleted. Choose it again.' : (e?.message || 'Could not save to the file.') });
}

export const reject = (message) => setState({ status: 'error', error: message });

// ── Writing ──
async function flush() {
  if (writing) return;
  writing = true;
  try {
    while (pending !== null && state.status === 'on') {
      const text = pending;
      pending = null;
      const w = await handle.createWritable();
      await w.write(text);
      await w.close();
      setState({ savedAt: new Date(), error: '' });
    }
  } catch (e) {
    fail(e);
  } finally {
    writing = false;
  }
}

// Queue the latest text. Rapid changes collapse into one write.
export function write(text) {
  if (state.status !== 'on') return;
  pending = text;
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}

export const flushNow = () => { clearTimeout(timer); return flush(); };
window.addEventListener('pagehide', () => { flushNow(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
