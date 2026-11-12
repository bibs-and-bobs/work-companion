// Today: press "Begin day" and count down the day length (Settings).
export default {
  id: 'today',
  title: 'Today',
  view: 'today',
  ink: 'pink',
  span: 'full',

  mount(el, { h, worklog, time, nav, onTick, onData }) {
    const { fmtDuration: dur, fmtTime } = time;

    const headline = h('div.today-headline.reg-text');
    const sub = h('div.today-sub');
    const pct = h('div.today-pct');
    const fill = h('div.bar-fill');
    const marker = h('div.bar-marker');
    const startLbl = h('span');
    const endLbl = h('span');
    const worked = h('dd');
    const left = h('dd');
    const finish = h('dd');
    const actions = h('div.actions');

    el.append(
      h('div.today-top', h('div', headline, sub), pct),
      h('div.bar', h('div.bar-track'), fill, marker),
      h('div.bar-labels', startLbl, endLbl),
      h('dl.stats',
        h('div', h('dt', 'Worked'), worked),
        h('div', h('dt', 'Left'), left),
        h('div', h('dt', 'Finish'), finish)),
      actions,
    );

    const editLink = (d) => h('button.link', { onclick: () => nav.go('calendar', d.key) }, 'Edit times');

    // Buttons only rebuild when the state changes, so clicks never land on a stale node.
    let lastActions = '';
    const setActions = (key, build) => {
      if (key === lastActions) return;
      lastActions = key;
      actions.replaceChildren(...build());
    };

    const render = (now = new Date()) => {
      const d = worklog.dayStats(now, now);
      el.dataset.state = d.state;
      const pctNum = Math.round(d.pct * 100);
      fill.style.width = marker.style.left = `${d.pct * 100}%`;
      marker.dataset.edge = d.pct < 0.04 ? 'start' : d.pct > 0.96 ? 'end' : '';

      if (d.state === 'idle' || d.state === 'off') {
        const eta = new Date(now.getTime() + d.targetMs);
        headline.textContent = d.state === 'idle' ? 'Ready when you are' : 'Day off';
        sub.textContent = d.state === 'idle'
          ? `${dur(d.targetMs)} day. Start now and you're done at ${fmtTime(eta)}.`
          : 'Not a workday. Rest up.';
        pct.textContent = d.state === 'idle' ? '0%' : '—';
        startLbl.textContent = d.state === 'idle' ? 'Now' : '';
        endLbl.textContent = d.state === 'idle' ? fmtTime(eta) : '';
        worked.textContent = '—';
        left.textContent = d.state === 'idle' ? dur(d.targetMs) : '—';
        finish.textContent = d.state === 'idle' ? `~${fmtTime(eta)}` : '—';
        setActions(d.state, () => [
          h(`button.btn${d.state === 'idle' ? '.btn-primary' : ''}`,
            { onclick: () => worklog.beginDay(new Date()) }, d.state === 'idle' ? 'Begin day' : 'Begin anyway'),
        ]);
        return;
      }

      startLbl.textContent = fmtTime(d.start);
      endLbl.textContent = fmtTime(d.finish);
      worked.textContent = dur(d.workedMs);
      pct.textContent = `${pctNum}%`;

      if (d.state === 'working') {
        headline.textContent = `${dur(d.leftMs)} to go`;
        sub.textContent = d.pct < 0.5 ? 'Plenty of runway.' : d.pct < 0.85 ? 'Past the midpoint. Keep the rhythm.' : 'Home stretch.';
        left.textContent = dur(d.leftMs, { seconds: true });
        finish.textContent = fmtTime(d.finish);
        setActions('working', () => [
          h('button.btn', { onclick: () => worklog.endDay(new Date()) }, 'End day'), editLink(d)]);
      } else if (d.state === 'overtime') {
        headline.textContent = 'Day complete';
        sub.textContent = `${dur(d.workedMs - d.targetMs)} over. Time to log off.`;
        left.textContent = '0m';
        finish.textContent = fmtTime(d.finish);
        setActions('overtime', () => [
          h('button.btn.btn-primary', { onclick: () => worklog.endDay(new Date()) }, 'End day'), editLink(d)]);
      } else { // ended
        headline.textContent = `Logged ${dur(d.workedMs)}`;
        sub.textContent = `${fmtTime(d.start)} – ${fmtTime(d.end)}. See you tomorrow.`;
        left.textContent = dur(Math.max(0, d.targetMs - d.workedMs));
        finish.textContent = fmtTime(d.end);
        setActions('ended', () => [
          h('button.btn', { onclick: () => worklog.resumeDay(new Date()) }, 'Resume'), editLink(d)]);
      }
    };

    render();
    const offTick = onTick(render);
    const offData = onData(() => render());
    return () => { offTick(); offData(); };
  },
};
