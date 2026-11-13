// Small UI pieces shared by several modules (offered to them through ctx.widgets).
import { h } from './dom.js';
import * as worklog from './worklog.js';
import * as nav from './nav.js';
import { fmtTime, dateKey, fromKey } from './time.js';

// ── Tags: any word starting with # (at the start of the text or after a space or "(") ──
const TAG = /(^|[\s(])#([\p{L}\p{N}_-]+)/gu;
export const tagsOf = (text) => [...text.matchAll(TAG)].map((m) => m[2].toLowerCase());

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Plain text with the search query highlighted.
function highlight(text, query) {
  if (!query) return [text];
  return text.split(new RegExp(`(${escapeRe(query)})`, 'gi')).map((part, i) =>
    i % 2 ? h('mark', part) : part);
}

// Note text as nodes: #tags become buttons that open the Notes tab filtered by that tag,
// and `query` (optional) is highlighted. Built from text nodes only, so notes can never inject HTML.
export function richText(text, { query = '' } = {}) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TAG)) {
    const tagStart = m.index + m[1].length;
    out.push(...highlight(text.slice(last, tagStart), query));
    out.push(h('button.tag', {
      title: `Show notes tagged #${m[2]}`,
      onclick: () => nav.go('notes', encodeURIComponent(m[2].toLowerCase())),
    }, `#${m[2]}`));
    last = tagStart + m[2].length + 1;
  }
  out.push(...highlight(text.slice(last), query));
  return out;
}

// "Mon 9 Nov" style label for a day key.
export const dayLabel = (key) => fromKey(key).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

// One row that can switch between a read view and an inline edit view. Enter saves, Esc cancels.
function editableRow({ li, view, edit }) {
  const show = () => { li.classList.remove('is-editing'); li.replaceChildren(...view(startEdit)); };
  function startEdit() {
    li.classList.add('is-editing');
    const { nodes, input } = edit(show);
    li.replaceChildren(...nodes);
    input.focus();
    input.select();
  }
  show();
  return li;
}

const editInput = (value, label, save, cancel) => h('input.input', {
  type: 'text', value, 'aria-label': label,
  onkeydown: (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
  },
});

const pencil = (onclick, what) => h('button.note-btn', { onclick, 'aria-label': `Edit ${what}`, title: `Edit ${what}` }, '✎');
const cross = (onclick, what) => h('button.note-btn', { onclick, 'aria-label': `Delete ${what}`, title: `Delete ${what}` }, '×');

// One note row: time, text with tags, and edit / delete. `query` highlights a search.
export function noteItem(date, note, { query = '' } = {}) {
  const when = new Date(note.t);
  const stamp = dateKey(when) === dateKey(date)
    ? fmtTime(when)
    : `${when.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${fmtTime(when)}`;
  return editableRow({
    li: h('li'),
    view: (startEdit) => [
      h('time', stamp),
      h('span.note-text', richText(note.text, { query }), note.e ? h('em.note-edited', ' (edited)') : null),
      h('span.note-actions', pencil(startEdit, 'note'), cross(() => worklog.deleteNote(date, note.id), 'note')),
    ],
    edit: (cancel) => {
      const save = () => {
        const v = input.value.trim();
        if (v && v !== note.text) worklog.editNote(date, note.id, v); else cancel();
      };
      const input = editInput(note.text, 'Edit note', save, cancel);
      return {
        input,
        nodes: [h('time', stamp), input, h('span.note-actions', h('button.link', { onclick: save }, 'Save'), h('button.link', { onclick: cancel }, 'Cancel'))],
      };
    },
  });
}

// One to-do row: checkbox, text, and edit / delete. Shows where a carried-over task started.
export function todoItem(date, todo) {
  const key = dateKey(date);
  return editableRow({
    li: h(`li.todo${todo.done ? '.is-done' : ''}`),
    view: (startEdit) => [
      h('label.todo-check',
        h('input', { type: 'checkbox', checked: !!todo.done, 'aria-label': todo.text, onchange: () => worklog.toggleTodo(date, todo.id) }),
        h('span.todo-text', todo.text)),
      todo.from && todo.from !== key ? h('span.todo-from', `from ${dayLabel(todo.from)}`) : h('span'),
      h('span.note-actions', pencil(startEdit, 'task'), cross(() => worklog.deleteTodo(date, todo.id), 'task')),
    ],
    edit: (cancel) => {
      const save = () => {
        const v = input.value.trim();
        if (v && v !== todo.text) worklog.editTodo(date, todo.id, v); else cancel();
      };
      const input = editInput(todo.text, 'Edit task', save, cancel);
      return {
        input,
        nodes: [input, h('span'), h('span.note-actions', h('button.link', { onclick: save }, 'Save'), h('button.link', { onclick: cancel }, 'Cancel'))],
      };
    },
  });
}
