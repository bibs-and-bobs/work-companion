// Date/time helpers. Pure functions, no state, no DOM.
// Days are identified by a local "YYYY-MM-DD" key everywhere in the app.

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const pad = (n) => String(n).padStart(2, '0');

export const weekdayIndex = (d) => (d.getDay() + 6) % 7; // Monday = 0
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const startOfWeek = (d) => addDays(startOfDay(d), -weekdayIndex(d));
export const toHHMM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

// A Date on `day` at "HH:MM".
export function atTime(day, hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = startOfDay(day);
  d.setHours(h, m, 0, 0);
  return d;
}

export function fmtDuration(ms, { seconds = false } = {}) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (seconds) return `${h}:${pad(m)}:${pad(s % 60)}`;
  return h ? `${h}h ${pad(m)}m` : `${m}m`;
}

export const fmtTime = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (d, opts = { weekday: 'long', day: 'numeric', month: 'long' }) => d.toLocaleDateString([], opts);
