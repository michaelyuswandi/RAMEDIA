import { db, schema } from './index';
import { eq } from 'drizzle-orm';
import type { BibleVersion, NewBibleVersion } from './schema';
import { randomUUID } from 'crypto';

/**
 * Bible Version Service
 * Manages Bible translations/versions in the database
 */

/**
 * Get all Bible versions
 */
export async function getAllVersions(): Promise<BibleVersion[]> {
  const versions = db.select().from(schema.bibleVersions).all();
  if (versions.length === 0) {
    const id = randomUUID();
    const tbVersion: NewBibleVersion = {
      id,
      code: 'TB',
      name: 'Terjemahan Baru',
      language: 'id',
      isActive: true,
      filePath: 'data/bible.xml.gz',
      downloadedAt: Date.now(),
    };
    db.insert(schema.bibleVersions).values(tbVersion).run();
    return [tbVersion as BibleVersion];
  }
  return versions;
}

/**
 * Get active Bible version (currently selected translation)
 */
export async function getActiveVersion(): Promise<BibleVersion | undefined> {
  const versions = db
    .select()
    .from(schema.bibleVersions)
    .where(eq(schema.bibleVersions.isActive, true))
    .all();
  
  return versions.length > 0 ? versions[0] : undefined;
}

/**
 * Get version by code
 */
export async function getVersionByCode(code: string): Promise<BibleVersion | undefined> {
  const versions = db
    .select()
    .from(schema.bibleVersions)
    .where(eq(schema.bibleVersions.code, code))
    .all();
  
  return versions.length > 0 ? versions[0] : undefined;
}

/**
 * Get version by ID
 */
export async function getVersionById(id: string): Promise<BibleVersion | undefined> {
  const versions = db
    .select()
    .from(schema.bibleVersions)
    .where(eq(schema.bibleVersions.id, id))
    .all();
  
  return versions.length > 0 ? versions[0] : undefined;
}

/**
 * Create new Bible version
 */
export async function createVersion(data: {
  code: string;
  name: string;
  language?: string;
  filePath?: string;
  hash?: string;
}): Promise<BibleVersion> {
  const id = randomUUID();
  const newVersion: NewBibleVersion = {
    id,
    code: data.code,
    name: data.name,
    language: data.language,
    filePath: data.filePath,
    hash: data.hash,
    isActive: false, // Don't auto-activate
    downloadedAt: Date.now(),
  };

  db.insert(schema.bibleVersions).values(newVersion).run();
  
  const created = await getVersionById(id);
  if (!created) throw new Error('Failed to create Bible version');
  
  return created;
}

/**
 * Update Bible version
 */
export async function updateVersion(
  id: string,
  data: Partial<NewBibleVersion>
): Promise<void> {
  db.update(schema.bibleVersions)
    .set({
      ...data,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.bibleVersions.id, id))
    .run();
}

/**
 * Set active Bible version (only one can be active)
 */
export async function setActiveVersion(id: string): Promise<void> {
  // Deactivate all versions
  db.update(schema.bibleVersions)
    .set({ isActive: false })
    .run();
  
  // Activate the selected one
  db.update(schema.bibleVersions)
    .set({ isActive: true })
    .where(eq(schema.bibleVersions.id, id))
    .run();
}

/**
 * Delete Bible version
 */
export async function deleteVersion(id: string): Promise<void> {
  db.delete(schema.bibleVersions)
    .where(eq(schema.bibleVersions.id, id))
    .run();
}

/**
 * Check if version exists by code
 */
export async function versionExists(code: string): Promise<boolean> {
  const version = await getVersionByCode(code);
  return !!version;
}

/**
 * Update version file path (when downloaded)
 */
export async function updateVersionPath(
  id: string,
  filePath: string,
  hash: string
): Promise<void> {
  db.update(schema.bibleVersions)
    .set({
      filePath,
      hash,
      downloadedAt: Date.now(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.bibleVersions.id, id))
    .run();
}

/**
 * Verify version integrity by hash
 */
export async function verifyVersionIntegrity(
  id: string,
  expectedHash: string
): Promise<boolean> {
  const version = await getVersionById(id);
  if (!version) return false;
  
  return version.hash === expectedHash;
}

/**
 * Get counts statistics
 */
export async function getVersionStats(): Promise<{
  total: number;
  active: number;
  downloaded: number;
}> {
  const all = await getAllVersions();
  
  return {
    total: all.length,
    active: all.filter(v => v.isActive).length,
    downloaded: all.filter(v => v.filePath).length,
  };
}
