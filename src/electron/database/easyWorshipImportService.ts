import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { songService } from './songService';
import type { Song } from './schema';

export interface EasyWorshipImportResult {
  folderPath: string;
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  errors: Array<{ title: string; reason: string }>;
}

export interface EasyWorshipSongPreview {
  sourceId: number;
  title: string;
  author: string | null;
  copyright: string | null;
  ccliNumber: string | null;
  slideCount: number;
  alreadyExists: boolean;
}

export interface EasyWorshipScanResult {
  folderPath: string;
  total: number;
  songs: EasyWorshipSongPreview[];
}

interface EasyWorshipSongRow {
  rowid: number;
  title: string;
  author: string | null;
  copyright: string | null;
  reference_number: string | null;
  tags: string | null;
}

interface EasyWorshipWordRow {
  words: string | null;
}

interface RtfParagraph {
  text: string;
  isSlideMarker: boolean;
  isHidden: boolean;
}

function assertEasyWorshipFolder(folderPath: string) {
  const songsPath = path.join(folderPath, 'Songs.db');
  const wordsPath = path.join(folderPath, 'SongWords.db');

  if (!fs.existsSync(songsPath) || !fs.existsSync(wordsPath)) {
    throw new Error('Folder EasyWorship harus berisi Songs.db dan SongWords.db.');
  }

  return { songsPath, wordsPath };
}

function normalizeDuplicateKey(song: Pick<Song, 'title' | 'author'>) {
  return `${song.title || ''}::${song.author || ''}`.trim().toLowerCase();
}

function decodeRtfEscapes(input: string) {
  return input
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, value) => {
      const code = parseInt(value, 10);
      return String.fromCharCode(code < 0 ? code + 65536 : code);
    })
    .replace(/\\([{}\\])/g, '$1');
}

function stripDestinationGroups(input: string) {
  let output = '';
  let i = 0;
  let skipDepth = 0;

  while (i < input.length) {
    if (input[i] === '{') {
      const rest = input.slice(i + 1);
      const isDestination =
        /^\\(?:fonttbl|colortbl|stylesheet|info)\b/.test(rest) ||
        /^\\\*/.test(rest);

      if (isDestination) {
        skipDepth = 1;
        i += 1;
        continue;
      }

      if (skipDepth > 0) skipDepth += 1;
      if (skipDepth === 0) output += input[i];
      i += 1;
      continue;
    }

    if (input[i] === '}') {
      if (skipDepth > 0) {
        skipDepth -= 1;
      } else {
        output += input[i];
      }
      i += 1;
      continue;
    }

    if (skipDepth === 0) output += input[i];
    i += 1;
  }

  return output;
}

