// To-do (Today tab): a short preview. Open to-dos always show here until ticked.
// Due reminders come first. The full list, reminders and history live in the To-do tab.
export default {
  id: 'tasks',
  title: 'To-do',
  view: 'today',
  ink: 'orange',
  span: 'full',

  mount(el, { h, tasks, time, nav, widgets, onData, onTick }) {
    const MAX = 5;
    const input = h('input.input', {
      type: 'text', placeholder: 'Add a task…  (reminders: To-do tab)', 'aria-label': 'New task',
      onkeydown: (e) => { if (e.key === 'Enter') add(); },
    });
    const summary = h('span.note-status');
    const doneToggle = h('button.link', { onclick: () => { showDone = !showDone; render(); } });
    const allLink = h('button.link', { onclick: () => nav.go('todo') }, 'All to-dos');
    const list = h('ul.todo-list');
    let showDone = false;

    function add() {
      if (!input.value.trim()) return;
      tasks.add(input.value);
      input.value = '';
      input.focus();
    }

    el.append(
      h('div.note-form', input, h('button.btn', { onclick: add }, 'Add')),
      h('div.note-meta', summary, doneToggle, allLink),
      list);

    function render(now = new Date()) {
      const open = tasks.sortOpen(tasks.open(), now);
      const doneToday = tasks.doneOn(now);
      summary.textContent = !open.length && !doneToday.length ? 'Nothing to do. Add a task above.'
        : !open.length ? `All done for today (${doneToday.length}). Nice.`
        : `${open.length} to do${doneToday.length ? ` · ${doneToday.length} done today` : ''}.`;
      doneToggle.hidden = !doneToday.length;
      doneToggle.textContent = showDone ? 'Hide done' : 'Show done';

      const rows = open.slice(0, MAX).map((t) => widgets.todoItem(t, { compact: true, now }));
      if (open.length > MAX) {
        rows.push(h('li.todo-more', h('button.link', { onclick: () => nav.go('todo') }, `${open.length - MAX} more in the To-do tab`)));
      }
      if (showDone) rows.push(...doneToday.map((t) => widgets.todoItem(t, { compact: true, now })));
      list.replaceChildren(...rows);
    }

    render();
    const offData = onData(() => render());
    // Once a minute, so reminders turn "due" and a new day starts cleanly. Not while you're editing.
    let lastMinute = -1;
    const offTick = onTick((now) => {
      if (now.getMinutes() === lastMinute) return;
      lastMinute = now.getMinutes();
      if (!el.contains(document.activeElement)) render(now);
    });
    return () => { offData(); offTick(); };
  },
};
