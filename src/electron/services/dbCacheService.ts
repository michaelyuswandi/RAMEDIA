import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../database/index';
import { media as mediaTable, slideLayers, slideElements, scheduleItems } from '../database/schema';
import { eq } from 'drizzle-orm';

export interface CacheAsset {
  id: string;
  filename: string;
  filepath: string;
  mediaType: string;
  fileSize: number;
  thumbnail: string;
  inUse: boolean;
}

function getFolderSize(dirPath: string): number {
  if (!fs.existsSync(dirPath)) return 0;
  let size = 0;
  const files = fs.readdirSync(dirPath);
  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);
    if (stats.isDirectory()) {
      size += getFolderSize(filePath);
    } else {
      size += stats.size;
    }
  }
  return size;
}

export async function getCacheStats() {
  const userDataPath = app.getPath('userData');
  const folders = ['assets_media', 'assets_documents', 'assets_audio', 'thumbnails'];
  let totalBytes = 0;
  const folderStats = folders.map(f => {
    const size = getFolderSize(path.join(userDataPath, f));
    totalBytes += size;
    return { name: f, size };
  });

  return {
    totalBytes,
    folders: folderStats
  };
}

export async function listCacheAssets(): Promise<CacheAsset[]> {
  try {
    const allMedia = db.select().from(mediaTable).all();

    const layers = db.select({ mediaId: slideLayers.mediaId }).from(slideLayers).all();
    const elements = db.select({ mediaId: slideElements.mediaId }).from(slideElements).all();
    const schedules = db.select({ mediaId: scheduleItems.mediaId }).from(scheduleItems).all();

    const usedIds = new Set<string>();
    layers.forEach(l => l.mediaId && usedIds.add(l.mediaId));
    elements.forEach(e => e.mediaId && usedIds.add(e.mediaId));
    schedules.forEach(s => s.mediaId && usedIds.add(s.mediaId));

    return allMedia.map(m => ({
      id: m.id,
      filename: m.filename,
      filepath: m.filepath,
      mediaType: m.mediaType,
      fileSize: m.fileSize || 0,
      thumbnail: m.thumbnail || '',
      inUse: usedIds.has(m.id)
    }));
  } catch (error) {
    console.error('[CacheService] Failed to list cache assets:', error);
    return [];
  }
}

export async function deleteCacheAsset(id: string): Promise<boolean> {
  try {
    const mediaRecord = db.select().from(mediaTable).where(eq(mediaTable.id, id)).get();
    if (!mediaRecord) return false;

    db.delete(mediaTable).where(eq(mediaTable.id, id)).run();

    const deleteFileByUrl = (fileUrl: string) => {
      try {
        if (fileUrl.startsWith('file://')) {
          // Decode URL for filesystem path
          let cleanPath = decodeURIComponent(fileUrl.replace('file://', ''));
          // On Windows, resolve path properly
          if (process.platform === 'win32' && cleanPath.startsWith('/')) {
            cleanPath = cleanPath.slice(1);
          }
          if (fs.existsSync(cleanPath)) {
            fs.unlinkSync(cleanPath);
          }
        }
      } catch (err) {
        console.error('[CacheService] Failed to delete file:', fileUrl, err);
      }
    };

    if (mediaRecord.filepath) deleteFileByUrl(mediaRecord.filepath);
    if (mediaRecord.thumbnail) deleteFileByUrl(mediaRecord.thumbnail);

    return true;
  } catch (error) {
    console.error('[CacheService] Failed to delete cache asset:', error);
    return false;
  }
}

export async function clearUnusedCache(): Promise<{ deletedCount: number; savedBytes: number }> {
  try {
    const assets = await listCacheAssets();
    const unusedAssets = assets.filter(a => !a.inUse);
    let deletedCount = 0;
    let savedBytes = 0;

    for (const asset of unusedAssets) {
      const success = await deleteCacheAsset(asset.id);
      if (success) {
        deletedCount++;
        savedBytes += asset.fileSize;
      }
    }

    return { deletedCount, savedBytes };
  } catch (error) {
    console.error('[CacheService] Failed to clear unused cache:', error);
    return { deletedCount: 0, savedBytes: 0 };
  }
}
