// Electron entry point: one window, a native menu, and a tiny JSON store on disk.
// Used for the Mac app (and optionally Windows/Linux). The web app does not need this file.
const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const isMac = process.platform === 'darwin';
const storeFile = () => path.join(app.getPath('userData'), 'companion.json');

// Up to v0.3 the data folder was named after package "name" (work-companion). Since v0.4 the
// package has a productName, so the folder is "Work Companion". Copy an old log across once.
function adoptOldStore() {
  const oldFile = path.join(app.getPath('appData'), 'work-companion', 'companion.json');
  const file = storeFile();
  if (fs.existsSync(file) || !fs.existsSync(oldFile) || path.resolve(oldFile) === path.resolve(file)) return;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.copyFileSync(oldFile, file);
}

function readStore() {
  try { return JSON.parse(fs.readFileSync(storeFile(), 'utf8')); }
  catch { return {}; }
}

ipcMain.handle('store:read', () => readStore());
ipcMain.handle('store:write', (_e, data) => {
  // Write to a temp file, then rename, so a crash mid-write can't corrupt the log.
  const file = storeFile();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(data, null, 2));
  fs.renameSync(`${file}.tmp`, file);
  return true;
});

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 980,
    height: 720,
    minWidth: 420,
    minHeight: 520,
    backgroundColor: '#f3eee3',
    title: 'Work Companion',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.on('closed', () => { win = null; });

  // Any outside link opens in the normal browser, never inside the app window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
}

function showWindow() {
  if (!win) createWindow();
  else { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
}

// Native menu. Cmd+1 / Cmd+2 / Cmd+N are handled by the page itself (same as the web app),
// so they are not menu accelerators here. Cmd+, (Settings) goes through the bridge.
function buildMenu() {
  const openSettings = () => { showWindow(); win?.webContents.send('menu:settings'); };
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { label: 'Settings…', accelerator: 'Cmd+,', click: openSettings },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : [{
      label: 'File',
      submenu: [{ label: 'Settings', accelerator: 'Ctrl+,', click: openSettings }, { type: 'separator' }, { role: 'quit' }],
    }]),
    { role: 'editMenu' },   // Cut/Copy/Paste/Select All in note fields need this on macOS
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    { role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// One copy of the app at a time: opening it again just brings the window forward.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);

  app.whenReady().then(() => {
    try { adoptOldStore(); } catch (err) { console.warn('Could not copy the old data file', err); }
    app.setAboutPanelOptions({
      applicationName: 'Work Companion',
      applicationVersion: app.getVersion(),
      copyright: 'MIT License',
    });
    buildMenu();
    createWindow();
    // macOS: clicking the Dock icon with no window open makes a new one.
    app.on('activate', showWindow);
  });

  // macOS apps stay running (in the Dock) when the window closes.
  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
