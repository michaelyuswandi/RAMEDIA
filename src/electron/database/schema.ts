import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export type ContentThemeType = 'song' | 'scripture' | 'presentation' | 'media';

// Songs table
export const songs = sqliteTable('songs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  author: text('author'),
  copyright: text('copyright'),
  ccliNumber: text('ccli_number'),
  tempo: text('tempo'),
  songKey: text('song_key'),
  tags: text('tags'), // JSON array
  rawLyrics: text('raw_lyrics'), // Original Easy Mode input
  defaultThemeId: text('default_theme_id'),
  defaultTemplateId: text('default_template_id').references(() => templates.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Slides within songs
export const slides = sqliteTable('slides', {
  id: text('id').primaryKey(),
  songId: text('song_id').references(() => songs.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  sectionType: text('section_type'), // verse, chorus, bridge, intro, outro
  sectionNumber: integer('section_number'),
  content: text('content').notNull(),
  notes: text('notes'),
  customThemeId: text('custom_theme_id'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// 5-Layer system per slide
export const slideLayers = sqliteTable('slide_layers', {
  id: text('id').primaryKey(),
  slideId: text('slide_id').references(() => slides.id, { onDelete: 'cascade' }).notNull(),
  layerType: text('layer_type').notNull(), // text, overlay, media, background, base
  layerOrder: integer('layer_order').notNull(), // 1-5
  visible: integer('visible', { mode: 'boolean' }).default(true),
  opacity: real('opacity').default(1.0),
  content: text('content'), // text content or color
  mediaId: text('media_id'),
  style: text('style'), // JSON
  transition: text('transition'), // JSON
});

// Templates (Design Blueprints)
export const templates = sqliteTable('templates', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  category: text('category'), // Lower Third, Full Screen, Stage, etc.
  contentType: text('content_type').$type<ContentThemeType>().notNull().default('song'),
  layersData: text('layers_data').notNull(), // JSON array of SlideLayer (without slideId)
  variantsData: text('variants_data'), // Optional JSON variants (lyrics, title, blank, etc.)
  previewUrl: text('preview_url'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});


// Media library
export const media = sqliteTable('media', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  filepath: text('filepath').notNull(),
  mediaType: text('media_type').notNull(), // image, video, audio, pdf
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  duration: integer('duration'),
  width: integer('width'),
  height: integer('height'),
  thumbnail: text('thumbnail'),
  folderId: text('folder_id'),
  tags: text('tags'), // JSON array
  playbackSettings: text('playback_settings'), // JSON (e.g. {startTime, endTime, behavior, volume, scaling})
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Themes
export const themes = sqliteTable('themes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  backgroundType: text('background_type'),
  backgroundValue: text('background_value'),
  textStyle: text('text_style'), // JSON
  transitionIn: text('transition_in'), // JSON
  transitionOut: text('transition_out'), // JSON
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Schedules
export const schedules = sqliteTable('schedules', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  date: text('date'),
  serviceType: text('service_type'),
  notes: text('notes'),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Schedule items
export const scheduleItems = sqliteTable('schedule_items', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id').references(() => schedules.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  itemType: text('item_type').notNull(), // song, bible, media, announcement
  songId: text('song_id').references(() => songs.id),
  mediaId: text('media_id').references(() => media.id),
  
  // Bible-specific fields
  bibleVersionId: text('bible_version_id').references(() => bibleVersions.id),
  bibleBook: text('bible_book'), // e.g., "GEN", "PSM", "ROM"
  bibleChapter: integer('bible_chapter'),
  bibleVerseStart: integer('bible_verse_start'),
  bibleVerseEnd: integer('bible_verse_end'),
  
  content: text('content'), // JSON for other custom content
  duration: integer('duration'),
  notes: text('notes'),
  themeId: text('theme_id').references(() => themes.id),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Bible Versions (translations)
export const bibleVersions = sqliteTable('bible_versions', {
  id: text('id').primaryKey(),
  code: text('code').unique().notNull(), // "KJI", "KJV", "LSG"
  name: text('name').notNull(), // "Terjemahan Indonesia"
  language: text('language'), // "id", "en", "fr"
  isActive: integer('is_active', { mode: 'boolean' }).default(true),
  filePath: text('file_path'), // "~/.RAMEDIA/bibles/kji.xml.gz"
  downloadedAt: integer('downloaded_at'), // timestamp in ms
  hash: text('hash'), // checksum
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Slide Elements (content within slides)
export const slideElements = sqliteTable('slide_elements', {
  id: text('id').primaryKey(),
  slideId: text('slide_id').references(() => slides.id, { onDelete: 'cascade' }).notNull(),
  type: text('type').notNull(), // "TEXT", "BIBLE_VERSE", "IMAGE", "VIDEO"
  
  // Position & Size
  positionX: integer('position_x').default(0),
  positionY: integer('position_y').default(0),
  width: integer('width'),
  height: integer('height'),
  
  // For TEXT type
  content: text('content'),
  
  // For BIBLE_VERSE type
  bibleVersionId: text('bible_version_id').references(() => bibleVersions.id),
  bibleBook: text('bible_book'),
  bibleChapter: integer('bible_chapter'),
  bibleVerseStart: integer('bible_verse_start'),
  bibleVerseEnd: integer('bible_verse_end'),
  
  // Styling
  fontSize: integer('font_size').default(24),
  color: text('color').default('#FFFFFF'), // hex color
  backgroundColor: text('background_color'),
  align: text('align').default('CENTER'), // LEFT, CENTER, RIGHT
  
  // Media reference (for IMAGE/VIDEO types)
  mediaId: text('media_id').references(() => media.id),
  
  // Layout
  zIndex: integer('z_index').default(0),
  opacity: real('opacity').default(1.0),
  
  // Styling as JSON for complex properties
  styleJson: text('style_json'),
  
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

// Playlists (Collections)
export const playlists = sqliteTable('playlists', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  created_at: text('created_at').default('CURRENT_TIMESTAMP'),
  updated_at: text('updated_at').default('CURRENT_TIMESTAMP'),
});

export const playlistItems = sqliteTable('playlist_items', {
  id: text('id').primaryKey(),
  playlistId: text('playlist_id').references(() => playlists.id, { onDelete: 'cascade' }),
  orderIndex: integer('order_index').notNull(),
  songId: text('song_id').references(() => songs.id, { onDelete: 'cascade' }),
  createdAt: text('created_at').default('CURRENT_TIMESTAMP'),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: text('updated_at').default('CURRENT_TIMESTAMP'),
});

// Type exports
// Type exports
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
export type Slide = typeof slides.$inferSelect;
export type NewSlide = typeof slides.$inferInsert;
export type SlideLayer = typeof slideLayers.$inferSelect;
export type NewSlideLayer = typeof slideLayers.$inferInsert;
export type Media = typeof media.$inferSelect;
export type NewMedia = typeof media.$inferInsert;
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
export type Schedule = typeof schedules.$inferSelect;
export type NewSchedule = typeof schedules.$inferInsert;
export type ScheduleItem = typeof scheduleItems.$inferSelect;
export type NewScheduleItem = typeof scheduleItems.$inferInsert;
export type Playlist = typeof playlists.$inferSelect;
export type NewPlaylist = typeof playlists.$inferInsert;
export type PlaylistItem = typeof playlistItems.$inferSelect;
export type NewPlaylistItem = typeof playlistItems.$inferInsert;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;

export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type BibleVersion = typeof bibleVersions.$inferSelect;
export type NewBibleVersion = typeof bibleVersions.$inferInsert;
export type SlideElement = typeof slideElements.$inferSelect;
export type NewSlideElement = typeof slideElements.$inferInsert;
