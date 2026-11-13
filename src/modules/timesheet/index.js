// Timesheet: hours for a week or month, as a table you can copy as text or download as CSV.
export default {
  id: 'timesheet',
  title: 'Timesheet',
  view: 'calendar',
  ink: 'blue',
  span: 'full',

  mount(el, { h, worklog, time, onData, onTick }) {
    const { addDays, startOfWeek, toHHMM, fmtDuration: dur, fmtDate } = time;
    const { KINDS } = worklog;

    const PERIODS = {
      week: { label: 'This week', range: (n) => { const a = startOfWeek(n); return [a, addDays(a, 6)]; } },
      lastweek: { label: 'Last week', range: (n) => { const a = addDays(startOfWeek(n), -7); return [a, addDays(a, 6)]; } },
      month: { label: 'This month', range: (n) => [new Date(n.getFullYear(), n.getMonth(), 1), new Date(n.getFullYear(), n.getMonth() + 1, 0)] },
      lastmonth: { label: 'Last month', range: (n) => [new Date(n.getFullYear(), n.getMonth() - 1, 1), new Date(n.getFullYear(), n.getMonth(), 0)] },
    };

    let period = 'week';
    let withNotes = false;
    let view = null;   // what is on screen: { from, to, rows, stats }

    const select = h('select.input', {
      id: 'timesheet-period', 'aria-label': 'Period',
      onchange: () => { period = select.value; render(); },
    }, Object.entries(PERIODS).map(([id, p]) => h('option', { value: id }, p.label)));
    const notesBox = h('input', { type: 'checkbox', id: 'timesheet-notes', onchange: () => { withNotes = notesBox.checked; render(); } });
    const range = h('span.sheet-range');
    const tableWrap = h('div.sheet-wrap');
    const totals = h('p.sheet-totals');
    const status = h('span.field-hint');

    el.append(
      h('div.sheet-controls',
        h('label.field', h('span.field-label', 'Period'), select),
        h('label.chip-inline', notesBox, h('span', 'Include notes in the copy and CSV')),
        range),
      tableWrap, totals,
      h('div.btn-row',
        h('button.btn', { onclick: copy }, 'Copy summary'),
        h('button.btn', { onclick: download }, 'Download CSV'),
        status));

    // A day belongs on the sheet if it has anything on it, or it was a workday that is not in the future.
    const relevant = (d) => d.start || d.kind || d.notes.length || (d.isWorkday && !d.isFuture);
    const worked = (d) => (d.start ? dur(d.workedMs) : '');
    const times = (d) => (d.start ? `${toHHMM(d.start)}–${d.end ? toHHMM(d.end) : d.isToday ? '…' : toHHMM(d.finish)}` : '');
    const kindText = (d) => (d.kind ? KINDS[d.kind].label : d.state === 'missed' ? 'No record' : '');
    const dayName = (d) => d.date.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

    function render(now = new Date()) {
      const [from, to] = PERIODS[period].range(now);
      const stats = worklog.rangeStats(from, to, now);
      const rows = stats.days.filter(relevant);
      view = { from, to, rows, stats };

      range.textContent = `${fmtDate(from, { day: 'numeric', month: 'short' })} – ${fmtDate(to, { day: 'numeric', month: 'short', year: 'numeric' })}`;

      tableWrap.replaceChildren(rows.length
        ? h('table.sheet',
            h('thead', h('tr', ['Day', 'Time', 'Counted', 'Type', 'Notes'].map((t) => h('th', t)))),
            h('tbody', rows.map((d) => h(`tr.state-${d.state}${d.isToday ? '.is-today' : ''}`,
              h('td', dayName(d)), h('td', times(d)), h('td.num', worked(d)), h('td', kindText(d)),
              h('td.num', d.notes.length ? String(d.notes.length) : '')))))
        : h('p.muted', 'Nothing to show for this period yet.'));

      const leave = Object.entries(stats.leave).map(([k, n]) => `${n} ${KINDS[k].short}`).join(', ');
      totals.replaceChildren(...[
        h('strong', dur(stats.workedMs)), ` counted over ${stats.daysWorked} day${stats.daysWorked === 1 ? '' : 's'}`,
        leave ? h('span.muted', `  ·  ${leave}`) : null,
      ].filter(Boolean));
    }

    // ── Output ──
    function summaryText() {
      const { from, to, rows, stats } = view;
      const lines = [`Work hours ${fmtDate(from, { day: 'numeric', month: 'short' })} – ${fmtDate(to, { day: 'numeric', month: 'short', year: 'numeric' })}`, ''];
      for (const d of rows) {
        const detail = d.start ? `${times(d)}  ${worked(d)}` : kindText(d) || '—';
        lines.push(`${dayName(d).padEnd(11)} ${detail}${d.start && d.kind ? `  (${KINDS[d.kind].short})` : ''}`);
        if (withNotes) for (const n of d.notes) lines.push(`    - ${toHHMM(new Date(n.t))} ${n.text}`);
      }
      lines.push('', `Total: ${dur(stats.workedMs)} counted over ${stats.daysWorked} day${stats.daysWorked === 1 ? '' : 's'}`);
      return lines.join('\n');
    }

    // Spreadsheets treat cells starting with = + - @ as formulas, so a note can't run one.
    const safe = (v) => (/^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
    const cell = (v) => `"${safe(String(v)).replace(/"/g, '""')}"`;

    function csvText() {
      const head = ['Date', 'Weekday', 'Start', 'End', 'Counted (h:mm)', 'Counted (hours)', 'Day type', withNotes ? 'Notes' : null].filter(Boolean);
      const body = view.rows.map((d) => [
        d.key, d.date.toLocaleDateString('en', { weekday: 'long' }),
        d.start ? toHHMM(d.start) : '', d.end ? toHHMM(d.end) : '',
        d.start ? `${Math.floor(d.workedMs / 3_600_000)}:${String(Math.floor((d.workedMs % 3_600_000) / 60_000)).padStart(2, '0')}` : '',
        d.start ? (d.workedMs / 3_600_000).toFixed(2) : '',
        d.kind ? KINDS[d.kind].label : '',
        withNotes ? d.notes.map((n) => `${toHHMM(new Date(n.t))} ${n.text}`).join(' | ') : null,
      ].filter((v) => v !== null));
      return [head, ...body].map((r) => r.map(cell).join(',')).join('\r\n');
    }

    async function copy() {
      const text = summaryText();
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        const ta = h('textarea', { style: { position: 'fixed', opacity: 0 } });
        ta.value = text;
        document.body.append(ta);
        ta.select();
        const ok = document.execCommand?.('copy');
        ta.remove();
        if (!ok) return flash('Could not copy. Use Download CSV instead.');
      }
      flash('Copied.');
    }

    function download() {
      const blob = new Blob(['﻿' + csvText()], { type: 'text/csv;charset=utf-8' });   // BOM so Excel reads accents
      const a = h('a', { href: URL.createObjectURL(blob), download: `work-hours-${time.dateKey(view.from)}_${time.dateKey(view.to)}.csv` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      flash('Downloaded.');
    }

    let flashTimer;
    function flash(msg) {
      status.textContent = msg;
      clearTimeout(flashTimer);
      flashTimer = setTimeout(() => { status.textContent = ''; }, 2500);
    }

    render();
    const offData = onData(() => render());
    let lastMinute = -1;
    const offTick = onTick((now) => { if (now.getMinutes() !== lastMinute) { lastMinute = now.getMinutes(); render(now); } });
    return () => { offData(); offTick(); clearTimeout(flashTimer); };
  },
};
