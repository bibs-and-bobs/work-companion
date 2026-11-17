// Widget board (Settings → Layout → Widget board): every module's card on one free grid.
// The cards are the same elements as in the tab layout; they are only moved here and
// positioned, never mounted twice, so switching layouts keeps what you were typing.
//
// Edit layout: drag a card to move it, drag its corner to resize, × to take it off the board.
// Keyboard: focus a card's handle, arrows move it, Shift + arrows resize it, Esc finishes.
// Under ~700px wide the board stacks the cards in reading order instead (CSS).
import * as board from './board.js';
import * as store from './store.js';

export function boardView({ h, cards, modules, firstView }) {
  const el = h('main.board', { hidden: true, 'aria-label': 'Widget board' });
  const titles = Object.fromEntries(modules.map((m) => [m.id, m.title]));
  const viewOf = Object.fromEntries(modules.map((m) => [m.id, m.view ?? firstView]));
  let items = board.layout();
  let editing = false;
  let dragging = false;   // row height is frozen while a card is dragged
  const wide = matchMedia('(min-width: 701px)');
  let active = false;
  const sizeLabels = new Map();

  // ── Toolbar (shown in the masthead while the board is on) ──
  const editBtn = h('button.btn', { onclick: () => setEditing(!editing), 'aria-pressed': 'false' }, 'Edit layout');
  const addSel = h('select.input.board-add', { 'aria-label': 'Add a widget to the board', onchange: (e) => {
    if (e.target.value) commit(board.show(items, e.target.value), e.target.value);
    e.target.value = '';
  } });
  const resetBtn = h('button.link', { onclick: () => {
    if (confirm('Put every widget back where it started?')) board.reset();
  } }, 'Reset');
  const toolbar = h('div.board-tools', addSel, resetBtn, editBtn);

  // ── Edit chrome on every card (only visible while editing) ──
  for (const [id, card] of cards) {
    const size = h('span.board-size');
    sizeLabels.set(id, size);
    card.append(h('div.board-chrome',
      h('button.board-grip', {
        type: 'button',
        'aria-label': `Move ${titles[id]}. Arrow keys move, Shift and arrow keys resize.`,
        onpointerdown: (e) => drag(e, id, 'move'),
        onkeydown: (e) => keyMove(e, id),
      }),
      size,
      h('button.board-hide', { type: 'button', title: 'Take off the board', 'aria-label': `Take ${titles[id]} off the board`,
        onclick: () => commit(board.hide(items, id)) }, '×'),
      h('span.board-resize', { 'aria-hidden': 'true', title: 'Drag to resize', onpointerdown: (e) => drag(e, id, 'resize') })));
  }

  function render(view = items) {
    const order = board.order(view);
    for (const [id, card] of cards) {
      const it = view[id];
      card.hidden = !!it.hidden;
      card.style.setProperty('--gx', it.x + 1);
      card.style.setProperty('--gy', it.y + 1);
      card.style.setProperty('--gw', it.w);
      card.style.setProperty('--gh', it.h);
      card.style.order = order.indexOf(id);
      sizeLabels.get(id).textContent = `${it.w} × ${it.h}`;
    }
    const hidden = modules.filter((m) => view[m.id].hidden);
    addSel.replaceChildren(h('option', { value: '' }, hidden.length ? `Add widget (${hidden.length})…` : 'All widgets shown'),
      ...hidden.map((m) => h('option', { value: m.id }, m.title)));
    addSel.disabled = !hidden.length;
    if (!dragging) fit(view);
    requestAnimationFrame(markClipped);
  }

  // Fit the window: row height is chosen so the lowest card ends exactly at the bottom of the
  // window, whatever its size. Below MIN_ROW px per row the board scrolls instead of squashing.
  const MIN_ROW = 14;
  function fit(view = items) {
    if (!active) return;
    if (!wide.matches) { el.style.removeProperty('--row'); el.style.removeProperty('height'); return; }
    const cs = getComputedStyle(el);
    const gap = parseFloat(cs.rowGap) || 0;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const rows = Math.max(1, ...Object.values(view).filter((it) => !it.hidden).map((it) => it.y + it.h));
    const top = el.getBoundingClientRect().top + window.scrollY;
    const avail = window.innerHeight - top - pad;
    const row = Math.max(MIN_ROW, (avail - gap * (rows - 1)) / rows);
    el.style.setProperty('--row', `${row}px`);
    el.style.height = row > MIN_ROW ? `${window.innerHeight - top}px` : '';
  }

  function commit(next, focusId = null) {
    items = next;
    board.save(items);    // the store listener below re-renders
    if (focusId) cards.get(focusId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function setEditing(on) {
    editing = on && active;
    document.body.classList.toggle('board-editing', editing);
    editBtn.textContent = editing ? 'Done' : 'Edit layout';
    editBtn.setAttribute('aria-pressed', String(editing));
    editBtn.classList.toggle('btn-primary-sm', editing);
  }

  // Size of one column / row step in pixels, read from the live grid.
  function steps() {
    const cs = getComputedStyle(el);
    const colGap = parseFloat(cs.columnGap) || 0;
    const rowGap = parseFloat(cs.rowGap) || 0;
    const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const col = (inner - colGap * (board.COLS - 1)) / board.COLS;
    return { x: col + colGap, y: (parseFloat(cs.getPropertyValue('--row')) || 40) + rowGap };
  }

  function drag(e, id, mode) {
    if (!editing || e.button !== 0) return;
    e.preventDefault();
    const card = cards.get(id);
    const start = { ...items[id] };
    const sx = e.clientX;
    const sy = e.clientY + window.scrollY;
    const step = steps();
    let preview = items;
    dragging = true;
    card.classList.add('is-dragging');
    document.body.classList.add(mode === 'move' ? 'board-moving' : 'board-resizing');
    const move = (ev) => {
      const dx = Math.round((ev.clientX - sx) / step.x);
      const dy = Math.round((ev.clientY + window.scrollY - sy) / step.y);
      const next = mode === 'move' ? { x: start.x + dx, y: start.y + dy } : { w: start.w + dx, h: start.h + dy };
      preview = board.place(items, id, next);
      render(preview);
      if (ev.clientY > innerHeight - 30) window.scrollBy(0, 14);
      else if (ev.clientY < 30) window.scrollBy(0, -14);
    };
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      card.classList.remove('is-dragging');
      document.body.classList.remove('board-moving', 'board-resizing');
      dragging = false;
      if (preview !== items) commit(preview);
      else fit();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  }

  function keyMove(e, id) {
    if (e.key === 'Escape') { setEditing(false); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const it = items[id];
    commit(board.place(items, id, e.shiftKey ? { w: it.w + d[0], h: it.h + d[1] } : { x: it.x + d[0], y: it.y + d[1] }));
    requestAnimationFrame(() => cards.get(id).querySelector('.board-grip').focus());
  }

  // A card whose content is taller than the card gets a halftone edge at the bottom
  // (scrolling inside it still works), so it's clear there is more.
  function markClipped() {
    if (!active) return;
    for (const card of cards.values()) {
      const body = card.querySelector('.card-body');
      const more = body.scrollHeight - body.scrollTop - body.clientHeight > 2;
      card.classList.toggle('is-clipped', more);
    }
  }
  for (const card of cards.values()) card.querySelector('.card-body').addEventListener('scroll', markClipped, { passive: true });
  store.onChange(() => requestAnimationFrame(markClipped));
  window.addEventListener('resize', () => { fit(); markClipped(); });
  wide.addEventListener('change', () => fit());
  // The masthead can change height (buttons appear, Edit layout); refit when it does.
  new ResizeObserver(() => fit()).observe(document.body);
  setInterval(markClipped, 1000);

  store.onChange((ns) => {
    if (ns !== 'board') return;
    items = board.layout();
    if (active) render();
  });

  // Called when something navigates to a view (Week → a day, Ctrl+2, a #tag …).
  // Scrolls the board to that view's widget if none of it is on screen; offers to add it if it's hidden.
  function reveal(viewId) {
    if (!active) return;
    const ids = board.order(items).filter((id) => viewOf[id] === viewId);
    if (!ids.length) { offer(viewId); return; }
    const onScreen = ids.some((id) => {
      const r = cards.get(id).getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    });
    if (onScreen) return;
    const card = cards.get(ids[0]);
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
    card.classList.remove('board-flash');
    void card.offsetWidth;
    card.classList.add('board-flash');
  }

  function offer(viewId) {
    const missing = modules.filter((m) => viewOf[m.id] === viewId && items[m.id].hidden).slice(0, 1);
    if (!missing.length) return;
    const stack = document.querySelector('.toasts') ?? document.body;
    stack.querySelector('.board-toast')?.remove();
    const close = () => toast.remove();
    const toast = h('div.toast.board-toast', { role: 'status' },
      h('div.toast-head', h('span.toast-label', 'Widget board'),
        h('button.note-btn', { onclick: close, 'aria-label': 'Dismiss', title: 'Dismiss' }, '×')),
      h('p.toast-text', `${missing[0].title} is not on your board.`),
      h('div.btn-row',
        h('button.btn.btn-primary-sm', { onclick: () => {
          commit(board.show(items, missing[0].id), missing[0].id);
          close();
        } }, 'Add to board'),
        h('button.link', { onclick: close }, 'Not now')));
    stack.append(toast);
    setTimeout(close, 8000);
  }

  return {
    el,
    toolbar,
    reveal,
    activate() {
      active = true;
      items = board.layout();
      el.replaceChildren(...cards.values());
      el.hidden = false;
      render();
    },
    deactivate() {
      active = false;
      setEditing(false);
      el.hidden = true;
      el.style.removeProperty('--row');
      el.style.removeProperty('height');
      for (const card of cards.values()) {
        card.hidden = false;
        card.classList.remove('is-clipped', 'board-flash');
        for (const p of ['--gx', '--gy', '--gw', '--gh', 'order']) card.style.removeProperty(p);
      }
    },
    setEditing,
    isEditing: () => editing,
  };
}

// Settings drawer section: choose the layout.
export function layoutPanel({ h, settings }) {
  const s = settings.get();
  const opt = (value, label) => h('label.chip',
    h('input', { type: 'radio', name: 'layout', value, checked: s.layout === value,
      onchange: () => settings.set({ layout: value }) }),
    h('span', label));
  return h('div.form',
    h('div.field', h('span.field-label', 'Show the app as'), h('div.chips', opt('tabs', 'Tabs'), opt('board', 'Widget board')),
      h('span.field-hint', 'Widget board puts everything on one screen. Use Edit layout to move, resize and hide widgets. Tabs is the classic look; your board is kept for next time.')));
}
