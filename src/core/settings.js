// User settings shared by the whole app.
import * as store from './store.js';

export const DEFAULTS = {
  dayLengthMin: 9 * 60,                                   // length of a work day, from "Begin day"
  workdays: [true, true, true, true, true, false, false], // Mon..Sun
};

export const get = () => ({ ...DEFAULTS, ...store.get('settings', {}) });
export const set = (patch) => store.set('settings', { ...get(), ...patch });
export const dayLengthMs = () => get().dayLengthMin * 60_000;
