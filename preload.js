// Exposes a minimal, safe bridge to the renderer.
const { contextBridge, ipcRenderer } = require('electron');

// Menu "Settings…" can arrive before the page has finished booting; remember it until then.
let settingsHandler = null;
let settingsPending = false;
ipcRenderer.on('menu:settings', () => {
  if (settingsHandler) settingsHandler();
  else settingsPending = true;
});

contextBridge.exposeInMainWorld('companion', {
  store: {
    read: () => ipcRenderer.invoke('store:read'),
    write: (data) => ipcRenderer.invoke('store:write', data),
  },
  // App menu "Settings…" (Cmd+,) asks the page to open its Settings drawer.
  onOpenSettings: (fn) => {
    settingsHandler = fn;
    if (settingsPending) { settingsPending = false; fn(); }
  },
});
