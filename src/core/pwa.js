// Web-app plumbing: offline cache, "Install app" prompt, persistent storage.
// Does nothing inside Electron (file://), where none of it applies.

const isWeb = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
let installEvent = null;
const installSubs = new Set();

export function initPwa() {
  if (!isWeb) return;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((err) => console.warn('Offline cache unavailable', err));
  }
  // Ask the browser not to clear our data when disk is low.
  navigator.storage?.persist?.().catch(() => {});

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    installSubs.forEach((fn) => fn(true));
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    installSubs.forEach((fn) => fn(false));
  });
}

// fn(canInstall) — called whenever the browser offers (or withdraws) installing.
export function onInstallable(fn) {
  installSubs.add(fn);
  fn(!!installEvent);
  return () => installSubs.delete(fn);
}

export async function install() {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  installSubs.forEach((fn) => fn(false));
}
