// Small UI pieces shared by several modules (offered to them through ctx.widgets).
import { h } from './dom.js';
import * as worklog from './worklog.js';
import * as tasks from './tasks.js';
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

// ── To-dos ──
const shortDate = (d) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

// "Today", "Tomorrow", "Yesterday" or "Mon, 9 Nov".
export function whenLabel(d, now = new Date()) {
  const diff = Math.round((new Date(d).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 86_400_000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : shortDate(d);
}

// Reminder label with a bell, e.g. "Tomorrow 15:00". Pink when it is due and still open.
export function remindChip(task, now = new Date()) {
  const at = tasks.dueAt(task);
  if (!at) return null;
  const isDue = !task.done && at <= now;
  return h(`span.remind-chip${isDue ? '.is-due' : ''}`, { title: isDue ? 'Reminder due' : 'Reminder' },
    h('span.bell', { 'aria-hidden': 'true' }),
    `${whenLabel(at, now)}${task.remind.time ? ` ${fmtTime(at)}` : ''}`);
}

// Mid-sentence form: "Added today, 2:20 PM" / "Done Mon, 9 Nov, 11:00 AM".
const stampText = (iso, now) => {
  const d = new Date(iso);
  const day = whenLabel(d, now);
  return `${/^(Today|Tomorrow|Yesterday)$/.test(day) ? day.toLowerCase() : day}, ${fmtTime(d)}`;
};

// One to-do row. compact: just the reminder or "since …" (Today card).
// Full: "Added …", "Done …" and the reminder (To-do tab, Calendar).
// The pencil edits the text and the reminder; Enter saves, Esc cancels.
export function todoItem(task, { compact = false, now = new Date() } = {}) {
  return editableRow({
    li: h(`li.todo${task.done ? '.is-done' : ''}${compact ? '.is-compact' : ''}`),
    view: (startEdit) => {
      const created = new Date(task.created);
      const meta = compact
        ? [remindChip(task, now) ?? (dateKey(created) !== dateKey(now) ? `since ${shortDate(created)}` : null)]
        : [`Added ${stampText(task.created, now)}`, task.done ? `Done ${stampText(task.done, now)}` : null, remindChip(task, now)];
      const parts = meta.filter(Boolean);
      return [
        h('label.todo-check',
          h('input', { type: 'checkbox', checked: !!task.done, 'aria-label': task.text, onchange: () => tasks.toggle(task.id) }),
          h('span.todo-body',
            h('span.todo-text', richText(task.text)),
            parts.length ? h('span.todo-meta', parts.flatMap((p, i) => (i ? [h('span.sep', '·'), p] : [p]))) : null)),
        h('span.note-actions', pencil(startEdit, 'task'), cross(() => tasks.remove(task.id), 'task')),
      ];
    },
    edit: (cancel) => {
      const date = h('input.input', { type: 'date', value: task.remind?.date ?? '', 'aria-label': 'Reminder date' });
      const timeIn = h('input.input', { type: 'time', value: task.remind?.time ?? '', 'aria-label': 'Reminder time' });
      const save = () => {
        const text = input.value.trim();
        const remind = tasks.makeRemind({ date: date.value, time: timeIn.value });
        const same = text === task.text && JSON.stringify(remind) === JSON.stringify(task.remind ?? null);
        if (!text || same) return cancel();
        tasks.edit(task.id, { text, remind });
      };
      const input = editInput(task.text, 'Edit task', save, cancel);
      for (const el of [date, timeIn]) el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') save();
        if (e.key === 'Escape') { e.stopPropagation(); cancel(); }
      });
      return {
        input,
        nodes: [
          h('div.todo-edit',
            input,
            h('div.todo-edit-row',
              h('span.field-label', 'Remind me'), date, timeIn,
              h('button.link', { onclick: () => { date.value = ''; timeIn.value = ''; } }, 'No reminder'))),
          h('span.note-actions', h('button.link', { onclick: save }, 'Save'), h('button.link', { onclick: cancel }, 'Cancel')),
        ],
      };
    },
  });
}
