// Water: a glass in blue ink that fills as you log glasses. Glasses are saved on the day
// in the work log (record.water), so the Calendar and past days keep them.
// While the day is running it also says whether you're keeping up with the goal.
// Private data (ctx.ns): { goal: 8 }
export default {
  id: 'water',
  title: 'Water',
  view: 'today',
  ink: 'blue',

  mount(el, { h, worklog, onTick, onData, ns }) {
    const level = h('div.water-level');
    const glass = h('div.water-glass', { 'aria-hidden': 'true' }, level);
    const count = h('div.water-count');
    const pace = h('p.water-pace');
    const marks = h('div.water-marks', { 'aria-hidden': 'true' });
    const add = h('button.btn.btn-primary-sm', { onclick: () => change(1) }, '+ Glass');
    const less = h('button.btn.btn-icon', { onclick: () => change(-1), 'aria-label': 'One glass less', title: 'One glass less' }, '−');
    el.append(h('div.water', glass, h('div.water-info', count, marks, pace, h('div.btn-row', add, less))));

    const goal = () => ns.get({}).goal ?? 8;
    const glasses = (now) => worklog.getDay(now)?.water ?? 0;
    function change(n) {
      const now = new Date();
      worklog.setWater(now, glasses(now) + n);
    }

    let last = '';
    function render(now = new Date()) {
      const n = glasses(now);
      const g = goal();
      const d = worklog.dayStats(now, now);
      const running = d.state === 'working' || d.state === 'overtime';
      const expected = running ? Math.floor(g * Math.min(1, d.elapsedMs / d.presenceMs)) : null;
      const k = `${n}|${g}|${expected}`;
      if (k === last) return;
      last = k;
      level.style.height = `${Math.min(1, n / g) * 100}%`;
      el.dataset.full = String(n >= g);
      count.replaceChildren(h('strong', String(n)), ` / ${g} glasses`);
      marks.replaceChildren(...Array.from({ length: Math.max(g, n) }, (_, i) => h(`span.water-mark${i < n ? '.is-full' : ''}`)));
      less.disabled = n === 0;
      pace.textContent = n >= g ? 'Goal reached. Nice.'
        : expected == null ? (n ? 'Keep it going.' : 'Start with a glass now.')
          : n >= expected ? 'On track for today.'
            : `${expected - n} behind. Time for a glass.`;
    }

    render();
    const offTick = onTick((now) => { if (now.getSeconds() === 0) render(now); });
    const offData = onData((name) => { if (name === 'worklog' || name === 'mod:water') render(); });
    return () => { offTick(); offData(); };
  },

  settings(el, { h, ns }) {
    el.append(h('div.form', h('label.field', h('span.field-label', 'Daily goal (glasses)'),
      h('input.input', { type: 'number', min: 1, max: 20, step: 1, value: ns.get({}).goal ?? 8, onchange: (e) => {
        const v = Math.min(20, Math.max(1, Math.round(Number(e.target.value)) || 8));
        e.target.value = v;
        ns.set({ ...ns.get({}), goal: v });
      } }),
      h('span.field-hint', 'About 250 ml a glass. 8 is a common goal.'))));
  },
};
