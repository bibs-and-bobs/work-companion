// Notes: jot timestamped notes onto today's record. Hidden unless you open them.
export default {
  id: 'notes',
  title: 'Notes',
  view: 'today',
  ink: 'green',
  span: 'full',

  mount(el, { h, worklog, time, nav, keys, onData }) {
    const input = h('input.input.note-input', {
      type: 'text', placeholder: `Jot something down…  (${keys.shortcut('N')})`, 'aria-label': 'New note',
      onkeydown: (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') input.blur();
      },
    });
    const status = h('span.note-status');
    const toggle = h('button.link', { onclick: () => { open = !open; render(); } });
    const list = h('ol.note-list');
    let open = false;
    let flash = '';

    function save() {
      const text = input.value;
      if (!text.trim()) return;
      const now = new Date();
      worklog.addNote(text, now, now);
      input.value = '';
      flash = `Saved at ${time.fmtTime(now)}.`;
      render();
      setTimeout(() => { flash = ''; render(); }, 2500);
    }

    el.append(
      h('div.note-form', input, h('button.btn', { onclick: save }, 'Add')),
      h('div.note-meta', status, toggle),
      list);

    function render() {
      const notes = worklog.dayStats(new Date()).notes;
      const count = notes.length;
      status.textContent = [flash, count ? `${count} note${count > 1 ? 's' : ''} today.` : 'No notes yet today.']
        .filter(Boolean).join(' ');
      toggle.hidden = !count;
      toggle.textContent = open ? 'Hide' : 'Show';
      list.hidden = !open || !count;
      list.replaceChildren(...notes.map((n) =>
        h('li', h('time', time.fmtTime(new Date(n.t))), h('span', n.text))));
    }

    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        nav.go('today');
        input.focus();
      }
    };
    document.addEventListener('keydown', onKey);

    render();
    const offData = onData(render);
    return () => { offData(); document.removeEventListener('keydown', onKey); };
  },
};
