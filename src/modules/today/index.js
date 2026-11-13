// Today: press "Begin day" and count down to home time (time at work, Settings).
// "Worked" is counted work (time at work minus the unpaid break).
export default {
  id: 'today',
  title: 'Today',
  view: 'today',
  ink: 'pink',
  span: 'full',

  mount(el, { h, worklog, time, nav, onTick, onData }) {
    const { fmtDuration: dur, fmtTime } = time;
    const { KINDS } = worklog;

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
        h('div', h('dt', 'Home in'), left),
        h('div', h('dt', 'Home at'), finish)),
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

      if (d.state === 'idle' || d.state === 'off' || d.state === 'leave') {
        const idle = d.state === 'idle';
        const eta = new Date(now.getTime() + d.presenceMs);
        headline.textContent = idle ? (d.kind === 'half' ? 'Half day. Ready?' : 'Ready when you are')
          : d.state === 'leave' ? KINDS[d.kind].label : 'Day off';
        sub.textContent = idle
          ? `${dur(d.presenceMs)} at work, ${dur(d.targetMs)} counted. Start now and you're home at ${fmtTime(eta)}.`
          : d.state === 'leave' ? `${KINDS[d.kind].sub} Not counted in this week's total.` : 'Not a workday. Rest up.';
        pct.textContent = idle ? '0%' : '—';
        startLbl.textContent = idle ? 'Now' : '';
        endLbl.textContent = idle ? fmtTime(eta) : '';
        worked.textContent = '—';
        left.textContent = idle ? dur(d.presenceMs) : '—';
        finish.textContent = idle ? `~${fmtTime(eta)}` : '—';
        setActions(d.state, () => [
          h(`button.btn${idle ? '.btn-primary' : ''}`,
            { onclick: () => worklog.beginDay(new Date()) }, idle ? 'Begin day' : 'Begin anyway'),
          h('button.link', { onclick: () => nav.go('calendar', d.key) }, idle ? 'Mark as day off…' : 'Change day type…'),
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
        sub.textContent = `${dur(d.overMs)} past home time. Time to log off.`;
        left.textContent = '0m';
        finish.textContent = fmtTime(d.finish);
        setActions('overtime', () => [
          h('button.btn.btn-primary', { onclick: () => worklog.endDay(new Date()) }, 'End day'), editLink(d)]);
      } else { // ended
        headline.textContent = `Logged ${dur(d.workedMs)}`;
        sub.textContent = `${fmtTime(d.start)} – ${fmtTime(d.end)}. See you tomorrow.`;
        left.textContent = '—';
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
