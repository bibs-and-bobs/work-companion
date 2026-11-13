// Calendar: month overview of logged days, plus a detail panel for one day:
// start/end times, day type (holiday, vacation, sick, half day), tasks and notes.
export default {
  id: 'calendar',
  title: 'Calendar',
  view: 'calendar',
  ink: 'yellow',
  span: 'full',

  mount(el, { h, worklog, time, nav, widgets, onTick, onData }) {
    const { KINDS } = worklog;
    const { dateKey, fromKey, addDays, startOfWeek, fmtDuration: dur, fmtTime, fmtDate, toHHMM, atTime } = time;

    let selected = dateKey(new Date());
    let month = new Date(); month.setDate(1);

    const monthTitle = h('h3.cal-month');
    const grid = h('div.cal-grid');
    const detailHead = h('div.detail-head');
    const detailTimes = h('div.detail-times');
    const detailKind = h('div.detail-kind');
    const todoList = h('ul.todo-list');
    const todoInput = h('input.input', {
      type: 'text', placeholder: 'Add a task to this day', 'aria-label': 'Add a task to this day',
      onkeydown: (e) => { if (e.key === 'Enter') addTodo(); },
    });
    const noteList = h('ol.note-list.note-list-full');
    const noteInput = h('input.input', {
      type: 'text', placeholder: 'Add a note to this day', 'aria-label': 'Add a note to this day',
      onkeydown: (e) => { if (e.key === 'Enter') addNote(); },
    });

    const shiftMonth = (n) => { month = new Date(month.getFullYear(), month.getMonth() + n, 1); renderGrid(); };

    el.append(h('div.cal',
      h('section.cal-main',
        h('div.cal-head',
          h('button.btn.btn-icon', { onclick: () => shiftMonth(-1), 'aria-label': 'Previous month' }, '←'),
          monthTitle,
          h('button.btn.btn-icon', { onclick: () => shiftMonth(1), 'aria-label': 'Next month' }, '→'),
          h('button.btn', { onclick: () => nav.go('calendar', dateKey(new Date())) }, 'Today')),
        h('div.cal-weekdays', time.DAY_NAMES.map((n) => h('span', n))),
        grid),
      h('section.cal-detail',
        detailHead, detailTimes, detailKind,
        h('h4.detail-sub', 'Tasks'),
        todoList,
        h('div.note-form', todoInput, h('button.btn', { onclick: addTodo }, 'Add')),
        h('h4.detail-sub', 'Notes'),
        noteList,
        h('div.note-form', noteInput, h('button.btn', { onclick: addNote }, 'Add')))));

    function addTodo() {
      if (!todoInput.value.trim()) return;
      worklog.addTodo(todoInput.value, fromKey(selected), new Date());
      todoInput.value = '';
      todoInput.focus();
    }

    function addNote() {
      if (!noteInput.value.trim()) return;
      worklog.addNote(noteInput.value, fromKey(selected), new Date());
      noteInput.value = '';
      noteInput.focus();
    }

    // Compact "7:45" for small cells.
    const hhmm = (ms) => { const m = Math.floor(ms / 60_000); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

    function renderGrid(now = new Date()) {
      monthTitle.textContent = month.toLocaleDateString([], { month: 'long', year: 'numeric' });
      const first = startOfWeek(month);
      const cells = [];
      for (let i = 0; i < 42; i++) {
        const date = addDays(first, i);
        if (i === 35 && date.getMonth() !== month.getMonth()) break; // drop an empty 6th row
        const d = worklog.dayStats(date, now);
        const hours = d.start ? hhmm(d.workedMs) : '';
        cells.push(h(`button.cal-cell.state-${d.state}`
          + `${date.getMonth() !== month.getMonth() ? '.is-outside' : ''}`
          + `${d.isToday ? '.is-today' : ''}${d.key === selected ? '.is-selected' : ''}`,
          { onclick: () => nav.go('calendar', d.key), 'aria-label': fmtDate(date) },
          h('span.cal-num', date.getDate()),
          h('span.cal-bar', h('span.cal-fill', { style: { width: `${d.pct * 100}%` } })),
          h('span.cal-foot', h('span', hours || (d.kind ? KINDS[d.kind].tag : '')), d.notes.length ? h('span.cal-notes', `✎${d.notes.length}`) : null)));
      }
      grid.replaceChildren(...cells);
    }

    const STATE_TEXT = {
      idle: 'Not started', working: 'Working', overtime: 'Over time', ended: 'Logged',
      planned: 'Upcoming', missed: 'No record', off: 'Day off',
    };
    const stateText = (d) => (d.state === 'leave' ? KINDS[d.kind].label : STATE_TEXT[d.state]);

    function renderDetail(now = new Date()) {
      const date = fromKey(selected);
      const d = worklog.dayStats(date, now);
      detailHead.replaceChildren(...[
        h('h3.detail-date', fmtDate(date)),
        h(`span.badge.state-${d.state}`, stateText(d)),
        d.kind && d.state !== 'leave' ? h('span.badge', KINDS[d.kind].label) : null,
        d.start ? h('span.detail-worked', `${dur(d.workedMs)} worked`) : null,
      ].filter(Boolean));   // replaceChildren(null) would print the word "null"

      const startIn = h('input.input', { type: 'time', value: d.start ? toHHMM(d.start) : '', 'aria-label': 'Start time' });
      const endIn = h('input.input', { type: 'time', value: d.end ? toHHMM(d.end) : '', disabled: !d.start, 'aria-label': 'End time' });
      const hint = h('p.field-hint');
      if (d.start && !d.end && !d.isToday) hint.textContent = 'Never ended, so it counts as a full day.';
      if (!d.start && !d.isFuture) hint.textContent = 'Forgot to press Begin day? Set the start time here.';

      startIn.addEventListener('blur', () => {
        if (startIn.value === (d.start ? toHHMM(d.start) : '')) return;
        if (!startIn.value) return worklog.clearTimes(date);
        const start = atTime(date, startIn.value);
        const end = d.end && d.end > start ? undefined : null;
        worklog.setTimes(date, { start, end });
      });
      endIn.addEventListener('blur', () => {
        if (endIn.value === (d.end ? toHHMM(d.end) : '')) return;
        if (!endIn.value) return worklog.setTimes(date, { end: null });
        const end = atTime(date, endIn.value);
        if (end <= d.start) { hint.textContent = 'End must be after start.'; endIn.value = d.end ? toHHMM(d.end) : ''; return; }
        worklog.setTimes(date, { end });
      });

      for (const inp of [startIn, endIn]) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });

      detailTimes.replaceChildren(
        h('div.time-pair',
          h('label.field', h('span.field-label', 'Start'), startIn),
          h('label.field', h('span.field-label', 'End'), endIn)),
        hint);

      // Day type, with an optional end date to mark a run of days (a vacation week).
      const kindSel = h('select.input', {
        id: 'day-kind', 'aria-label': 'Day type',
        onchange: () => worklog.setKind(date, kindSel.value || null),
      }, [h('option', { value: '' }, 'Normal day'), ...Object.entries(KINDS).map(([k, v]) => h('option', { value: k }, v.label))]);
      kindSel.value = d.kind ?? '';
      const through = h('input.input', {
        id: 'day-kind-through', type: 'date', min: selected, disabled: !d.kind, 'aria-label': 'Apply through date',
        onchange: () => { if (through.value) worklog.setKindRange(date, fromKey(through.value), d.kind); },
      });
      detailKind.replaceChildren(
        h('div.time-pair',
          h('label.field', h('span.field-label', 'Day type'), kindSel),
          h('label.field', h('span.field-label', 'Apply through'), through)),
        h('p.field-hint', d.kind
          ? 'Pick a later date to mark a run of days. Weekends and days you already worked are skipped.'
          : 'Holiday, vacation and sick days are not counted in the week. A half day halves that day.'));

      todoList.replaceChildren(...(d.todos.length
        ? [...d.todos.filter((t) => !t.done), ...d.todos.filter((t) => t.done)].map((t) => widgets.todoItem(date, t))
        : [h('li.muted.note-empty', d.isFuture ? 'Nothing planned yet.' : 'No tasks for this day.')]));

      noteList.replaceChildren(...(d.notes.length
        ? d.notes.map((n) => widgets.noteItem(date, n))
        : [h('li.muted.note-empty', 'No notes for this day.')]));
    }

    const select = ({ view, param }) => {
      if (view !== 'calendar') return;
      selected = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : dateKey(new Date());
      const d = fromKey(selected);
      month = new Date(d.getFullYear(), d.getMonth(), 1);
      renderGrid(); renderDetail();
    };

    select({ view: 'calendar', param: nav.current().param });
    const offNav = nav.onChange(select);
    const offData = onData(() => { renderGrid(); renderDetail(); });
    let lastMinute = -1;
    const offTick = onTick((now) => {
      if (now.getMinutes() === lastMinute) return;
      lastMinute = now.getMinutes();
      if (selected === dateKey(now) && !el.contains(document.activeElement)) renderDetail(now);
      renderGrid(now);
    });
    return () => { offNav(); offData(); offTick(); };
  },
};
