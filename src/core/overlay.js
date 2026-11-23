// Full-screen overlay (break games, eye break) and the small dialog version (Calendar day pop-up).
// Offered to modules through ctx.widgets.
import { h } from './dom.js';

// Returns { body, close }. The caller fills body. onClose runs once, however it was closed.
let openOverlay = null;
export const overlayOpen = () => !!openOverlay;

// size: 'small' for a compact dialog (the Calendar's day pop-up) instead of a big panel.
export function overlay({ label, ink = 'pink', size = null, onClose } = {}) {
  openOverlay?.close();
  const before = document.activeElement;
  const body = h('div.overlay-body');
  const closeBtn = h('button.btn', { onclick: () => close() }, 'Close');
  const small = size === 'small';
  const el = h(`div.overlay${small ? '.overlay-small' : ''}`, { onclick: (e) => { if (small && e.target === el) close(); } }, h(`div.overlay-panel.ink-${ink}${small ? '.is-small' : ''}`, { role: 'dialog', 'aria-modal': 'true', 'aria-label': label },
    h('div.overlay-head', h('span.overlay-label', label), closeBtn), body));
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  function close() {
    if (!el.isConnected) return;
    el.remove();
    document.removeEventListener('keydown', onKey, true);
    openOverlay = null;
    onClose?.();
    before?.focus?.();
  }
  document.addEventListener('keydown', onKey, true);
  document.body.append(el);
  openOverlay = { close };
  setTimeout(() => (body.querySelector('button:not(:disabled), input:not(:disabled), select') ?? closeBtn).focus(), 0);
  return { body, close };
}
