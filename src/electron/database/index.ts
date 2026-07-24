import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import { seedDatabase } from './seed';

const DATABASE_FILENAME = 'ramedia.db';
const LEGACY_DATABASE_FILENAME = 'rumedia.db';
const CURRENT_SCHEMA_VERSION = 1;

export const DATABASE_PATH = path.join(app.getPath('userData'), DATABASE_FILENAME);
const databaseExistedInUserData = fs.existsSync(DATABASE_PATH);
let migratedLegacyDatabasePath: string | null = null;

function pathsAreEqual(left: string, right: string) {
  const normalize = (value: string) => {
    const resolved = path.resolve(value);
    return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
  };
  return normalize(left) === normalize(right);
}

function findLegacyDatabasePath() {
  const userDataParent = path.dirname(app.getPath('userData'));
  const candidates = [
    path.resolve(process.cwd(), LEGACY_DATABASE_FILENAME),
    path.join(app.getAppPath(), LEGACY_DATABASE_FILENAME),
    path.join(userDataParent, 'rumedia', LEGACY_DATABASE_FILENAME),
    path.join(userDataParent, 'RAMEDIA', LEGACY_DATABASE_FILENAME),
  ];

  return candidates.find((candidate, index) => (
    !pathsAreEqual(candidate, DATABASE_PATH)
    && candidates.findIndex((entry) => pathsAreEqual(entry, candidate)) === index
    && fs.existsSync(candidate)
    && fs.statSync(candidate).isFile()
  )) ?? null;
}

function migrateLegacyDatabaseIfNeeded() {
  if (fs.existsSync(DATABASE_PATH)) return;
  const legacyPath = findLegacyDatabasePath();
  if (!legacyPath) return;

  fs.copyFileSync(legacyPath, DATABASE_PATH, fs.constants.COPYFILE_EXCL);
  const legacyWalPath = `${legacyPath}-wal`;
  if (fs.existsSync(legacyWalPath)) {
    fs.copyFileSync(legacyWalPath, `${DATABASE_PATH}-wal`, fs.constants.COPYFILE_EXCL);
  }
  migratedLegacyDatabasePath = legacyPath;
  console.log(`[Database] Copied legacy database from ${legacyPath} to ${DATABASE_PATH}. The original was preserved.`);
}

fs.mkdirSync(path.dirname(DATABASE_PATH), { recursive: true });
migrateLegacyDatabaseIfNeeded();

// Create SQLite connection
export const sqlite = new Database(DATABASE_PATH);

// Enable WAL mode for better performance
sqlite.pragma('journal_mode = WAL');

export function closeDatabase() {
  if (sqlite.open) sqlite.close();
}

// Create Drizzle instance
export const db = drizzle(sqlite, { schema });

