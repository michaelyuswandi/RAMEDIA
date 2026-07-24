import * as bibleVersionService from '../database/bibleVersionService';
import * as downloadService from './bibleDownloadService';
import * as storageManager from './localStorageManager';
import { loadBibleData } from '../../services/bibleService';
import type { BibleVersion } from '../database/schema';
import pako from 'pako';

/**
 * Bible Manager
 * Main service for managing Bible translations (download, switch, cache)
 */

interface DownloadProgressEvent {
  code: string;
  loaded: number;
  total: number;
  percent: number;
}

type ProgressCallback = (event: DownloadProgressEvent) => void;

let progressCallbacks: ProgressCallback[] = [];

/**
 * Subscribe to download progress events
 */
export function onDownloadProgress(callback: ProgressCallback): () => void {
  progressCallbacks.push(callback);

  // Return unsubscribe function
  return () => {
    progressCallbacks = progressCallbacks.filter(cb => cb !== callback);
  };
}

/**
 * Emit progress event to all subscribers
 */
function emitProgress(event: DownloadProgressEvent): void {
  progressCallbacks.forEach(callback => callback(event));
}

/**
 * Get all available Bible versions
 */
export async function getAllVersions(): Promise<BibleVersion[]> {
  return bibleVersionService.getAllVersions();
}

/**
 * Get active Bible version
 */
export async function getActiveVersion(): Promise<BibleVersion | undefined> {
  return bibleVersionService.getActiveVersion();
}

/**
 * Get Bible version by code
 */
export async function getVersionByCode(code: string): Promise<BibleVersion | undefined> {
  return bibleVersionService.getVersionByCode(code);
}

/**
 * Switch active Bible translation
 */
export async function setActiveVersion(id: string): Promise<void> {
  return bibleVersionService.setActiveVersion(id);
}

/**
 * Download Bible translation from URL
 */
export async function downloadTranslation(
  code: string,
  url: string,
  metadata: {
    name: string;
    language?: string;
  }
): Promise<BibleVersion> {
  try {
    console.log(`[BibleManager] Starting download for ${code} from ${url}`);

    // Check if already exists
    const existing = await bibleVersionService.getVersionByCode(code);
    if (existing?.filePath && storageManager.bibleFileExists(code)) {
      console.log(`[BibleManager] Bible ${code} already exists, skipping download`);
      return existing;
    }

    // Download file
    const buffer = await downloadService.downloadFileWithRetry(url, {
      maxRetries: 3,
      onProgress: (progress) => {
        emitProgress({
          code,
          loaded: progress.loaded,
          total: progress.total,
          percent: progress.percent,
        });
      },
    });

    console.log(`[BibleManager] Download complete, saving locally...`);

    // Save locally
    const filePath = storageManager.saveBibleFile(code, buffer);
    const hash = downloadService.calculateBufferHash(buffer);

    console.log(`[BibleManager] Saved to ${filePath}, hash: ${hash}`);

    // Create or update version in database
    let version = existing;
    if (version) {
      await bibleVersionService.updateVersionPath(version.id, filePath, hash);
    } else {
      version = await bibleVersionService.createVersion({
        code,
        name: metadata.name,
        language: metadata.language,
        filePath,
        hash,
      });
    }

    console.log(`[BibleManager] Downloaded ${code} successfully`);
    return version;
  } catch (error) {
    console.error(`[BibleManager] Download failed for ${code}:`, error);
    throw error;
  }
}

/**
 * Load Bible data into memory
 * (will load from local cache if available)
 */
export async function loadBible(versionId?: string): Promise<any> {
  try {
    let version: BibleVersion | undefined;

    if (versionId) {
      version = await bibleVersionService.getVersionById(versionId);
    } else {
      version = await bibleVersionService.getActiveVersion();
    }

    if (!version) {
      throw new Error('No Bible version available');
    }

    // Check if file exists locally
    if (!version.filePath || !storageManager.bibleFileExists(version.code)) {
      if (version.code === 'TB') {
        const data = await loadBibleData();
        return data;
      }
      throw new Error(
        `Bible ${version.code} not found locally. Please download it first.`
      );
    }

    console.log(`[BibleManager] Loading ${version.code} into memory...`);

    // Load from local file
    const buffer = storageManager.loadBibleFile(version.code);
    if (!buffer) {
      throw new Error(`Failed to load Bible file for ${version.code}`);
    }

    // Parse and cache
    const data = await loadBibleData(buffer);
    console.log(`[BibleManager] Loaded ${version.code} successfully`);

    return data;
  } catch (error) {
    console.error('[BibleManager] Failed to load Bible:', error);
    throw error;
  }
}

/**
 * Return the active/local Bible file as a raw buffer for renderer-side parsing.
 * The built-in TB version returns null so the renderer can use the bundled asset.
 */
