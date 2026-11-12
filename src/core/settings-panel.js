// Core section of the Settings drawer: day length + workdays.
import { DAY_NAMES } from './time.js';

export function settingsPanel({ h, settings }) {
  const s = settings.get();

  const hours = h('input.input', {
    type: 'number', min: 1, max: 16, step: 0.25, value: s.dayLengthMin / 60,
    onchange: (e) => {
      const v = Math.min(16, Math.max(1, Number(e.target.value) || 9));
      e.target.value = v;
      settings.set({ dayLengthMin: Math.round(v * 60) });
    },
  });

  const days = DAY_NAMES.map((name, i) => h('label.chip',
    h('input', { type: 'checkbox', checked: s.workdays[i], onchange: (e) => {
      const workdays = settings.get().workdays;
      workdays[i] = e.target.checked;
      settings.set({ workdays });
    } }),
    h('span', name)));

  return h('div.form',
    h('label.field', h('span.field-label', 'Day length (hours)'), hours,
      h('span.field-hint', 'The countdown after you press Begin day.')),
    h('div.field', h('span.field-label', 'Workdays'), h('div.chips', days),
      h('span.field-hint', 'Used for the week total. You can still begin a day off.')));
}
