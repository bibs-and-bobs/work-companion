// The work log: the single source of truth for what happened on each day.
//
//   worklog = {
//     "2026-11-11": {
//       start: ISO string | null,   // set by "Begin day" (or edited in Calendar)
//       end:   ISO string | null,   // set by "End day"; null while working
//       notes: [{ id, t: ISO string, text, e?: ISO string }],             // e = last edited
//       todos: [{ id, text, done: ISO string | null, from?: "YYYY-MM-DD" }], // from = day it was first planned
//       kind:  "holiday" | "vacation" | "sick" | "half"                   // optional day type
//     }
//   }
//   Optional fields are left out when empty, and a day with nothing in it is removed.
//
// Everything that shows hours (Today, Week, Calendar, Timesheet) goes through dayStats(),
// so the rules below live in exactly one place.
//
// Two lengths (see settings.js): "time at work" (default 9h, Begin day -> home) drives the
// countdown and progress bar. "Counted work" (default 8h = 9h minus the unpaid break) drives
// worked hours and the week total. The break is not placed anywhere in the day: worked time
// grows evenly so that a full day at work counts exactly the counted work.
//
// Day types: holiday / vacation / sick remove the day from the week total (nothing expected).
// A half day halves that day's time at work, break and counted work.
// If you actually begin a day that has a type, the day is worked as normal.
import * as store from './store.js';
import * as settings from './settings.js';
import { dateKey, fromKey, weekdayIndex, addDays, startOfWeek } from './time.js';

export const KINDS = {
  holiday: { label: 'Public holiday', short: 'holiday', tag: 'HOL', sub: 'Public holiday. Enjoy it.' },
  vacation: { label: 'Vacation', short: 'vacation', tag: 'VAC', sub: 'Enjoy the time off.' },
  sick: { label: 'Sick day', short: 'sick', tag: 'SICK', sub: 'Rest up and get well.' },
  half: { label: 'Half day', short: 'half day', tag: '½', factor: 0.5 },
};