export async function getBibleBuffer(versionId?: string): Promise<ArrayBuffer | null> {
  let version: BibleVersion | undefined;

  if (versionId) {
    version = await bibleVersionService.getVersionById(versionId);
  } else {
    version = await bibleVersionService.getActiveVersion();
  }

  if (!version || version.code === 'TB') return null;
  if (!version.filePath || !storageManager.bibleFileExists(version.code)) return null;

  return storageManager.loadBibleFile(version.code);
}

export async function getActiveBibleBuffer(): Promise<ArrayBuffer | null> {
  return getBibleBuffer();
}

/**
 * Delete Bible translation
 */
export async function deleteTranslation(id: string): Promise<void> {
  try {
    const version = await bibleVersionService.getVersionById(id);
    if (!version) {
      throw new Error('Version not found');
    }

    // Delete file
    storageManager.deleteBibleFile(version.code);

    // Delete from database
    await bibleVersionService.deleteVersion(id);

    console.log(`[BibleManager] Deleted ${version.code}`);
  } catch (error) {
    console.error('[BibleManager] Failed to delete translation:', error);
    throw error;
  }
}

/**
 * List downloaded Bibles
 */
export function listDownloadedBibles(): string[] {
  return storageManager.listDownloadedBibles();
}

/**
 * Get storage statistics
 */
export function getStorageStats(): {
  rumediaPath: string;
  biblesPath: string;
  totalBiblesSize: number;
  biblesCount: number;
  totalSizeInMB: number;
} {
  const stats = storageManager.getStorageStats();
  return {
    ...stats,
    totalSizeInMB: stats.totalBiblesSize / 1024 / 1024,
  };
}

/**
 * Clear all Bible cache
 */
export function clearBibleCache(): void {
  storageManager.clearBibleCache();
  console.log('[BibleManager] Cleared Bible cache');
}

/**
 * Get available languages for download
 * (This would be fetched from a server in production)
 */
export async function getAvailableDownloads(): Promise<
  Array<{
    code: string;
    name: string;
    language: string;
    size: number;
    url: string;
  }>
> {
  // In production, this would call an API
  // For now, return empty array
  return [];
}

/**
 * Verify Bible integrity
 */
export async function verifyBibleIntegrity(id: string): Promise<boolean> {
  try {
    const version = await bibleVersionService.getVersionById(id);
    if (!version || !version.hash) {
      return false;
    }

    const buffer = storageManager.loadBibleFile(version.code);
    if (!buffer) {
      return false;
    }

    return downloadService.verifyIntegrity(buffer, version.hash);
  } catch (error) {
    console.error('[BibleManager] Verification failed:', error);
    return false;
  }
}

/**
 * Import a local Bible file (XML or XML.GZ format)
 */
export async function importLocalBible(
  code: string,
  name: string,
  arrayBuffer: ArrayBuffer,
  language?: string
): Promise<BibleVersion> {
  try {
    console.log(`[BibleManager] Importing local Bible ${code} (${name})`);

    // Check if already exists
    const existing = await bibleVersionService.getVersionByCode(code);
    if (existing?.filePath && storageManager.bibleFileExists(code)) {
      console.log(`[BibleManager] Bible ${code} already exists, skipping import`);
      return existing;
    }

    // Ensure the data is compressed (gzip)
    let finalBuffer = arrayBuffer;
    const uint8View = new Uint8Array(arrayBuffer);
    const isGzipped = uint8View.length >= 2 && uint8View[0] === 0x1f && uint8View[1] === 0x8b;
    
    if (!isGzipped) {
      console.log(`[BibleManager] Compressing plain XML Bible data...`);
      const compressed = pako.gzip(uint8View);
      finalBuffer = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
    }

    // Save locally
    const filePath = storageManager.saveBibleFile(code, finalBuffer);
    const hash = downloadService.calculateBufferHash(finalBuffer);

    console.log(`[BibleManager] Imported & saved to ${filePath}, hash: ${hash}`);

    // Create or update version in database
    let version = existing;
    if (version) {
      await bibleVersionService.updateVersionPath(version.id, filePath, hash);
    } else {
      version = await bibleVersionService.createVersion({
        code,
        name,
        language,
        filePath,
        hash,
      });
    }

    // Switch version to active
    await bibleVersionService.setActiveVersion(version.id);

    console.log(`[BibleManager] Local Bible ${code} imported successfully`);
    return version;
  } catch (error) {
    console.error(`[BibleManager] Import failed for ${code}:`, error);
    throw error;
  }
}

export {
  downloadCloudBible,
  getBibleBrainBibles,
  getBibleBrainCountries,
  getBibleBrainLanguages,
  getCloudBibles,
  searchCloudBibles,
} from './bibleBrainService';
