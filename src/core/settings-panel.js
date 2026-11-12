// Core section of the Settings drawer: time at work, unpaid break, workdays.
import { DAY_NAMES } from './time.js';

const hoursText = (min) => `${+(min / 60).toFixed(2)}`;

export function settingsPanel({ h, settings }) {
  const s = settings.get();
  const hint = h('span.field-hint');
  const showHint = () => {
    const c = settings.get();
    hint.textContent = `A full day counts ${hoursText(c.dayLengthMin - c.breakMin)} hours of work.`;
  };

  const number = (value, min, max, fallback, onSave) => h('input.input', {
    type: 'number', min, max, step: 0.25, value: hoursText(value),
    onchange: (e) => {
      const v = Math.min(max, Math.max(min, Number(e.target.value) || fallback));
      e.target.value = v;
      onSave(Math.round(v * 60));
      showHint();
    },
  });

  const len = number(s.dayLengthMin, 1, 16, 9, (m) => settings.set({ dayLengthMin: m }));
  const brk = number(s.breakMin, 0, 4, 1, (m) => settings.set({ breakMin: m }));

  const days = DAY_NAMES.map((name, i) => h('label.chip',
    h('input', { type: 'checkbox', checked: s.workdays[i], onchange: (e) => {
      const workdays = settings.get().workdays;
      workdays[i] = e.target.checked;
      settings.set({ workdays });
    } }),
    h('span', name)));

  showHint();
  return h('div.form',
    h('label.field', h('span.field-label', 'Time at work (hours)'), len,
      h('span.field-hint', 'From Begin day until you go home. This is the countdown.')),
    h('label.field', h('span.field-label', 'Unpaid break (hours)'), brk, hint),
    h('div.field', h('span.field-label', 'Workdays'), h('div.chips', days),
      h('span.field-hint', 'Used for the week total. You can still begin a day off.')));
}