function cleanRtfText(segment: string) {
  const decoded = decodeRtfEscapes(segment);

  return decoded
    .replace(/\\[a-zA-Z*]+-?\d* ?/g, '')
    .replace(/\\[^a-zA-Z\s]/g, '')
    .replace(/[{}]/g, '')
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractRtfParagraphs(rtf: string): RtfParagraph[] {
  const body = stripDestinationGroups(rtf);

  return body
    .split(/\\par\b ?/)
    .map((segment) => ({
      text: cleanRtfText(segment),
      isSlideMarker: segment.includes('\\sdslidemarker'),
      isHidden: segment.includes('\\sdparawysiwghidden'),
    }))
    .filter((paragraph, index, list) => (
      paragraph.text ||
      paragraph.isSlideMarker ||
      (index > 0 && index < list.length - 1)
    ));
}

function parseSectionLabel(text: string) {
  const match = text.trim().match(/^(verse|v|chorus|c|reff?|refrain|pre[-\s]?chorus|bridge|b|intro|outro|ending|tag)\s*(\d+)?\s*:?$/i);
  if (!match) return null;

  const rawType = match[1].toLowerCase().replace(/\s+/g, '-');
  const number = match[2] || '';
  let label = rawType;

  if (rawType === 'v') label = 'verse';
  if (rawType === 'c' || rawType === 'ref' || rawType === 'reff' || rawType === 'refrain') label = 'chorus';
  if (rawType === 'b') label = 'bridge';
  if (rawType === 'prechorus') label = 'pre-chorus';
  if (rawType === 'ending') label = 'outro';

  return `[${label.toUpperCase()}${number ? ` ${number}` : ''}]`;
}

function paragraphsToRawLyrics(paragraphs: RtfParagraph[]) {
  const sections: Array<{ label: string | null; lines: string[] }> = [];
  let currentLines: string[] = [];
  let pendingLabel: string | null = null;

  const pushCurrent = () => {
    if (currentLines.length === 0) return;
    sections.push({ label: pendingLabel, lines: currentLines });
    currentLines = [];
    pendingLabel = null;
  };

  for (const paragraph of paragraphs) {
    if (paragraph.isSlideMarker) {
      pushCurrent();
      continue;
    }

    if (!paragraph.text) {
      pushCurrent();
      continue;
    }

    const sectionLabel = parseSectionLabel(paragraph.text);
    if ((paragraph.isHidden || currentLines.length === 0) && sectionLabel) {
      if (currentLines.length > 0) pushCurrent();
      pendingLabel = sectionLabel;
      continue;
    }

    currentLines.push(paragraph.text);
  }

  pushCurrent();

  return sections
    .map((section) => [section.label, section.lines.join('\n')].filter(Boolean).join('\n'))
    .join('\n\n')
    .trim();
}

function convertEasyWorshipRtfToLyrics(rtf: string | null) {
  if (!rtf) return '';
  return paragraphsToRawLyrics(extractRtfParagraphs(rtf));
}

function countSlides(rawLyrics: string) {
  return rawLyrics.split(/\n\n+/).filter((section) => section.trim()).length;
}

function parseEasyWorshipTags(tags: string | null) {
  const values = ['EasyWorship'];
  if (tags) {
    values.push(
      ...tags
        .split(/[;,]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    );
  }
  return JSON.stringify(Array.from(new Set(values)));
}

export const easyWorshipImportService = {
  scanFolder(folderPath: string): EasyWorshipScanResult {
    const { songsPath, wordsPath } = assertEasyWorshipFolder(folderPath);
    const songsDb = new Database(songsPath, { readonly: true, fileMustExist: true });
    const wordsDb = new Database(wordsPath, { readonly: true, fileMustExist: true });

    try {
      const rows = songsDb.prepare(`
        SELECT rowid, title, author, copyright, reference_number, tags
        FROM song
        ORDER BY title COLLATE NOCASE
      `).all() as EasyWorshipSongRow[];
      const existingKeys = new Set(songService.getAll().map(normalizeDuplicateKey));
      const wordStatement = wordsDb.prepare('SELECT words FROM word WHERE song_id = ?');

      const songs = rows.map((row) => {
        const title = (row.title || '').trim();
        const author = row.author?.trim() || null;
        const word = wordStatement.get(row.rowid) as EasyWorshipWordRow | undefined;
        const rawLyrics = convertEasyWorshipRtfToLyrics(word?.words || '');

        return {
          sourceId: row.rowid,
          title,
          author,
          copyright: row.copyright || null,
          ccliNumber: row.reference_number || null,
          slideCount: countSlides(rawLyrics),
          alreadyExists: existingKeys.has(normalizeDuplicateKey({ title, author })),
        };
      }).filter((song) => song.title);

      return {
        folderPath,
        total: rows.length,
        songs,
      };
    } finally {
      songsDb.close();
      wordsDb.close();
    }
  },

  importFromFolder(folderPath: string, sourceIds?: number[]): EasyWorshipImportResult {
    const { songsPath, wordsPath } = assertEasyWorshipFolder(folderPath);
    const selectedIds = Array.isArray(sourceIds) ? new Set(sourceIds) : null;
    const songsDb = new Database(songsPath, { readonly: true, fileMustExist: true });
    const wordsDb = new Database(wordsPath, { readonly: true, fileMustExist: true });
    const result: EasyWorshipImportResult = {
      folderPath,
      imported: 0,
      skipped: 0,
      failed: 0,
      total: 0,
      errors: [],
    };

    try {
      const rows = songsDb.prepare(`
        SELECT rowid, title, author, copyright, reference_number, tags
        FROM song
        ORDER BY title COLLATE NOCASE
      `).all() as EasyWorshipSongRow[];
      const importRows = selectedIds ? rows.filter((row) => selectedIds.has(row.rowid)) : rows;
      const existingKeys = new Set(songService.getAll().map(normalizeDuplicateKey));
      const wordStatement = wordsDb.prepare('SELECT words FROM word WHERE song_id = ?');

      result.total = importRows.length;

      for (const row of importRows) {
        const title = (row.title || '').trim();
        if (!title) {
          result.skipped += 1;
          continue;
        }

        const duplicateKey = normalizeDuplicateKey({ title, author: row.author?.trim() || null });
        if (existingKeys.has(duplicateKey)) {
          result.skipped += 1;
          continue;
        }

        try {
          const word = wordStatement.get(row.rowid) as EasyWorshipWordRow | undefined;
          const rawLyrics = convertEasyWorshipRtfToLyrics(word?.words || '');

          if (!rawLyrics) {
            result.skipped += 1;
            continue;
          }

          const songId = songService.createFromLyrics(title, rawLyrics, row.author?.trim() || undefined);
          songService.update(songId, {
            copyright: row.copyright || null,
            ccliNumber: row.reference_number || null,
            tags: parseEasyWorshipTags(row.tags),
          });
          existingKeys.add(duplicateKey);
          result.imported += 1;
        } catch (error) {
          result.failed += 1;
          result.errors.push({
            title,
            reason: error instanceof Error ? error.message : 'Unknown import error',
          });
        }
      }

      return result;
    } finally {
      songsDb.close();
      wordsDb.close();
    }
  },

  deleteImported(): { deleted: number } {
    const importedSongs = songService.getAll().filter((song) => {
      if (!song.tags) return false;
      return song.tags.includes('EasyWorship');
    });

    for (const song of importedSongs) {
      songService.delete(song.id);
    }

    return { deleted: importedSongs.length };
  },
};

export default easyWorshipImportService;
