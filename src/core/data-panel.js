// "Your data" section of the Settings drawer: backup and restore.
// Data lives in this browser only, so backups are the safety net.

export function dataPanel({ h, store }) {
  const status = h('span.field-hint');

  const showLast = () => {
    const last = store.lastBackup();
    status.textContent = last
      ? `Last backup: ${new Date(last).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}.`
      : 'No backup yet. Your log lives only in this browser.';
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
    h('div.field',
      h('div.btn-row', exportBtn, h('button.btn', { onclick: () => file.click() }, 'Restore…'), file),
      status));
}
