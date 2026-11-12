// User settings shared by the whole app.
import * as store from './store.js';

// dayLengthMin: time at work, from "Begin day" until you go home (the countdown).
// breakMin:     unpaid break inside that time. It is not counted as work.
// Counted work per day = dayLengthMin - breakMin (default 9h - 1h = 8h).
export const DEFAULTS = {
  dayLengthMin: 9 * 60,
  breakMin: 60,
  workdays: [true, true, true, true, true, false, false], // Mon..Sun
};

export function get() {
  const s = { ...DEFAULTS, ...store.get('settings', {}) };
  s.breakMin = Math.max(0, Math.min(s.breakMin, s.dayLengthMin - 30)); // always leave 30 min of work
  return s;
}
export const set = (patch) => store.set('settings', { ...get(), ...patch });
export const dayLengthMs = () => get().dayLengthMin * 60_000;                      // time at work
export const workLengthMs = () => (get().dayLengthMin - get().breakMin) * 60_000;  // counted work
