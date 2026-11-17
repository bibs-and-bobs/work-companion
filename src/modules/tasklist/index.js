// To-do tab: every to-do. Add one with an optional reminder, see what's open, what has a
// reminder, and the history of what was done (grouped by the day it was ticked).
export default {
  id: 'tasklist',
  title: 'All to-dos',
  view: 'todo',
  ink: 'orange',
  span: 'full',

  mount(el, { h, tasks, time, nav, widgets, reminders, onData, onTick }) {
    let filter = 'open';

    const text = h('input.input', {
      id: 'todo-new-text', type: 'text', placeholder: 'What needs doing?', 'aria-label': 'New task',
      onkeydown: (e) => { if (e.key === 'Enter') add(); },
    });
    const date = h('input.input', { id: 'todo-new-date', type: 'date', 'aria-label': 'Reminder date (optional)' });
    const clock = h('input.input', { id: 'todo-new-time', type: 'time', 'aria-label': 'Reminder time (optional)' });
    for (const x of [date, clock]) x.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });

    const notifyText = h('span.field-hint');
    const notifyBtn = h('button.link', { onclick: async () => { await reminders.enableNotify(); showNotify(); } }, 'Allow Windows notifications');
    const filterRow = h('div.tag-row');
    const listArea = h('div.todo-area');

    el.append(
      h('div.todo-add',
        text,
        h('div.todo-add-row',
          h('span.field-label', 'Remind me (optional)'), date, clock,
          h('button.btn', { onclick: add }, 'Add'))),
      h('p.field-hint', 'Date only: pops at 9:00 that day. Time only: the next time that time comes round. Pop-ups show while the app is open; anything missed pops when you next open it.'),
      h('div.btn-row.notify-row', notifyText, notifyBtn),
      filterRow, listArea);

    function add() {
      if (!text.value.trim()) return;
      tasks.add(text.value, { remind: tasks.makeRemind({ date: date.value, time: clock.value }) });
      text.value = date.value = clock.value = '';
      text.focus();
    }

    function showNotify() {
      const state = reminders.notifyState();
      notifyBtn.hidden = state !== 'default';
      notifyText.textContent = {
        unsupported: '',
        default: 'Reminders pop up inside the app.',
        granted: 'Reminders also show as Windows notifications (while the app is open).',
        denied: 'Windows notifications are blocked for this site in your browser settings. Pop-ups inside the app still work.',
      }[state];
    }

    function render(now = new Date()) {
      const open = tasks.sortOpen(tasks.open(), now);
      const withReminder = open.filter((t) => t.remind);
      const done = tasks.list().filter((t) => t.done).sort((a, b) => b.done.localeCompare(a.done));

      const FILTERS = { open: ['Open', open.length], reminders: ['Reminders', withReminder.length], done: ['Done', done.length] };
      filterRow.replaceChildren(...Object.entries(FILTERS).map(([id, [label, n]]) =>
        h(`button.tag-chip${filter === id ? '.is-active' : ''}`, { 'aria-pressed': filter === id, onclick: () => { filter = id; render(); } },
          `${label} `, h('span.tag-count', n))));

      const row = (t) => widgets.todoItem(t, { now });
      if (filter === 'done') {
        if (!done.length) return listArea.replaceChildren(h('p.muted', 'Nothing ticked off yet.'));
        const groups = new Map();
        for (const t of done) {
          const key = time.dateKey(new Date(t.done));
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key).push(t);
        }
        return listArea.replaceChildren(...[...groups].map(([key, items]) => h('section.result-day',
          h('button.link', { onclick: () => nav.go('calendar', key) }, time.fmtDate(time.fromKey(key))),
          h('ul.todo-list', items.map(row)))));
      }
      const items = filter === 'reminders' ? withReminder : open;
      listArea.replaceChildren(items.length
        ? h('ul.todo-list', items.map(row))
        : h('p.muted', filter === 'reminders' ? 'No reminders set. Add a date or time above.' : 'Nothing to do. Add a task above.'));
    }

    showNotify();
    render();
    const offData = onData(() => render());
    let lastMinute = -1;
    const offTick = onTick((now) => {
      if (now.getMinutes() === lastMinute) return;
      lastMinute = now.getMinutes();
      if (!listArea.contains(document.activeElement)) render(now);
    });
    return () => { offData(); offTick(); };
  },
};
