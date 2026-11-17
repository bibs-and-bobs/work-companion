// To-dos. An open to-do is not tied to a day: it always shows as today's.
// Once ticked it belongs to the day it was ticked (its `done` time). Ticking again after
// unticking replaces that time, so only the last tick counts.
//
//   tasks = [{
//     id, text,
//     created: ISO string,                          // when it was added
//     done:    ISO string | null,                   // last tick; null while open
//     remind?: { date: "YYYY-MM-DD", time?: "HH:MM" },  // optional reminder (date only = that morning)
//     reminded?: ISO string,                        // the due moment already shown, so it pops once
//   }]
import * as store from './store.js';
import { dateKey, fromKey, atTime, toHHMM, addDays } from './time.js';

const NS = 'tasks';
const all = () => store.get(NS, []);
const save = (list) => store.set(NS, list);
const newId = (now) => `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Date-only reminders pop at this time of that day.
export const DAY_REMINDER_TIME = '09:00';

// ── Reading ──
export const list = () => all();
export const get = (id) => all().find((t) => t.id === id) ?? null;
export const open = () => all().filter((t) => !t.done);
export const doneOn = (date) => all()
  .filter((t) => t.done && dateKey(new Date(t.done)) === dateKey(date))
  .sort((a, b) => a.done.localeCompare(b.done));
export const remindersOn = (date) => open().filter((t) => t.remind?.date === dateKey(date));

// When a reminder is due (a Date), or null.
export function dueAt(t) {
  if (!t.remind?.date) return null;
  return atTime(fromKey(t.remind.date), t.remind.time || DAY_REMINDER_TIME);
}

// Open to-dos in display order: reminders that are due first (oldest first), then
// upcoming reminders (soonest first), then the rest (oldest first).
export function sortOpen(list, now = new Date()) {
  const rank = (t) => { const d = dueAt(t); return !d ? 2 : d <= now ? 0 : 1; };
  return [...list].sort((a, b) => rank(a) - rank(b)
    || (dueAt(a) ?? 0) - (dueAt(b) ?? 0)
    || a.created.localeCompare(b.created));
}

// Reminders that should pop now: open, due, and not already shown for this due moment.
export function due(now = new Date()) {
  return open().filter((t) => {
    const d = dueAt(t);
    return d && d <= now && t.reminded !== d.toISOString();
  });
}

// Turns form input into a stored reminder. A time without a date means the next time
// that clock time comes round (today if still ahead, otherwise tomorrow). Nothing = no reminder.
export function makeRemind({ date = '', time = '' } = {}, now = new Date()) {
  if (!date && !time) return null;
  if (!date) date = dateKey(time > toHHMM(now) ? now : addDays(now, 1));
  return time ? { date, time } : { date };
}

// ── Changing ──
export function add(text, { remind = null } = {}, now = new Date()) {
  const clean = text.trim();
  if (!clean) return null;
  const task = { id: newId(now), text: clean, created: now.toISOString(), done: null };
  if (remind) task.remind = remind;
  save([...all(), task]);
  return task;
}

function change(id, fn) {
  const list = all();
  const t = list.find((x) => x.id === id);
  if (!t) return;
  fn(t);
  if (!t.remind) delete t.remind;
  save(list);
}

export const toggle = (id, now = new Date()) => change(id, (t) => { t.done = t.done ? null : now.toISOString(); });

// patch: { text?, remind? }. remind: object = set, null = remove, undefined = keep.
export const edit = (id, { text, remind } = {}) => change(id, (t) => {
  if (text !== undefined && text.trim()) t.text = text.trim();
  if (remind !== undefined) { t.remind = remind; delete t.reminded; }
});

export const remove = (id) => save(all().filter((t) => t.id !== id));

// Remembers that a reminder has been shown, so it doesn't pop again on the next check or reload.
export function markReminded(ids) {
  const list = all();
  let changed = false;
  for (const t of list) {
    if (!ids.includes(t.id)) continue;
    const d = dueAt(t);
    if (d && t.reminded !== d.toISOString()) { t.reminded = d.toISOString(); changed = true; }
  }
  if (changed) save(list);
}

export function snooze(id, minutes, now = new Date()) {
  const at = new Date(now.getTime() + minutes * 60_000);
  edit(id, { remind: { date: dateKey(at), time: toHHMM(at) } });
}
