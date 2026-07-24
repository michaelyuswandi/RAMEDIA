import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Local Storage Manager
 * Manages Bible files and other data in local filesystem
 */

// Keep the historical on-disk folder name so existing downloaded Bibles remain available.
const RUMEDIA_FOLDER_NAME = '.RUMEDIA';
const BIBLES_SUBFOLDER = 'bibles';

/**
 * Get RAMEDIA home directory path
 * Creates if doesn't exist
 */
export function getRUMEDIAHome(): string {
  const home = os.homedir();
  const rumediaPath = path.join(home, RUMEDIA_FOLDER_NAME);

  if (!fs.existsSync(rumediaPath)) {
    fs.mkdirSync(rumediaPath, { recursive: true });
  }

  return rumediaPath;
}

/**
 * Get bibles folder path
 * Creates if doesn't exist
 */
export function getBiblesFolder(): string {
  const biblesPath = path.join(getRUMEDIAHome(), BIBLES_SUBFOLDER);

  if (!fs.existsSync(biblesPath)) {
    fs.mkdirSync(biblesPath, { recursive: true });
  }

  return biblesPath;
}

/**
 * Save Bible XML.GZ file locally
 */
export function saveBibleFile(code: string, buffer: ArrayBuffer): string {
  const biblesFolder = getBiblesFolder();
  const filename = `${code.toLowerCase()}.xml.gz`;
  const filePath = path.join(biblesFolder, filename);

  // Write buffer to file
  fs.writeFileSync(filePath, Buffer.from(buffer));

  return filePath;
}

/**
 * Load Bible XML.GZ file from local storage
 */
export function loadBibleFile(code: string): ArrayBuffer | null {
  const biblesFolder = getBiblesFolder();
  const filename = `${code.toLowerCase()}.xml.gz`;
  const filePath = path.join(biblesFolder, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const buffer = fs.readFileSync(filePath);
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  );
}

/**
 * Check if Bible file exists
 */
export function bibleFileExists(code: string): boolean {
  const biblesFolder = getBiblesFolder();
  const filename = `${code.toLowerCase()}.xml.gz`;
  const filePath = path.join(biblesFolder, filename);

  return fs.existsSync(filePath);
}

/**
 * Delete Bible file
 */
export function deleteBibleFile(code: string): boolean {
  const biblesFolder = getBiblesFolder();
  const filename = `${code.toLowerCase()}.xml.gz`;
  const filePath = path.join(biblesFolder, filename);

  if (!fs.existsSync(filePath)) {
    return false;
  }

  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    console.error('Failed to delete Bible file:', error);
    return false;
  }
}

/**
 * Get file size in bytes
 */
export function getBibleFileSize(code: string): number | null {
  const biblesFolder = getBiblesFolder();
  const filename = `${code.toLowerCase()}.xml.gz`;
  const filePath = path.join(biblesFolder, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const stats = fs.statSync(filePath);
  return stats.size;
}

/**
 * Calculate MD5 hash of file (for integrity verification)
 */
export function calculateFileHash(code: string): string | null {
  const crypto = require('crypto');
  const biblesFolder = getBiblesFolder();
  const filename = `${code.toLowerCase()}.xml.gz`;
  const filePath = path.join(biblesFolder, filename);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath);
  const hash = crypto.createHash('md5').update(content).digest('hex');

  return hash;
}

/**
 * List all downloaded Bibles
 */
export function listDownloadedBibles(): string[] {
  const biblesFolder = getBiblesFolder();

  if (!fs.existsSync(biblesFolder)) {
    return [];
  }

  const files = fs.readdirSync(biblesFolder);
  return files
    .filter(file => file.endsWith('.xml.gz'))
    .map(file => file.replace('.xml.gz', '').toUpperCase());
}

/**
 * Get storage statistics
 */
export function getStorageStats(): {
  rumediaPath: string;
  biblesPath: string;
  totalBiblesSize: number;
  biblesCount: number;
} {
  const rumediaPath = getRUMEDIAHome();
  const biblesPath = getBiblesFolder();
  const bibles = listDownloadedBibles();

  let totalSize = 0;
  for (const bible of bibles) {
    const size = getBibleFileSize(bible);
    if (size) totalSize += size;
  }

  return {
    rumediaPath,
    biblesPath,
    totalBiblesSize: totalSize,
    biblesCount: bibles.length,
  };
}

/**
 * Clear all Bible cache (delete all downloaded Bibles)
 */
export function clearBibleCache(): boolean {
  const bibles = listDownloadedBibles();

  for (const bible of bibles) {
    deleteBibleFile(bible);
  }

  return true;
}
