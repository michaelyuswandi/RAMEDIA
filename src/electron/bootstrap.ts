import { app, dialog } from 'electron';

app.setName('RAMEDIA');
if (process.platform === 'win32') app.setAppUserModelId('id.ramedia.desktop');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  import('./main').catch((err) => {
    console.error('[Fatal Error]', err);
    dialog.showErrorBox(
      'RAMEDIA Startup Error',
      `Gagal menjalankan aplikasi:\n\n${err?.stack || String(err)}`
    );
    app.quit();
  });
}

