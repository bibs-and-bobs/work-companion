// Electron entry point: one window, plus a tiny JSON settings store on disk.
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

const storeFile = () => path.join(app.getPath('userData'), 'companion.json');

function readStore() {
  try { return JSON.parse(fs.readFileSync(storeFile(), 'utf8')); }
  catch { return {}; }
}

ipcMain.handle('store:read', () => readStore());
ipcMain.handle('store:write', (_e, data) => {
  fs.mkdirSync(path.dirname(storeFile()), { recursive: true });
  fs.writeFileSync(storeFile(), JSON.stringify(data, null, 2));
  return true;
});

function createWindow() {
  const win = new BrowserWindow({
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
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
