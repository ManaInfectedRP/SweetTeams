const { app, BrowserWindow } = require('electron');
const path = require('path');

const isDev = !!process.env.APP_URL;

// Ignore certificate errors for dev mode (self-signed cert from Vite)
if (isDev) {
  app.commandLine.appendSwitch('ignore-certificate-errors');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  const devUrl = process.env.APP_URL || 'https://localhost:5173';

  if (isDev) {
    win.loadURL(devUrl);
    win.webContents.openDevTools(); // Open DevTools in dev mode
  } else {
    const indexPath = path.join(__dirname, '..', 'client', 'dist', 'index.html');
    win.loadFile(indexPath);
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