// Initialize database (create tables if not exist)
async function createPreMigrationBackup(previousSchemaVersion: number) {
  const hasExistingData = databaseExistedInUserData || migratedLegacyDatabasePath !== null;
  if (!hasExistingData || previousSchemaVersion >= CURRENT_SCHEMA_VERSION) return null;

  const backupDirectory = path.join(app.getPath('userData'), 'backups', 'automatic');
  fs.mkdirSync(backupDirectory, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(backupDirectory, `ramedia-before-schema-${CURRENT_SCHEMA_VERSION}-${timestamp}.db`);
  await sqlite.backup(backupPath);
  console.log(`[Database] Created pre-migration backup at ${backupPath}`);
  return backupPath;
}

export async function initDatabase() {
  const previousSchemaVersion = Number(sqlite.pragma('user_version', { simple: true })) || 0;
  await createPreMigrationBackup(previousSchemaVersion);

  // Create tables using raw SQL (Drizzle migrations would be better for production)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      author TEXT,
      copyright TEXT,
      ccli_number TEXT,
      tempo TEXT,
      song_key TEXT,
      tags TEXT,
      raw_lyrics TEXT,
      default_theme_id TEXT,
      default_template_id TEXT REFERENCES templates(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS slides (
      id TEXT PRIMARY KEY,
      song_id TEXT REFERENCES songs(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      section_type TEXT,
      section_number INTEGER,
      content TEXT NOT NULL,
      notes TEXT,
      custom_theme_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS slide_layers (
      id TEXT PRIMARY KEY,
      slide_id TEXT NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
      layer_type TEXT NOT NULL,
      layer_order INTEGER NOT NULL,
      visible INTEGER DEFAULT 1,
      opacity REAL DEFAULT 1.0,
      content TEXT,
      media_id TEXT,
      style TEXT,
      transition TEXT
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      content_type TEXT NOT NULL DEFAULT 'song',
      layers_data TEXT NOT NULL,
      variants_data TEXT,
      preview_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      media_type TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      duration INTEGER,
      width INTEGER,
      height INTEGER,
      thumbnail TEXT,
      folder_id TEXT,
      tags TEXT,
      playback_settings TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );


    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER DEFAULT 0,
      background_type TEXT,
      background_value TEXT,
      text_style TEXT,
      transition_in TEXT,
      transition_out TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      date TEXT,
      service_type TEXT,
      notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule_items (
      id TEXT PRIMARY KEY,
      schedule_id TEXT REFERENCES schedules(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL,
      item_type TEXT NOT NULL,
      song_id TEXT REFERENCES songs(id),
      media_id TEXT REFERENCES media(id),
      bible_version_id TEXT REFERENCES bible_versions(id),
      bible_book TEXT,
      bible_chapter INTEGER,
      bible_verse_start INTEGER,
      bible_verse_end INTEGER,
      content TEXT,
      duration INTEGER,
      notes TEXT,
      theme_id TEXT REFERENCES themes(id),
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bible_versions (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      language TEXT,
      is_active INTEGER DEFAULT 1,
      file_path TEXT,
      downloaded_at INTEGER,
      hash TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS slide_elements (
      id TEXT PRIMARY KEY,
      slide_id TEXT NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      position_x INTEGER DEFAULT 0,
      position_y INTEGER DEFAULT 0,
      width INTEGER,
      height INTEGER,
      content TEXT,
      bible_version_id TEXT REFERENCES bible_versions(id),
      bible_book TEXT,
      bible_chapter INTEGER,
      bible_verse_start INTEGER,
      bible_verse_end INTEGER,
      font_size INTEGER DEFAULT 24,
      color TEXT DEFAULT '#FFFFFF',
      background_color TEXT,
      align TEXT DEFAULT 'CENTER',
      media_id TEXT REFERENCES media(id),
      z_index INTEGER DEFAULT 0,
      opacity REAL DEFAULT 1.0,
      style_json TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_slides_song ON slides(song_id);
    CREATE INDEX IF NOT EXISTS idx_slide_layers_slide ON slide_layers(slide_id);
    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_bible_versions_code ON bible_versions(code);
    CREATE INDEX IF NOT EXISTS idx_slide_elements_slide ON slide_elements(slide_id);
    CREATE INDEX IF NOT EXISTS idx_schedule_items_schedule ON schedule_items(schedule_id);
  `);

  // Migration Scripts
  try {
    const tableInfo = sqlite.prepare("PRAGMA table_info(media)").all() as any[];
    const hasPlaybackSettings = tableInfo.some(column => column.name === 'playback_settings');
    if (!hasPlaybackSettings) {
      sqlite.prepare("ALTER TABLE media ADD COLUMN playback_settings TEXT").run();
      console.log('[Database] Migrated `media` table: Added `playback_settings` column');
    }

    // Migration: Add Bible columns to schedule_items
    const scheduleItemsInfo = sqlite.prepare("PRAGMA table_info(schedule_items)").all() as any[];
    const hasBibleVersionId = scheduleItemsInfo.some(column => column.name === 'bible_version_id');
    if (!hasBibleVersionId) {
      sqlite.prepare("ALTER TABLE schedule_items ADD COLUMN bible_version_id TEXT REFERENCES bible_versions(id)").run();
      sqlite.prepare("ALTER TABLE schedule_items ADD COLUMN bible_book TEXT").run();
      sqlite.prepare("ALTER TABLE schedule_items ADD COLUMN bible_chapter INTEGER").run();
      sqlite.prepare("ALTER TABLE schedule_items ADD COLUMN bible_verse_start INTEGER").run();
      sqlite.prepare("ALTER TABLE schedule_items ADD COLUMN bible_verse_end INTEGER").run();
      console.log('[Database] Migrated `schedule_items` table: Added Bible columns');
    }

    const songsInfo = sqlite.prepare("PRAGMA table_info(songs)").all() as any[];
    const hasDefaultTemplateId = songsInfo.some(column => column.name === 'default_template_id');
    if (!hasDefaultTemplateId) {
      sqlite.prepare("ALTER TABLE songs ADD COLUMN default_template_id TEXT REFERENCES templates(id)").run();
      console.log('[Database] Migrated `songs` table: Added `default_template_id` column');
    }

    const templatesInfo = sqlite.prepare("PRAGMA table_info(templates)").all() as any[];
    if (!templatesInfo.some(column => column.name === 'content_type')) {
      sqlite.prepare("ALTER TABLE templates ADD COLUMN content_type TEXT NOT NULL DEFAULT 'song'").run();
      console.log('[Database] Migrated `templates` table: Added `content_type` column');
    }
    if (!templatesInfo.some(column => column.name === 'variants_data')) {
      sqlite.prepare("ALTER TABLE templates ADD COLUMN variants_data TEXT").run();
      console.log('[Database] Migrated `templates` table: Added `variants_data` column');
    }
  } catch (error) {
    console.error('[Database] Migration failed:', error);
    throw error;
  }

  sqlite.pragma(`user_version = ${CURRENT_SCHEMA_VERSION}`);

  console.log(`[Database] Initialized successfully at ${DATABASE_PATH}`);
  
  // Seed with sample data if empty
  seedDatabase();
}

export { schema };
