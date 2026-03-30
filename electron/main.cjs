/**
 * Processo principal Electron — painel Vite (dev) ou ficheiros estáticos (build).
 */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const DEV_URL = process.env.GUTO_ELECTRON_URL || 'http://127.0.0.1:5173';
const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Guto Express',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(__dirname, '..', 'frontend', 'dist', 'index.html');
    win.loadFile(indexPath).catch((err) => {
      console.error('[electron] Falha ao carregar dist. Faça build do frontend com ELECTRON_BUILD=1', err);
      win.loadURL(
        'data:text/html,<meta charset=utf-8><h1>Guto Express</h1><p>Build do frontend em falta.</p>',
      );
    });
  }

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    if (isDev) console.error('[electron] Falha ao carregar', url, code, desc);
  });
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
