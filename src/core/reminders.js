// Reminder pop-ups for to-dos.
// While the app is open it checks every few seconds for reminders that are due, shows a
// pop-up in the corner (plus a system notification if the user allowed them), and records
// that it was shown, so it pops once. Reminders that came due while the app was closed pop
// as soon as it opens again. A closed web app can't be woken, so nothing pops while it's closed.
import { h } from './dom.js';
import * as tasks from './tasks.js';
import * as store from './store.js';
import * as nav from './nav.js';
import { onTick } from './clock.js';
import { fmtTime } from './time.js';
import { whenLabel } from './widgets.js';

const shown = new Map();   // task id -> pop-up element
let stack = null;

export function initReminders() {
  stack = h('div.toasts', { 'aria-live': 'polite' });
  document.body.append(stack);
  check();
  onTick((now) => { if (now.getSeconds() % 5 === 0) check(now); });
  store.onChange((ns) => { if (ns === 'tasks') prune(); });
}

function check(now = new Date()) {
  const due = tasks.due(now);
  if (!due.length) return;
  for (const t of due) show(t, now);
  tasks.markReminded(due.map((t) => t.id));
}

// Close pop-ups whose to-do was ticked or deleted elsewhere.
function prune() {
  for (const [id, el] of shown) {
    const t = tasks.get(id);
    if (!t || t.done) { el.remove(); shown.delete(id); }
  }
}

function show(task, now) {
  shown.get(task.id)?.remove();
  const at = tasks.dueAt(task);
  const late = now - at > 60_000;
  const close = () => { toast.remove(); shown.delete(task.id); };
  const toast = h('div.toast', { role: 'alert' },
    h('div.toast-head',
      h('span.toast-label', h('span.bell', { 'aria-hidden': 'true' }), late ? 'Missed reminder' : 'Reminder'),
      h('button.note-btn', { onclick: close, 'aria-label': 'Dismiss reminder', title: 'Dismiss' }, '×')),
    h('p.toast-text', task.text),
    h('p.toast-when', `${late ? 'Was due' : 'Due'} ${whenLabel(at, now).toLowerCase()} at ${fmtTime(at)}`),
    h('div.btn-row',
      h('button.btn.btn-primary-sm', { onclick: () => { tasks.toggle(task.id); close(); } }, 'Done'),
      h('button.btn', { onclick: () => { tasks.snooze(task.id, 10); close(); } }, 'Snooze 10 min'),
      h('button.link', { onclick: () => { nav.go('todo'); close(); } }, 'Open')));
  stack.append(toast);
  shown.set(task.id, toast);
  notify(task, late);
}

// ── System notifications (Windows notification centre etc.) ──
export const notifyState = () => (!('Notification' in window) ? 'unsupported' : Notification.permission);   // default | granted | denied
export const enableNotify = async () => (!('Notification' in window) ? 'unsupported' : Notification.requestPermission());

function notify(task, late) {
  if (notifyState() !== 'granted') return;
  const title = late ? 'Missed reminder' : 'Reminder';
  const options = { body: task.text, tag: `wc-${task.id}`, icon: 'icons/icon-192.png' };
  try {
    const n = new Notification(title, options);
    n.onclick = () => { window.focus(); nav.go('todo'); n.close(); };
  } catch {
    // Some browsers only allow notifications through the service worker.
    navigator.serviceWorker?.ready.then((reg) => reg.showNotification(title, options)).catch(() => {});
  }
}
