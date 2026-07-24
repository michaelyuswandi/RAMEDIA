# RAMEDIA Database Schema

## Overview

RAMEDIA uses SQLite for local-first, offline-capable data storage. The schema is designed for performance and flexibility.

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   songs     │────<│   slides    │────<│   layers    │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       └─────────────────┐
                         │
┌─────────────┐     ┌────┴────────┐     ┌─────────────┐
│   media     │────<│ song_media  │     │   themes    │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
┌─────────────┐     ┌─────────────┐           │
│  schedules  │────<│schedule_items│──────────┘
└─────────────┘     └─────────────┘

┌─────────────┐     ┌─────────────┐
│   bibles    │────<│   verses    │
└─────────────┘     └─────────────┘
```

## Tables

### songs

Primary table for worship songs.

```sql
CREATE TABLE songs (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  author        TEXT,
  copyright     TEXT,
  ccli_number   TEXT,
  tempo         TEXT,         -- slow, medium, fast
  key           TEXT,         -- C, D, Em, etc.
  tags          TEXT,         -- JSON array of tags
  default_theme_id TEXT REFERENCES themes(id),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_tags ON songs(tags);
```

### slides

Individual slides within a song (or standalone).

```sql
CREATE TABLE slides (
  id            TEXT PRIMARY KEY,
  song_id       TEXT REFERENCES songs(id) ON DELETE CASCADE,
  order_index   INTEGER NOT NULL,
  section_type  TEXT,         -- verse, chorus, bridge, intro, outro
  section_number INTEGER,     -- verse 1, 2, 3...
  content       TEXT NOT NULL,
  notes         TEXT,         -- operator notes
  custom_theme_id TEXT REFERENCES themes(id),
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_slides_song ON slides(song_id);
```

### layers

Layer configuration per slide.

```sql
CREATE TABLE layers (
  id            TEXT PRIMARY KEY,
  slide_id      TEXT REFERENCES slides(id) ON DELETE CASCADE,
  layer_type    TEXT NOT NULL, -- background, media, overlay, text
  z_index       INTEGER NOT NULL,
  visible       BOOLEAN DEFAULT true,
  opacity       REAL DEFAULT 1.0,

  -- Content based on layer_type
  content       TEXT,          -- text content for text layer
  media_id      TEXT REFERENCES media(id),

  -- Styling (JSON)
  style         TEXT,          -- JSON: position, size, font, colors, etc.
  transition    TEXT,          -- JSON: type, duration, easing

  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_layers_slide ON layers(slide_id);
```

### media

Media library items.

```sql
CREATE TABLE media (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  filepath      TEXT NOT NULL,  -- relative to media folder
  media_type    TEXT NOT NULL,  -- image, video, audio
  mime_type     TEXT,
  file_size     INTEGER,
  duration      INTEGER,        -- seconds for video/audio
  width         INTEGER,        -- pixels for image/video
  height        INTEGER,
  thumbnail     TEXT,           -- thumbnail path
  folder_id     TEXT REFERENCES media_folders(id),
  tags          TEXT,           -- JSON array
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_media_type ON media(media_type);
CREATE INDEX idx_media_folder ON media(folder_id);
```

### media_folders

Organization for media library.

```sql
CREATE TABLE media_folders (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  parent_id     TEXT REFERENCES media_folders(id),
  color         TEXT,           -- folder color for UI
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### themes

Visual themes for slides.

```sql
CREATE TABLE themes (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  is_default    BOOLEAN DEFAULT false,

  -- Background
  background_type   TEXT,       -- solid, gradient, image, video
  background_value  TEXT,       -- color, gradient def, or media_id

  -- Text styling (JSON)
  text_style    TEXT,           -- font, size, color, shadow, etc.

  -- Transitions
  transition_in     TEXT,       -- JSON: type, duration
  transition_out    TEXT,

  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### schedules

Service schedules/rundowns.

```sql
CREATE TABLE schedules (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  date          DATE,
  service_type  TEXT,           -- sunday, midweek, special
  notes         TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedules_date ON schedules(date);
```

### schedule_items

Items within a schedule.

```sql
CREATE TABLE schedule_items (
  id            TEXT PRIMARY KEY,
  schedule_id   TEXT REFERENCES schedules(id) ON DELETE CASCADE,
  order_index   INTEGER NOT NULL,
  item_type     TEXT NOT NULL,  -- song, bible, media, announcement

  -- Reference to content
  song_id       TEXT REFERENCES songs(id),
  media_id      TEXT REFERENCES media(id),

  -- For bible/custom content
  content       TEXT,           -- JSON: book, chapter, verses for bible

  -- Timing
  duration      INTEGER,        -- estimated seconds

  -- Notes
  notes         TEXT,

  -- Override theme for this item
  theme_id      TEXT REFERENCES themes(id),

  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_schedule_items_schedule ON schedule_items(schedule_id);
```

### bibles

Bible translations (metadata).

```sql
CREATE TABLE bibles (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  abbreviation  TEXT NOT NULL,  -- NIV, TB, ESV
  language      TEXT NOT NULL,
  copyright     TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### verses

Bible verses content.

```sql
CREATE TABLE verses (
  id            TEXT PRIMARY KEY,
  bible_id      TEXT REFERENCES bibles(id),
  book          TEXT NOT NULL,
  book_number   INTEGER NOT NULL,
  chapter       INTEGER NOT NULL,
  verse         INTEGER NOT NULL,
  text          TEXT NOT NULL
);

CREATE INDEX idx_verses_lookup ON verses(bible_id, book_number, chapter, verse);
CREATE INDEX idx_verses_search ON verses(text);
```

### settings

Application settings.

```sql
CREATE TABLE settings (
  key           TEXT PRIMARY KEY,
  value         TEXT,           -- JSON value
  updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Sample Data

### Sample Song Insert

```sql
INSERT INTO songs (id, title, author, tags) VALUES (
  'song_001',
  'Amazing Grace',
  'John Newton',
  '["hymn", "grace", "classic"]'
);

INSERT INTO slides (id, song_id, order_index, section_type, section_number, content) VALUES
  ('slide_001', 'song_001', 1, 'verse', 1, 'Amazing grace how sweet the sound\nThat saved a wretch like me'),
  ('slide_002', 'song_001', 2, 'verse', 2, 'I once was lost but now am found\nWas blind but now I see');
```

## Drizzle ORM Schema

```typescript
// src/core/database/schema.ts
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const songs = sqliteTable("songs", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author"),
  copyright: text("copyright"),
  ccliNumber: text("ccli_number"),
  tempo: text("tempo"),
  key: text("key"),
  tags: text("tags"), // JSON
  defaultThemeId: text("default_theme_id"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

export const slides = sqliteTable("slides", {
  id: text("id").primaryKey(),
  songId: text("song_id").references(() => songs.id),
  orderIndex: integer("order_index").notNull(),
  sectionType: text("section_type"),
  sectionNumber: integer("section_number"),
  content: text("content").notNull(),
  notes: text("notes"),
  customThemeId: text("custom_theme_id"),
  createdAt: text("created_at"),
});

// ... more tables
```
