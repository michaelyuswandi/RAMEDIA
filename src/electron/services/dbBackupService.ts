import { app, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { closeDatabase, DATABASE_PATH, sqlite } from '../database/index';

export async function backupToZip(mainWindow: any): Promise<{ success: boolean; filePath?: string; error?: string }> {
  let snapshotPath: string | null = null;
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Backup Archive',
      defaultPath: path.join(app.getPath('downloads'), `ramedia-backup-${new Date().toISOString().split('T')[0]}.zip`),
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
    });

    if (result.canceled || !result.filePath) {
      return { success: false, error: 'Backup cancelled' };
    }

    const zip = new AdmZip();

    // 1. Add database file
    if (fs.existsSync(DATABASE_PATH)) {
      snapshotPath = path.join(app.getPath('temp'), `ramedia-backup-snapshot-${Date.now()}.db`);
      await sqlite.backup(snapshotPath);
      zip.addLocalFile(snapshotPath, '', 'ramedia.db');
    }

    // 2. Add media directories in userData
    const userDataPath = app.getPath('userData');
    const assetFolders = ['assets_media', 'assets_documents', 'assets_audio', 'thumbnails'];

    for (const folder of assetFolders) {
      const folderPath = path.join(userDataPath, folder);
      if (fs.existsSync(folderPath)) {
        zip.addLocalFolder(folderPath, folder);
      }
    }

    // Save zip
    zip.writeZip(result.filePath);

    return { success: true, filePath: result.filePath };
  } catch (error) {
    console.error('[BackupService] Backup failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown backup error' };
  } finally {
    if (snapshotPath && fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
  }
}

export async function restoreFromZip(mainWindow: any): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Backup Archive',
      filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
      properties: ['openFile'],
    });

    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return { success: false, error: 'Restore cancelled' };
    }

    const zipPath = result.filePaths[0];
    const zip = new AdmZip(zipPath);

    // Accept the new RAMEDIA filename and backups created by older development builds.
    const dbEntry = zip.getEntry('ramedia.db') || zip.getEntry('rumedia.db');
    if (!dbEntry) {
      return { success: false, error: 'Invalid backup file: ramedia.db is missing.' };
    }

    // Extract to a temp directory
    const tempDir = path.join(app.getPath('temp'), `ramedia_restore_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    zip.extractAllTo(tempDir, true);

    // Close SQLite database
    closeDatabase();

    // Copy database file back
    const tempDbPath = path.join(tempDir, dbEntry.entryName);
    if (fs.existsSync(tempDbPath)) {
      fs.copyFileSync(tempDbPath, DATABASE_PATH);
    }

    // Copy media files back to userData
    const userDataPath = app.getPath('userData');
    const assetFolders = ['assets_media', 'assets_documents', 'assets_audio', 'thumbnails'];

    for (const folder of assetFolders) {
      const tempFolderPath = path.join(tempDir, folder);
      const targetFolderPath = path.join(userDataPath, folder);

      if (fs.existsSync(tempFolderPath)) {
        if (!fs.existsSync(targetFolderPath)) {
          fs.mkdirSync(targetFolderPath, { recursive: true });
        }
        copyFolderRecursiveSync(tempFolderPath, targetFolderPath);
      }
    }

    // Clean up temp folder
    fs.rmSync(tempDir, { recursive: true, force: true });

    // Relaunch the app to apply restore
    setTimeout(() => {
      app.relaunch();
      app.exit(0);
    }, 1000);

    return { success: true };
  } catch (error) {
    console.error('[BackupService] Restore failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown restore error' };
  }
}

function copyFolderRecursiveSync(source: string, target: string) {
  let files = [];

  const targetFolder = target;
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach((file) => {
      const curSource = path.join(source, file);
      const curTarget = path.join(targetFolder, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}
