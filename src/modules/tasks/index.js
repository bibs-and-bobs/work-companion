// To-do: today's tasks. Anything not finished moves on to the next day by itself.
// Tasks are saved on the day's record (worklog), so the Calendar shows what was planned and done.
export default {
  id: 'tasks',
  title: 'To-do',
  view: 'today',
  ink: 'orange',
  span: 'full',

  mount(el, { h, worklog, time, widgets, onData, onTick }) {
    const input = h('input.input', {
      type: 'text', placeholder: 'Add a task…  (it stays until you tick it off)', 'aria-label': 'New task',
      onkeydown: (e) => { if (e.key === 'Enter') add(); },
    });
    const summary = h('span.note-status');
    const toggle = h('button.link', { onclick: () => { showDone = !showDone; render(); } });
    const list = h('ul.todo-list');
    let showDone = false;
    let shownKey = '';

    function add() {
      if (!input.value.trim()) return;
      worklog.addTodo(input.value, new Date());
      input.value = '';
      input.focus();
    }

    el.append(
      h('div.note-form', input, h('button.btn', { onclick: add }, 'Add')),
      h('div.note-meta', summary, toggle),
      list);

    function render(now = new Date()) {
      shownKey = time.dateKey(now);
      const { todos } = worklog.dayStats(now, now);
      const open = todos.filter((t) => !t.done);
      const done = todos.filter((t) => t.done);

      summary.textContent = !todos.length ? 'Nothing planned. Add a task above.'
        : !open.length ? `All ${done.length} done. Nice.`
        : `${open.length} to do${done.length ? ` · ${done.length} done` : ''}.`;
      toggle.hidden = !done.length;
      toggle.textContent = showDone ? 'Hide done' : 'Show done';

      list.replaceChildren(...open.concat(showDone ? done : []).map((t) => widgets.todoItem(now, t)));
    }

    render();
    const offData = onData(() => render());
    const offTick = onTick((now) => { if (time.dateKey(now) !== shownKey) render(now); });   // new day
    return () => { offData(); offTick(); };
  },
};
