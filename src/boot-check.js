// Startup watchdog (plain script, runs even if the app's modules fail to load).
// If the app hasn't drawn anything after a few seconds, or boot throws, it shows what went wrong
// and a Repair button: drops the offline cache and service worker, then reloads.
// Repair never touches your saved data (localStorage / linked file).
(() => {
  const errors = [];
  const note = (e) => errors.push(String(e?.stack || e?.message || e));
  addEventListener('error', (e) => note(e.error || e.message));
  addEventListener('unhandledrejection', (e) => note(e.reason));

  async function repair() {
    try {
      for (const r of (await navigator.serviceWorker?.getRegistrations()) ?? []) await r.unregister();
      for (const k of (await caches?.keys()) ?? []) await caches.delete(k);
    } catch {}
    location.reload();
  }

  function show(err) {
    if (err) note(err);
    const app = document.getElementById('app');
    if (!app || document.getElementById('boot-fail')) return;
    const box = document.createElement('div');
    box.id = 'boot-fail';
    box.className = 'card ink-pink boot-fail';
    const h = document.createElement('h2');
    h.className = 'card-title';
    h.textContent = 'Work Companion did not start';
    const p = document.createElement('p');
    p.textContent = 'Your data is safe. Repair clears the offline copy of the app and loads it fresh.';
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = 'Repair and reload';
    btn.onclick = repair;
    const pre = document.createElement('pre');
    pre.className = 'boot-fail-log';
    pre.textContent = errors.join('\n\n') || 'No error message: the app did not finish loading (slow network or a blocked file?).';
    box.append(h, p, btn, pre);
    app.replaceChildren(box);
  }

  window.__bootFail = show;
  addEventListener('load', () => setTimeout(() => {
    if (!document.querySelector('#app > .masthead')) show();
  }, 8000));
})();
