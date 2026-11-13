// Week: the shape of the working week and where you are in it.
export default {
  id: 'week',
  title: 'This week',
  view: 'today',
  ink: 'blue',
  span: 'full',

  mount(el, { h, worklog, time, nav, onTick, onData }) {
    const dur = time.fmtDuration;
    const { KINDS } = worklog;
    const summary = h('div.week-summary');
    const ribbon = h('div.ribbon');
    const cols = h('div.week-cols');
    el.append(summary, ribbon, cols);

    const label = (d) => ({
      off: 'off', missed: '—', leave: KINDS[d.kind]?.short, planned: dur(d.targetMs), idle: dur(d.targetMs),
      working: `${dur(d.leftMs)} left`, overtime: dur(d.workedMs), ended: dur(d.workedMs),
    })[d.state];

    let lastKey = '';
    const render = (now = new Date()) => {
      const w = worklog.weekStats(now);
      const key = w.days.map((d) => `${d.key}:${d.state}:${d.counts}`).join('|');
      if (key !== lastKey) {
        lastKey = key;
        ribbon.replaceChildren(...w.days.filter((d) => d.counts).map((d) =>
          h('div.ribbon-seg', { 'data-key': d.key, title: d.key }, h('div.ribbon-fill'))));
        cols.replaceChildren(...w.days.map((d) =>
          h(`button.day.state-${d.state}${d.isToday ? '.is-today' : ''}`,
            { 'data-key': d.key, title: 'Open in Calendar', onclick: () => nav.go('calendar', d.key) },
            h('div.day-bar', h('div.day-fill')),
            h('div.day-name', time.DAY_NAMES[time.weekdayIndex(d.date)]),
            h('div.day-date', d.date.getDate()),
            h('div.day-hours'))));
      }

      const counted = w.days.filter((d) => d.counts);
      const done = counted.filter((d) => d.state === 'ended').length;
      summary.replaceChildren(
        h('div.week-big.reg-text', `${Math.round(w.pct * 100)}%`),
        h('div.week-meta',
          h('div', h('strong', dur(w.workedMs)), ' worked'),
          h('div', h('strong', dur(w.leftMs)), ' left this week'),
          h('div.muted', `${done} of ${counted.length} days done`)));

      for (const d of w.days) {
        const seg = ribbon.querySelector(`[data-key="${d.key}"] .ribbon-fill`);
        if (seg) seg.style.width = `${d.pct * 100}%`;
        const col = cols.querySelector(`[data-key="${d.key}"]`);
        col.querySelector('.day-fill').style.height = `${d.pct * 100}%`;
        col.querySelector('.day-hours').textContent = label(d);
        col.classList.toggle('has-notes', d.notes.length > 0);
      }
    };

    render();
    const offTick = onTick(render);
    const offData = onData(() => render());
    return () => { offTick(); offData(); };
  },
};
