# RAMEDIA Song System - Ultra Concept

## Overview

The Song System is the heart of RAMEDIA - optimized for **fast input** and **beautiful output**.

## Two Input Modes

### 🚀 Easy Mode (Quick Input)

Untuk input cepat - ketik/paste lirik, gunakan markers untuk auto-split.

```
[VERSE 1]
Amazing grace how sweet the sound
That saved a wretch like me

[VERSE 2]
I once was lost but now am found
Was blind but now I see

[CHORUS]
Grace, grace, God's grace
Grace that will pardon and cleanse within
```

**Markers yang didukung:**

- `[VERSE]`, `[VERSE 1]`, `[V1]`
- `[CHORUS]`, `[REFF]`, `[C]`
- `[BRIDGE]`, `[B]`
- `[INTRO]`, `[OUTRO]`
- Double enter (blank line) = new slide

**Auto-styling:** Setiap section type otomatis pakai styling default dari Theme.

---

### 🎨 Advanced Mode (Slide Editor)

Visual editor per-slide dengan kontrol penuh per-layer.

```
┌────────────────────────────────────────────────────────────┐
│  SLIDE EDITOR                                          [X] │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────┐  ┌──────────────────┐│
│  │                                 │  │ LAYERS           ││
│  │       PREVIEW CANVAS            │  │ ☑️ Text         ││
│  │       (WYSIWYG)                 │  │ ☑️ Overlay      ││
│  │                                 │  │ ☑️ Media        ││
│  │     "Amazing Grace"             │  │ ☑️ Background   ││
│  │                                 │  │ ☑️ Base         ││
│  │                                 │  ├──────────────────┤│
│  └─────────────────────────────────┘  │ PROPERTIES       ││
│                                       │ Font: Inter      ││
│  ┌─────────────────────────────────┐  │ Size: 72px       ││
│  │ SLIDES                          │  │ Color: #FFFFFF   ││
│  │ [V1] [V2] [C] [V3] [C] [+]     │  │ Position: Center ││
│  └─────────────────────────────────┘  └──────────────────┘│
└────────────────────────────────────────────────────────────┘
```

---

## 5-Layer System (Per Slide)

Setiap slide memiliki **5 layer tetap** yang bisa dikustomisasi:

| Layer | Name       | Z-Index | Contents                              |
| ----- | ---------- | ------- | ------------------------------------- |
| 5     | Text       | 500     | Lirik utama, label verse              |
| 4     | Overlay    | 400     | Logo, lower third, watermark          |
| 3     | Media      | 300     | Gambar/video foreground               |
| 2     | Background | 200     | Background image/video/gradient       |
| 1     | Base       | 100     | Solid color fallback (always #000000) |

### Layer Properties

```typescript
interface SlideLayer {
  id: string;
  type: "text" | "overlay" | "media" | "background" | "base";
  visible: boolean;
  opacity: number; // 0-1

  // Content
  content?: string; // text content or color
  mediaId?: string; // reference to media library

  // Styling
  style: {
    // Position & Size
    x?: number; // % from left
    y?: number; // % from top
    width?: number; // % of canvas
    height?: number;

    // Text specific
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: number;
    color?: string;
    textAlign?: "left" | "center" | "right";
    textShadow?: string;
    lineHeight?: number;

    // Background specific
    backgroundType?: "solid" | "gradient" | "image" | "video";
    backgroundValue?: string;
  };

  // Transitions
  transition?: {
    type: "fade" | "slide" | "zoom";
    duration: number;
    easing: string;
  };
}
```

---

## Database Schema Extension

```sql
-- Add to existing slides table
ALTER TABLE slides ADD COLUMN raw_text TEXT;  -- Original Easy Mode input

-- layers table already exists, but extended:
CREATE TABLE slide_layers (
  id            TEXT PRIMARY KEY,
  slide_id      TEXT NOT NULL REFERENCES slides(id) ON DELETE CASCADE,
  layer_type    TEXT NOT NULL,  -- text, overlay, media, background, base
  layer_order   INTEGER NOT NULL, -- 1-5
  visible       BOOLEAN DEFAULT true,
  opacity       REAL DEFAULT 1.0,
  content       TEXT,
  media_id      TEXT REFERENCES media(id),
  style         TEXT,           -- JSON
  transition    TEXT,           -- JSON
  UNIQUE(slide_id, layer_order)
);
```

---

## UI Flow

### Creating New Song

```
1. Click [+ New Song] in Library
   ↓
2. Modal opens with tabs: [Easy] [Advanced]
   ↓
3a. EASY: Paste lirik → Auto-parse → Preview slides
3b. ADVANCED: Add slides manually → Edit layers
   ↓
4. Set metadata (title, author, key, tags)
   ↓
5. Save → Appears in Library
```

### Editing Existing Song

```
1. Double-click song in Library
   ↓
2. Opens in last-used mode (Easy/Advanced)
   ↓
3. Switch modes anytime (data preserved)
   ↓
4. Save changes
```

---

## Implementation Phases

### Phase 1: Easy Mode Editor

- [ ] Song input modal with text area
- [ ] Parser for markers `[VERSE]`, `[CHORUS]`, etc.
- [ ] Auto-generate slides from parsed sections
- [ ] Preview slide list

### Phase 2: Database Integration

- [ ] SQLite setup with Drizzle ORM
- [ ] CRUD operations for songs/slides
- [ ] Library loads from database

### Phase 3: Advanced Mode Editor

- [ ] Slide canvas with layer rendering
- [ ] Layer panel (visibility, opacity, order)
- [ ] Property panel (per-layer styling)
- [ ] WYSIWYG text editing

### Phase 4: Layer System

- [ ] 5-layer rendering in Output window
- [ ] Layer transitions
- [ ] Real-time sync Controller ↔ Output

---

## Technical Notes

### Parser Logic (Easy Mode)

```typescript
function parseLyrics(text: string): ParsedSlide[] {
  const sections = text.split(/\n\n+/); // Split by blank lines

  return sections.map((section) => {
    const match = section.match(
      /^\[(VERSE|CHORUS|BRIDGE|INTRO|OUTRO)\s*(\d*)\]/i,
    );

    return {
      type: match ? match[1].toLowerCase() : "verse",
      number: match ? parseInt(match[2]) || null : null,
      content: section.replace(/^\[.*?\]\s*\n?/, "").trim(),
    };
  });
}
```

### Layer Rendering Priority

Output Window renders layers bottom-to-top:

1. Base (always visible, fallback)
2. Background (image/video/gradient)
3. Media (foreground content)
4. Overlay (persistent graphics)
5. Text (dynamic content - lyrics/scripture)
