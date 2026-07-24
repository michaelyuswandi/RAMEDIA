# 📖 Bible Module Documentation

## Overview
Bible Module adalah komponen untuk menampilkan ayat alkitab di RAMEDIA. Data disimpan dalam format XML terkompresi untuk efisiensi ukuran dan kecepatan loading, lalu direferensikan oleh schedule dan slide sebagai metadata ringan.

Bible module sekarang dipakai di tiga jalur utama:
- **Schedule**: item rundown bertipe `bible` menyimpan referensi pasal/ayat dan dapat langsung go-live.
- **Slide editor**: elemen slide bertipe Bible bisa memakai referensi ayat yang sama untuk custom slide.
- **Library**: ayat dapat dipilih ulang dari picker untuk dipakai di banyak tempat tanpa duplikasi data.

## Architecture

### Data Storage
- **Database**: `docs/bible.db` (SQLite)
- **Compressed Format**: `public/data/bible.xml.gz`
  - Size: ~1.37 MB (compressed dari 5.64 MB)
  - Compression ratio: 75.7% reduction
  - Format: Gzip-compressed XML

### Hybrid Storage Model
- **`rumedia.db`** menyimpan metadata Bible yang dipakai aplikasi: versi, schedule item, dan slide element.
- **Local file cache** menyimpan file Bible terkompresi yang di-download user di `~/.RAMEDIA/bibles/`.
- **XML terkompresi** tetap menjadi sumber data utama untuk isi ayat, supaya file inti tetap kecil dan mudah didistribusikan.

### Data Structure
Database contains:
- **66 kitab** (books) - Kejadian, Keluaran, dll
- **1189 pasal** (chapters)
- **31,172 ayat** (verses)
- **2,274 judul** (section titles)

### XML Format
```xml
<?xml version="1.0" encoding="UTF-8"?>
<bible>
  <book id="1" code="GEN" name="Kejadian" testament="OT">
    <chapter number="1">
      <section title="Allah menciptakan langit dan bumi" />
      <verse number="1">Pada mulanya Allah menciptakan langit dan bumi.</verse>
      <verse number="2">Bumi belum berbentuk dan kosong...</verse>
    </chapter>
  </book>
</bible>
```

## Files Structure

```
src/
├── services/
│   └── bibleService.ts          # Main service for loading & querying Bible data
├── hooks/
│   └── useBible.ts              # React hook wrapper
├── types/
│   └── bible.ts                 # TypeScript interfaces
├── components/
│   └── BibleModule.tsx          # UI component (full-featured example)

scripts/
└── extract-bible.ts             # Script to extract & compress Bible data from DB

public/data/
└── bible.xml.gz                 # Compressed Bible data file
```

## Usage

### 1. Loading Bible Data
```typescript
import { useBible } from '../hooks/useBible';

function MyComponent() {
  const { isLoading, error, books, getVerse, getChapter, searchVerses } = useBible();
  
  // Use the data...
}
```

### 2. Get Specific Verse
```typescript
// Get Genesis 1:1
const verse = await getVerse('GEN', 1, 1);
console.log(verse.text); // "Pada mulanya Allah menciptakan langit dan bumi."
```

### 3. Get Entire Chapter
```typescript
// Get all verses in Genesis 1
const verses = await getChapter('GEN', 1);
verses.forEach(v => console.log(`${v.verse}: ${v.text}`));
```

### 4. Search Verses
```typescript
// Search for specific keyword
const results = await searchVerses('cinta');
// Returns all verses containing "cinta" with metadata
```

### 5. Display All Books
```typescript
const books = await getBooks();
books.forEach(book => {
  console.log(`${book.name} - ${book.chapters.length} chapters`);
});
```

## Service API

### `loadBibleData(): Promise<BibleData>`
Load and cache Bible data from compressed XML file.

### `getVerse(bookCode: string, chapter: number, verseNumber: number): Promise<BibleVerse>`
Get a specific verse with full metadata.

### `getChapter(bookCode: string, chapter: number): Promise<BibleVerse[]>`
Get all verses in a chapter.

### `getBooks(): Promise<BibleBook[]>`
Get list of all books with their chapters.

### `searchVerses(keyword: string): Promise<BibleVerse[]>`
Search verses by keyword in text, book name, or section title.

## Data Types

### BibleVerse
```typescript
interface BibleVerse {
  id: number;
  bookId: number;
  bookCode: string;       // e.g., "GEN", "MAT"
  bookName: string;       // e.g., "Kejadian", "Matius"
  chapter: number;
  verse: number;
  versePart: string | null;
  text: string;
  section: string;        // Section title for this verse
}
```

### BibleBook
```typescript
interface BibleBook {
  id: number;
  code: string;           // Unique book code
  name: string;
  testament: "OT" | "NT";
  chapters: BibleChapter[];
}
```

### BibleChapter
```typescript
interface BibleChapter {
  number: number;
  verses: BibleVerse[];
  sections: Map<number, string>;  // Verse number -> section title
}
```

## Re-extracting Data

If Bible data changes or you need to update `bible.xml.gz`:

```bash
npm run extract-bible
```

This will:
1. Read from `docs/bible.db`
2. Create temporary XML file
3. Compress with gzip
4. Output to `public/data/bible.xml.gz`
5. Clean up temporary files

## Download and Import Flow

When a Bible translation is downloaded:
1. App fetches the remote `.xml.gz` file.
2. File is verified with an MD5 hash.
3. File is stored locally in `~/.RAMEDIA/bibles/`.
4. Metadata is stored in `bible_versions` inside `rumedia.db`.
5. The active translation can be switched without redownloading content.

This means Bible data is downloadable, cacheable, and reusable for schedule items and custom slide elements.

## Schedule Integration

Bible rundown items store:
- translation ID
- book code
- chapter number
- verse range
- optional cached JSON text for preview and quick rendering

This keeps schedule data small while still allowing direct rendering during presentation.

## Slide Integration

Bible slide elements store:
- translation ID
- book code
- chapter number
- verse range
- styling and layout metadata

The actual verse content is resolved from the Bible service when the slide is rendered.

## Performance

- **First Load**: ~500ms (download & decompress 1.37 MB)
- **Subsequent Loads**: Instant (cached in memory)
- **Search**: ~10ms for full-text search across 31k verses
- **Memory Usage**: ~8-10 MB when fully loaded

## Browser Support

- ✅ Chrome/Edge 90+
- ✅ Firefox 87+
- ✅ Safari 15+
- ✅ Electron 28+

## Future Enhancements

- [ ] Multiple Bible translations
- [ ] Audio pronunciation
- [ ] Cross-references
- [ ] Bookmarks & notes
- [ ] Offline sync
- [ ] Translation selection in UI
- [ ] Import Bible from remote server / file picker
- [ ] Compare verses across translations

## Dependencies

- `pako` - Gzip compression/decompression
- `better-sqlite3` - Database (for extraction script)
- React 18+ (for component & hooks)

## Troubleshooting

### "Failed to decompress Bible data"
- Ensure `public/data/bible.xml.gz` exists
- Run `npm run extract-bible` to regenerate

### Service not found error
- Make sure `src/services/bibleService.ts` is created
- Check import paths

### High memory usage
- Reduce service caching by clearing `bibleCache` periodically
- Implement pagination for search results

## Notes

- Bible data is read-only (no editing capability in current version)
- Decompression happens client-side for faster access
- Search is case-insensitive and partial matches
- Sections (titles) are preserved from original database
