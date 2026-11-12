// Small UI pieces shared by several modules (offered to them through ctx.widgets).
import { h } from './dom.js';
import * as worklog from './worklog.js';
import { fmtTime, dateKey } from './time.js';

// One note row: time, text, and edit / delete. Click the pencil to edit in place.
// Enter saves, Esc cancels. Lists re-render from saved data, so this only touches its own <li>.
export function noteItem(date, note) {
  const when = new Date(note.t);
  const stamp = dateKey(when) === dateKey(date)
    ? fmtTime(when)
    : `${when.toLocaleDateString([], { day: 'numeric', month: 'short' })} ${fmtTime(when)}`;
  const li = h('li');

  function show() {
    li.classList.remove('is-editing');
    li.replaceChildren(
      h('time', stamp),
      h('span.note-text', note.text, note.e ? h('em.note-edited', ' (edited)') : null),
      h('span.note-actions',
        h('button.note-btn', { onclick: edit, 'aria-label': 'Edit note', title: 'Edit note' }, '✎'),
        h('button.note-btn', { onclick: () => worklog.deleteNote(date, note.id), 'aria-label': 'Delete note', title: 'Delete note' }, '×')));
  }

  function edit() {
    li.classList.add('is-editing');
    const save = () => {
      if (input.value.trim() && input.value.trim() !== note.text) worklog.editNote(date, note.id, input.value);
      else show();
    };
    const input = h('input.input', {
      type: 'text', value: note.text, 'aria-label': 'Edit note',
      onkeydown: (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') { e.stopPropagation(); show(); }
      },
    });
    li.replaceChildren(
      h('time', stamp), input,
      h('span.note-actions', h('button.link', { onclick: save }, 'Save'), h('button.link', { onclick: show }, 'Cancel')));
    input.focus();
    input.select();
  }

  show();
  return li;
}
