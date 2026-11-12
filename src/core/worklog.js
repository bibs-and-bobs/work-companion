// The work log: the single source of truth for what happened on each day.
//
//   worklog = {
//     "2026-11-11": {
//       start: ISO string | null,   // set by "Begin day" (or edited in Calendar)
//       end:   ISO string | null,   // set by "End day"; null while working
//       notes: [{ id, t: ISO string, text }]
//     }
//   }
//
// Everything that shows hours (Today, Week, Calendar) goes through dayStats(),
// so the rules below live in exactly one place.
import * as store from './store.js';
import * as settings from './settings.js';
import { dateKey, weekdayIndex, addDays, startOfWeek } from './time.js';

const NS = 'worklog';
const all = () => store.get(NS, {});
const emptyDay = () => ({ start: null, end: null, notes: [] });

export const getDay = (date) => all()[dateKey(date)] ?? null;

function update(date, fn) {
  const log = all();
  const key = dateKey(date);
  const day = log[key] ?? emptyDay();
  fn(day);
  if (!day.start) day.end = null;
  if (!day.start && !day.notes.length) delete log[key];
  else log[key] = day;
  store.set(NS, log);
}

// ── Actions ──
export const beginDay = (now = new Date()) => update(now, (d) => { d.start = now.toISOString(); d.end = null; });
export const endDay = (now = new Date()) => update(now, (d) => { if (d.start) d.end = now.toISOString(); });
export const resumeDay = (date) => update(date, (d) => { d.end = null; });
export const clearTimes = (date) => update(date, (d) => { d.start = null; d.end = null; });
// start/end: Date | null | undefined (undefined = leave unchanged)
export const setTimes = (date, { start, end }) => update(date, (d) => {
  if (start !== undefined) d.start = start ? start.toISOString() : null;
  if (end !== undefined) d.end = end ? end.toISOString() : null;
});

export function addNote(text, date = new Date(), now = new Date()) {
  const clean = text.trim();
  if (!clean) return;
  const id = `${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  update(date, (d) => { d.notes.push({ id, t: now.toISOString(), text: clean }); });
}
export const deleteNote = (date, id) => update(date, (d) => { d.notes = d.notes.filter((n) => n.id !== id); });

// ── Derived numbers ──
// state: 'idle'     workday today, not begun yet
//        'working'  begun, under the day length
//        'overtime' begun today, past the day length, not ended
//        'ended'    ended (or a past day that was never ended: counted as a full day)
//        'planned'  future workday
//        'missed'   past workday with no start (not counted in totals)
//        'off'      non-workday with no start
export function dayStats(date, now = new Date()) {
  const s = settings.get();
  const targetMs = s.dayLengthMin * 60_000;
  const key = dateKey(date);
  const todayKey = dateKey(now);
  const rec = all()[key];
  const base = {
    date, key, targetMs,
    isToday: key === todayKey, isPast: key < todayKey, isFuture: key > todayKey,
    isWorkday: s.workdays[weekdayIndex(date)],
    notes: rec?.notes ?? [],
  };

  if (rec?.start) {
    const start = new Date(rec.start);
    const end = rec.end ? new Date(rec.end) : null;
    const finish = new Date(start.getTime() + targetMs);
    const stop = end ?? (base.isToday ? now : finish);
    const workedMs = Math.max(0, stop - start);
    const state = end || !base.isToday ? 'ended' : now >= finish ? 'overtime' : 'working';
    return {
      ...base, start, end, finish, state, workedMs, counts: true,
      leftMs: state === 'ended' ? 0 : Math.max(0, targetMs - workedMs),
      pct: Math.min(1, workedMs / targetMs),
    };
  }
  const state = !base.isWorkday ? 'off' : base.isPast ? 'missed' : base.isToday ? 'idle' : 'planned';
  const counts = state === 'idle' || state === 'planned';
  return { ...base, state, counts, workedMs: 0, leftMs: counts ? targetMs : 0, pct: 0 };
}

export function weekStats(now = new Date()) {
  const monday = startOfWeek(now);
  const days = Array.from({ length: 7 }, (_, i) => dayStats(addDays(monday, i), now));
  const counted = days.filter((d) => d.counts);
  const workedMs = counted.reduce((a, d) => a + d.workedMs, 0);
  const leftMs = counted.reduce((a, d) => a + d.leftMs, 0);
  const totalMs = workedMs + leftMs;
  return { days, workedMs, leftMs, totalMs, pct: totalMs ? workedMs / totalMs : 0 };
}
