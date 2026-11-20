// Calendar: month overview of logged days. Click a day for a pop-up to fix its start/end
// times and set its day type (holiday, vacation, sick, half day), optionally through a later
// date. That day's notes and to-dos sit folded away at the bottom of the pop-up: the Today,
// Notes and To-do cards are the main place for them.
// Cells show a bell for days with reminders, ✓n for to-dos ticked off that day and ✎n for notes.
export default {
  id: 'calendar',
  title: 'Calendar',
  view: 'calendar',
  ink: 'yellow',
  span: 'full',

  mount(el, { h, worklog, tasks, time, nav, widgets, onTick, onData }) {
    const { KINDS } = worklog;
    const { dateKey, fromKey, addDays, startOfWeek, fmtDuration: dur, fmtDate, toHHMM, atTime } = time;

    let selected = dateKey(new Date());
    let month = new Date(); month.setDate(1);
    let pop = null;   // the open day pop-up: { key, refresh, close }

    const monthTitle = h('h3.cal-month');
    const grid = h('div.cal-grid');
    const shiftMonth = (n) => { month = new Date(month.getFullYear(), month.getMonth() + n, 1); renderGrid(); };
    const toToday = () => { const t = new Date(); month = new Date(t.getFullYear(), t.getMonth(), 1); renderGrid(); };

    el.append(h('div.cal',
      h('section.cal-main',
        h('div.cal-head',
          h('button.btn.btn-icon', { onclick: () => shiftMonth(-1), 'aria-label': 'Previous month' }, '←'),
          monthTitle,
          h('button.btn.btn-icon', { onclick: () => shiftMonth(1), 'aria-label': 'Next month' }, '→'),
          h('button.btn', { onclick: toToday }, 'Today')),
        h('div.cal-weekdays', time.DAY_NAMES.map((n) => h('span', n))),
        grid,
        h('p.field-hint.cal-hint', 'Click a day to fix its times or mark it as a holiday, vacation, sick or half day.'))));

    // Compact "7:45" for small cells.
    const hhmm = (ms) => { const m = Math.floor(ms / 60_000); return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`; };

    function renderGrid(now = new Date()) {
      // reminders (open to-dos) and ticked to-dos per day, counted once for the whole grid
      const reminders = new Map();
      const doneCount = new Map();
      for (const t of tasks.list()) {
        if (!t.done && t.remind?.date) reminders.set(t.remind.date, true);
        if (t.done) { const k = dateKey(new Date(t.done)); doneCount.set(k, (doneCount.get(k) ?? 0) + 1); }
      }
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
          { onclick: () => openCell(d.key), 'aria-label': `${fmtDate(date)}: edit times and day type`, 'aria-haspopup': 'dialog' },
          h('span.cal-num', date.getDate()),
          h('span.cal-bar', h('span.cal-fill', { style: { width: `${d.pct * 100}%` } })),
          h('span.cal-foot', h('span', hours || (d.kind ? KINDS[d.kind].tag : '')),
            h('span.cal-icons', ...[
              reminders.has(d.key) ? h('span.bell', { title: 'Reminder' }) : null,
              doneCount.get(d.key) ? h('span.cal-done', { title: 'To-dos done' }, `✓${doneCount.get(d.key)}`) : null,
              d.notes.length ? h('span.cal-notes', { title: 'Notes' }, `✎${d.notes.length}`) : null,
            ].filter(Boolean)))));
      }
      grid.replaceChildren(...cells);
    }

    // The URL follows the selected day (#/calendar/2026-11-11); the pop-up opens right away.
    function openCell(key) {
      nav.go('calendar', key);
      openDay(key);
    }

    const STATE_TEXT = {
      idle: 'Not started', working: 'Working', overtime: 'Over time', ended: 'Logged',
      planned: 'Upcoming', missed: 'No record', off: 'Day off',
    };
    const stateText = (d) => (d.state === 'leave' ? KINDS[d.kind].label : STATE_TEXT[d.state]);

    // ── Day pop-up: times + day type (Save / Cancel), notes and to-dos folded away ──
    function openDay(key) {
      selected = key;
      renderGrid();
      const date = fromKey(key);
      const d = worklog.dayStats(date, new Date());
      const ov = widgets.overlay({ label: fmtDate(date), ink: 'yellow', size: 'small', onClose: () => { if (pop?.key === key) pop = null; } });

      const head = h('div.detail-head');
      const startIn = h('input.input', { type: 'time', value: d.start ? toHHMM(d.start) : '', 'aria-label': 'Start time' });
      const endIn = h('input.input', { type: 'time', value: d.end ? toHHMM(d.end) : '', 'aria-label': 'End time' });
      const timeHint = h('p.field-hint');
      if (d.start && !d.end && !d.isToday) timeHint.textContent = 'Never ended, so it counts as a full day.';
      else if (!d.start && !d.isFuture) timeHint.textContent = 'Forgot to press Begin day? Set the start time here.';
      else if (d.isFuture) timeHint.textContent = 'Times can be set once the day has come.';
      startIn.disabled = endIn.disabled = d.isFuture;
      const syncEnd = () => { endIn.disabled = d.isFuture || !startIn.value; };
      startIn.addEventListener('input', syncEnd);
      syncEnd();

      const kindSel = h('select.input', { 'aria-label': 'Day type' },
        [h('option', { value: '' }, 'Normal day'), ...Object.entries(KINDS).map(([k, v]) => h('option', { value: k }, v.label))]);
      kindSel.value = d.kind ?? '';
      const through = h('input.input', { type: 'date', min: key, 'aria-label': 'Apply through date' });
      const kindHint = h('p.field-hint');
      const syncKind = () => {
        kindHint.textContent = through.value
          ? `Applies ${kindSel.value ? KINDS[kindSel.value].label.toLowerCase() : 'normal day'} up to ${fmtDate(fromKey(through.value))}. Weekends and days you already worked are skipped.`
          : 'Holiday, vacation and sick days are not counted in the week. A half day halves that day. Pick a later date to mark a run of days.';
      };
      kindSel.addEventListener('change', syncKind);
      through.addEventListener('change', syncKind);
      syncKind();

      const notesSum = h('span');
      const noteList = h('ol.note-list.note-list-full');
      const noteInput = h('input.input', { type: 'text', placeholder: 'Add a note to this day', 'aria-label': 'Add a note to this day',
        onkeydown: (e) => { if (e.key === 'Enter') addNote(); } });
      const todoList = h('ul.todo-list');
      const todoInput = h('input.input', { type: 'text', 'aria-label': 'Add a task',
        placeholder: d.isToday ? 'Add a to-do' : 'Remind me about… (that morning)',
        onkeydown: (e) => { if (e.key === 'Enter') addTodo(); } });
      const todoForm = h('div.note-form', todoInput, h('button.btn', { onclick: () => addTodo() }, 'Add'));
      todoForm.hidden = d.isPast;

      function addNote() {
        if (!noteInput.value.trim()) return;
        worklog.addNote(noteInput.value, date, new Date());
        noteInput.value = '';
        noteInput.focus();
      }
      // On today: a plain to-do. On a future day: a to-do with a reminder that morning.
      function addTodo() {
        if (!todoInput.value.trim()) return;
        tasks.add(todoInput.value, { remind: key > dateKey(new Date()) ? { date: key } : null });
        todoInput.value = '';
        todoInput.focus();
      }

      // Live parts (head, notes, to-dos) follow data changes; the form keeps what you typed.
      function refresh() {
        const now = new Date();
        const s = worklog.dayStats(date, now);
        head.replaceChildren(...[
          h(`span.badge.state-${s.state}`, stateText(s)),
          s.kind && s.state !== 'leave' ? h('span.badge', KINDS[s.kind].label) : null,
          s.start ? h('span.detail-worked', `${dur(s.workedMs)} worked`) : null,
        ].filter(Boolean));   // replaceChildren(null) would print the word "null"
        const dayTasks = [...tasks.sortOpen(tasks.remindersOn(date), now), ...tasks.doneOn(date)];
        notesSum.textContent = `Notes (${s.notes.length}) · To-dos (${dayTasks.length})`;
        if (noteList.contains(document.activeElement) || todoList.contains(document.activeElement)) return;
        noteList.replaceChildren(...(s.notes.length
          ? s.notes.map((n) => widgets.noteItem(date, n))
          : [h('li.muted.note-empty', 'No notes for this day.')]));
        todoList.replaceChildren(...(dayTasks.length
          ? dayTasks.map((t) => widgets.todoItem(t, { now }))
          : [h('li.muted.note-empty', s.isPast ? 'No to-dos were ticked off this day.' : s.isToday ? 'No reminders today. Open to-dos are on the Today card.' : 'No reminders yet.')]));
      }

      function save() {
        // times
        const s0 = d.start ? toHHMM(d.start) : '';
        const e0 = d.end ? toHHMM(d.end) : '';
        if (!d.isFuture && (startIn.value !== s0 || endIn.value !== e0)) {
          if (!startIn.value) worklog.clearTimes(date);
          else {
            const start = atTime(date, startIn.value);
            const end = endIn.value ? atTime(date, endIn.value) : null;
            if (end && end <= start) { timeHint.textContent = 'End must be after start.'; endIn.focus(); return; }
            worklog.setTimes(date, { start, end });
          }
        }
        // day type, for this day or a run of days
        const kind = kindSel.value || null;
        if (through.value && through.value > key) worklog.setKindRange(date, fromKey(through.value), kind);
        else if (kind !== (d.kind ?? null)) worklog.setKind(date, kind);
        ov.close();
      }
      for (const inp of [startIn, endIn, through]) inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });

      ov.body.append(h('div.day-pop',
        head,
        h('div.time-pair',
          h('label.field', h('span.field-label', 'Start'), startIn),
          h('label.field', h('span.field-label', 'End'), endIn)),
        timeHint,
        h('div.time-pair',
          h('label.field', h('span.field-label', 'Day type'), kindSel),
          h('label.field', h('span.field-label', 'Apply through'), through)),
        kindHint,
        h('div.btn-row.day-pop-actions',
          h('button.btn.btn-primary-sm', { onclick: save }, 'Save'),
          h('button.link', { onclick: () => ov.close() }, 'Cancel')),
        h('details.day-pop-more',
          h('summary', notesSum),
          h('h4.detail-sub', 'To-dos'), todoList, todoForm,
          h('h4.detail-sub', 'Notes'), noteList,
          h('div.note-form', noteInput, h('button.btn', { onclick: addNote }, 'Add')))));
      refresh();
      pop = { key, refresh, close: ov.close };
    }

    const select = ({ view, param }, open) => {
      if (view !== 'calendar') return;
      selected = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : dateKey(new Date());
      const d = fromKey(selected);
      month = new Date(d.getFullYear(), d.getMonth(), 1);
      renderGrid();
      // Links from elsewhere (Week, Today's "Edit times", a note's day) open that day's pop-up.
      if (open && param === selected && pop?.key !== selected) openDay(selected);
    };

    select(nav.current(), false);   // no pop-up on startup, only when you go to a day
    const offNav = nav.onChange((c) => select(c, true));
    const offData = onData(() => { renderGrid(); pop?.refresh(); });
    let lastMinute = -1;
    const offTick = onTick((now) => {
      if (now.getMinutes() === lastMinute) return;
      lastMinute = now.getMinutes();
      renderGrid(now);
      pop?.refresh();
    });
    return () => { offNav(); offData(); offTick(); pop?.close(); };
  },
};
