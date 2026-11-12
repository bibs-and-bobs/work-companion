// "Your data" section of the Settings drawer:
//  1. save to a real file on this PC (kept up to date automatically)
//  2. manual backup / restore
// Browser storage is always written too, so the file is an extra copy you own.

export function dataPanel({ h, store }) {
  // ── 1. Linked file ──
  const fileStatus = h('p.field-hint.file-status');
  const chooseBtn = h('button.btn', { onclick: choose }, 'Choose file…');
  const reconnectBtn = h('button.btn.btn-primary-sm', { onclick: reconnect }, 'Reconnect');
  const stopBtn = h('button.link', { onclick: () => store.unlinkFile() }, 'Stop saving to file');
  const fileBox = h('div.field',
    h('span.field-label', 'Save to a file on this PC'),
    h('div.btn-row', chooseBtn, reconnectBtn, stopBtn),
    fileStatus);

  const hhmm = (d) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let note = '';   // a one-off message, such as an error, shown until the next status change

  store.onFileStatus((s) => {
    const linked = s.status === 'on' || s.status === 'needs-permission' || s.status === 'error';
    chooseBtn.textContent = linked ? 'Change file…' : 'Choose file…';
    chooseBtn.hidden = s.status === 'unsupported';
    reconnectBtn.hidden = s.status !== 'needs-permission';
    stopBtn.hidden = !s.name;
    fileStatus.textContent = note || ({
      unsupported: "This browser can't save to a file. Use Edge or Chrome, or download backups below.",
      off: 'Not saving to a file. Your log lives in this browser only. Pick a file (for example in Documents or OneDrive) and every change is saved to it automatically.',
      on: `Saved to ${s.name}${s.savedAt ? ` at ${hhmm(s.savedAt)}` : ''}. Every change is written automatically.`,
      'needs-permission': `${s.name}: the browser needs your OK again after a restart. Click Reconnect.`,
      error: s.error,
    })[s.status];
    note = '';
  });

  async function choose() {
    try {
      const picked = await store.pickFile();
      let fromFile = false;
      if (picked.incoming) {
        if (!confirm(`"${picked.name}" already has a work log.\n\nLoad it here? This replaces what is saved in this browser now.\n\n(Cancel to go back. Nothing changes.)`)) return;
        fromFile = true;
      }
      await store.useFile(picked, { fromFile });
      if (fromFile) location.reload();
    } catch (err) {
      if (err.name === 'AbortError') return;
      note = err.message || 'Could not use that file.';
      fileStatus.textContent = note;
    }
  }

  async function reconnect() {
    const result = await store.reconnectFile();
    if (result === 'loaded') location.reload();
  }

  // ── 2. Backup / restore ──
  const status = h('span.field-hint');

  const showLast = () => {
    const last = store.lastBackup();
    status.textContent = last
      ? `Last backup: ${new Date(last).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}.`
      : 'No backup downloaded yet.';
  };

  const exportBtn = h('button.btn', {
    onclick: () => {
      const blob = new Blob([store.exportData()], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: `work-companion-backup-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      showLast();
    },
  }, 'Download backup');

  const file = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true,
    onchange: async () => {
      const f = file.files[0];
      file.value = '';
      if (!f) return;
      if (!confirm('Restore this backup? It replaces everything currently saved here.')) return;
      try {
        await store.importData(await f.text());
        location.reload();
      } catch (err) {
        status.textContent = err.message.includes('backup') ? err.message : 'Could not read that file.';
      }
    },
  });

  showLast();
  return h('div.form',
    window.companion ? null : fileBox,
    h('div.field',
      h('span.field-label', 'Backup'),
      h('div.btn-row', exportBtn, h('button.btn', { onclick: () => file.click() }, 'Restore…'), file),
      status));
}
