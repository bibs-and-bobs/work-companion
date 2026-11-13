// Notes tab: search every note you've written, or browse by #tag.
// Tags are just words starting with # inside a note. Nothing extra is saved.
export default {
  id: 'search',
  title: 'Search notes',
  view: 'notes',
  ink: 'green',
  span: 'full',

  mount(el, { h, worklog, time, nav, widgets, onData }) {
    const LIMIT = 60;
    let query = '';
    let tag = '';
    let limit = LIMIT;

    const input = h('input.input', {
      type: 'search', placeholder: 'Search notes…', 'aria-label': 'Search notes',
      oninput: () => { query = input.value.trim(); limit = LIMIT; render(); },
    });
    const clearBtn = h('button.link', { onclick: () => { query = tag = ''; input.value = ''; limit = LIMIT; render(); } }, 'Clear filters');
    const tagRow = h('div.tag-row');
    const status = h('p.note-status');
    const results = h('div.results');
    const more = h('button.btn', { onclick: () => { limit += LIMIT; render(); } }, 'Show more');

    el.append(h('div.note-form', input), tagRow, h('div.note-meta', status, clearBtn), results, h('div.btn-row', more));

    function render() {
      const notes = worklog.allNotes();

      // all tags with counts
      const counts = new Map();
      for (const { note } of notes) for (const t of new Set(widgets.tagsOf(note.text))) counts.set(t, (counts.get(t) ?? 0) + 1);
      const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
      tagRow.hidden = !tags.length;
      tagRow.replaceChildren(...tags.map(([t, n]) => h(`button.tag-chip${t === tag ? '.is-active' : ''}`,
        { onclick: () => { tag = tag === t ? '' : t; limit = LIMIT; render(); }, 'aria-pressed': t === tag }, `#${t} `, h('span.tag-count', n))));

      const q = query.toLowerCase();
      const hits = notes.filter(({ note }) =>
        (!tag || widgets.tagsOf(note.text).includes(tag)) && (!q || note.text.toLowerCase().includes(q)));

      clearBtn.hidden = !query && !tag;
      status.textContent = !notes.length ? 'No notes yet. Add one on the Today tab, and use #tags to group them.'
        : !hits.length ? 'Nothing matches.'
        : `${hits.length} note${hits.length > 1 ? 's' : ''}${tag ? ` tagged #${tag}` : ''}${query ? ` matching “${query}”` : ''}.`;

      const shown = hits.slice(0, limit);
      more.hidden = hits.length <= limit;
      const groups = [];
      for (const hit of shown) {
        const last = groups[groups.length - 1];
        if (last && last.key === hit.key) last.items.push(hit); else groups.push({ key: hit.key, date: hit.date, items: [hit] });
      }
      const thisYear = new Date().getFullYear();
      results.replaceChildren(...groups.map((g) => h('section.result-day',
        h('button.link', { onclick: () => nav.go('calendar', g.key) },
          time.fmtDate(g.date, { weekday: 'long', day: 'numeric', month: 'long', ...(g.date.getFullYear() !== thisYear ? { year: 'numeric' } : {}) })),
        h('ol.note-list', g.items.map(({ date, note }) => widgets.noteItem(date, note, { query }))))));
    }

    // #/notes/<tag> opens the tab filtered by that tag (tags in any note link here).
    const fromHash = ({ view, param }) => {
      if (view !== 'notes') return;
      if (param) { tag = decodeURIComponent(param).toLowerCase(); query = ''; input.value = ''; limit = LIMIT; }
      render();
    };

    fromHash({ view: 'notes', param: nav.current().view === 'notes' ? nav.current().param : null });
    const offNav = nav.onChange(fromHash);
    const offData = onData(() => render());
    return () => { offNav(); offData(); };
  },
};
