import { app } from 'electron';

app.setName('RAMEDIA');
if (process.platform === 'win32') app.setAppUserModelId('id.ramedia.desktop');

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  void import('./main');
}