const NS = 'worklog';
const all = () => store.get(NS, {});
const emptyDay = () => ({ start: null, end: null, notes: [], todos: [], kind: null });
const newId = (now) => `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// Removes empty optional fields and drops a day that holds nothing.
function tidy(log, key) {
  const day = log[key];
  if (!day) return;
  if (!day.start) day.end = null;
  if (!day.kind) delete day.kind;
  if (!day.todos?.length) delete day.todos;
  if (!day.start && !day.notes.length && !day.todos && !day.kind) delete log[key];
}

function applyTo(log, date, fn) {
  const key = dateKey(date);
  const day = { ...emptyDay(), ...log[key] };
  day.notes = day.notes ?? [];
  day.todos = day.todos ?? [];
  fn(day);
  log[key] = day;
  tidy(log, key);
}

function update(date, fn) {
  const log = all();
  applyTo(log, date, fn);
  store.set(NS, log);
}

export const getDay = (date) => all()[dateKey(date)] ?? null;

// ── Actions: times ──
export const beginDay = (now = new Date()) => update(now, (d) => { d.start = now.toISOString(); d.end = null; });
export const endDay = (now = new Date()) => update(now, (d) => { if (d.start) d.end = now.toISOString(); });
export const resumeDay = (date) => update(date, (d) => { d.end = null; });
export const clearTimes = (date) => update(date, (d) => { d.start = null; d.end = null; });
// start/end: Date | null | undefined (undefined = leave unchanged)
export const setTimes = (date, { start, end }) => update(date, (d) => {
  if (start !== undefined) d.start = start ? start.toISOString() : null;
  if (end !== undefined) d.end = end ? end.toISOString() : null;
});

// ── Actions: day type ──
export const setKind = (date, kind) => update(date, (d) => { d.kind = KINDS[kind] ? kind : null; });

// Sets the type on every day from `from` to `to` (one save). Setting a type skips days
// that are not workdays and days already worked; clearing (kind = null) clears every day in range.
export function setKindRange(from, to, kind) {
  const log = all();
  const workdays = settings.get().workdays;
  const valid = KINDS[kind] ? kind : null;
  let day = new Date(from);
  for (let i = 0; i < 366 && dateKey(day) <= dateKey(to); i++, day = addDays(day, 1)) {
    const rec = log[dateKey(day)];
    if (valid && (!workdays[weekdayIndex(day)] || rec?.start)) continue;
    applyTo(log, day, (d) => { d.kind = valid; });
  }
  store.set(NS, log);
}

// ── Actions: notes ──
export function addNote(text, date = new Date(), now = new Date()) {
  const clean = text.trim();
  if (!clean) return;
  update(date, (d) => { d.notes.push({ id: newId(now), t: now.toISOString(), text: clean }); });
}
// Changes a note's text. The original timestamp stays; `e` records when it was edited.
export const editNote = (date, id, text, now = new Date()) => {
  const clean = text.trim();
  if (!clean) return;
  update(date, (d) => {
    const n = d.notes.find((x) => x.id === id);
    if (n && n.text !== clean) { n.text = clean; n.e = now.toISOString(); }
  });
};
export const deleteNote = (date, id) => update(date, (d) => { d.notes = d.notes.filter((n) => n.id !== id); });

// Every note on every day, newest first: [{ key, date, note }]. Used by search.
export function allNotes() {
  const out = [];
  for (const [key, rec] of Object.entries(all())) {
    for (const note of rec.notes ?? []) out.push({ key, date: fromKey(key), note });
  }
  return out.sort((a, b) => b.note.t.localeCompare(a.note.t));
}

// ── Actions: to-dos ──
// A to-do lives on one day. Open ones left on past days are moved to today by carryOver().
export function addTodo(text, date = new Date(), now = new Date()) {
  const clean = text.trim();
  if (!clean) return;
  update(date, (d) => { d.todos.push({ id: newId(now), text: clean, done: null }); });
}
export const toggleTodo = (date, id, now = new Date()) => update(date, (d) => {
  const t = d.todos.find((x) => x.id === id);
  if (t) t.done = t.done ? null : now.toISOString();
});
export const editTodo = (date, id, text) => {
  const clean = text.trim();
  if (!clean) return;
  update(date, (d) => { const t = d.todos.find((x) => x.id === id); if (t) t.text = clean; });
};
export const deleteTodo = (date, id) => update(date, (d) => { d.todos = d.todos.filter((t) => t.id !== id); });

// Moves open to-dos from earlier days to today (finished ones stay as that day's history).
// Saves only if something moved. Returns how many were moved. Call at startup and after midnight.
export function carryOver(now = new Date()) {
  const log = all();
  const todayKey = dateKey(now);
  const moving = [];
  for (const key of Object.keys(log).sort()) {
    if (key >= todayKey) continue;
    const todos = log[key].todos ?? [];
    const open = todos.filter((t) => !t.done);
    if (!open.length) continue;
    moving.push(...open.map((t) => ({ ...t, from: t.from ?? key })));
    log[key].todos = todos.filter((t) => t.done);
    tidy(log, key);
  }
  if (!moving.length) return 0;
  applyTo(log, now, (d) => { d.todos = [...moving, ...d.todos]; });
  store.set(NS, log);
  return moving.length;
}

// ── Derived numbers ──
// state: 'idle'     workday today, not begun yet
//        'working'  begun, before home time
//        'overtime' begun today, past home time, not ended
//        'ended'    ended (or a past day that was never ended: counted as a full day)
//        'planned'  future workday
//        'missed'   past workday with no start (not counted in totals)
//        'off'      non-workday with no start
//        'leave'    holiday / vacation / sick day with no start (not counted in totals)
export function dayStats(date, now = new Date()) {
  const s = settings.get();
  const key = dateKey(date);
  const todayKey = dateKey(now);
  const rec = all()[key];
  const kind = KINDS[rec?.kind] ? rec.kind : null;
  const factor = KINDS[kind]?.factor ?? 1;               // a half day halves everything
  const presenceMs = s.dayLengthMin * 60_000 * factor;   // time at work (countdown)
  const breakMs = s.breakMin * 60_000 * factor;
  const targetMs = presenceMs - breakMs;                 // counted work for a full day
  const base = {
    date, key, presenceMs, breakMs, targetMs, kind,
    isToday: key === todayKey, isPast: key < todayKey, isFuture: key > todayKey,
    isWorkday: s.workdays[weekdayIndex(date)],
    notes: rec?.notes ?? [],
    todos: rec?.todos ?? [],
  };

  if (rec?.start) {
    const start = new Date(rec.start);
    const end = rec.end ? new Date(rec.end) : null;
    const finish = new Date(start.getTime() + presenceMs);   // home time
    const stop = end ?? (base.isToday ? now : finish);
    const elapsedMs = Math.max(0, stop - start);
    const overMs = Math.max(0, elapsedMs - presenceMs);
    const workedMs = elapsedMs <= presenceMs ? (elapsedMs * targetMs) / presenceMs : targetMs + overMs;
    const state = end || !base.isToday ? 'ended' : now >= finish ? 'overtime' : 'working';
    return {
      ...base, start, end, finish, state, elapsedMs, overMs, workedMs, counts: true,
      leftMs: state === 'ended' ? 0 : Math.max(0, presenceMs - elapsedMs),    // until home
      workLeftMs: state === 'ended' ? 0 : Math.max(0, targetMs - workedMs),   // counted work still to do
      pct: Math.min(1, elapsedMs / presenceMs),
    };
  }
  if (kind && KINDS[kind].factor === undefined) {
    return { ...base, state: 'leave', counts: false, elapsedMs: 0, overMs: 0, workedMs: 0, pct: 0, leftMs: 0, workLeftMs: 0 };
  }
  const state = !base.isWorkday ? 'off' : base.isPast ? 'missed' : base.isToday ? 'idle' : 'planned';
  const counts = state === 'idle' || state === 'planned';
  return {
    ...base, state, counts, elapsedMs: 0, overMs: 0, workedMs: 0, pct: 0,
    leftMs: counts ? presenceMs : 0, workLeftMs: counts ? targetMs : 0,
  };
}

export function weekStats(now = new Date()) {
  const monday = startOfWeek(now);
  const days = Array.from({ length: 7 }, (_, i) => dayStats(addDays(monday, i), now));
  const counted = days.filter((d) => d.counts);
  const workedMs = counted.reduce((a, d) => a + d.workedMs, 0);
  const leftMs = counted.reduce((a, d) => a + d.workLeftMs, 0);   // counted work still to do
  const totalMs = workedMs + leftMs;
  return { days, workedMs, leftMs, totalMs, pct: totalMs ? workedMs / totalMs : 0 };
}

// Everything between two dates (inclusive), for the Timesheet:
// { days: [dayStats], workedMs, daysWorked, leave: { vacation: 2, ... } }
export function rangeStats(from, to, now = new Date()) {
  const days = [];
  for (let d = new Date(from), i = 0; dateKey(d) <= dateKey(to) && i < 400; d = addDays(d, 1), i++) days.push(dayStats(d, now));
  const leave = {};
  for (const d of days) if (d.state === 'leave') leave[d.kind] = (leave[d.kind] ?? 0) + 1;
  return {
    days, leave,
    workedMs: days.reduce((a, d) => a + d.workedMs, 0),
    daysWorked: days.filter((d) => d.start).length,
  };
}
