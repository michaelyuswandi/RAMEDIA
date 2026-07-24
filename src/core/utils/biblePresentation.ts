import type { BibleBook, BibleVerse } from '../../types/bible';

export interface BibleVerseContent {
  verse: number;
  text: string;
  section?: string;
}

export interface BibleContentPayload {
  reference?: string;
  text?: string;
  verseStart?: number;
  verseEnd?: number | null;
  versionCode?: string;
  verses?: BibleVerseContent[];
  splitMode?: 'auto' | 'fixed' | 'per-verse';
  slideCount?: number | null;
  contentThemeId?: string | null;
  contentThemeName?: string | null;
  contentThemeLayersData?: string | null;
  style?: BiblePresentationStyle;
}

export interface BiblePresentationStyle {
  layoutMode?: 'fullscreen' | 'lower-third';
  backgroundMode?: 'solid' | 'media';
  backgroundColor?: string;
  backgroundMediaId?: string | null;
  backgroundMediaPath?: string | null;
  backgroundMediaType?: 'image' | 'video' | null;
  overlayOpacity?: number;
  textAlign?: 'left' | 'center';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  showReference?: boolean;
  showVerseNumbers?: boolean;
  showVersionCode?: boolean;
  referencePosition?: 'top' | 'bottom';
  referenceAlign?: 'left' | 'center' | 'right';
  showSectionTitle?: boolean;
  sectionDisplay?: 'inline' | 'slide';
  textColor?: string;
  referenceColor?: string;
  versionColor?: string;
  sectionColor?: string;
  fontFamily?: string;
  textScale?: number;
  referenceScale?: number;
  referenceX?: number | null;
  referenceY?: number | null;
  autoResizeMode?: 'off' | 'full' | 'narrow';
  maxVersesPerSlide?: number | null;
  contentX?: number;
  contentY?: number;
  contentWidth?: number;
  contentHeight?: number;
}

export interface ParsedBibleReference {
  book: BibleBook;
  chapter: number;
  verseStart: number;
  verseEnd: number | null;
  normalizedReference: string;
}

export interface BibleReferenceParseResult {
  status: 'empty' | 'partial' | 'invalid' | 'success';
  parsed?: ParsedBibleReference;
  reason?: string;
}

const BOOK_ALIASES: Record<string, string[]> = {
  kejadian: ['kej', 'gen'],
  keluaran: ['kel', 'exo'],
  imamat: ['ima', 'lev'],
  bilangan: ['bil', 'num'],
  ulangan: ['ula', 'deu'],
  yosua: ['yos', 'jos'],
  'hakimhakim': ['hak', 'jdg'],
  mazmur: ['maz', 'mzm', 'ps', 'psa'],
  amsal: ['ams', 'pro', 'prv'],
  pengkhotbah: ['pkh', 'ecc'],
  'kidungagung': ['kid', 'kidag', 'sng'],
  yesaya: ['yes', 'isa'],
  yeremia: ['yer', 'jer'],
  ratapan: ['rat', 'lam'],
  yehezkiel: ['yeh', 'ezk'],
  zefanya: ['zef', 'zep'],
  zakharia: ['zak', 'zec'],
  maleakhi: ['mal', 'mlk'],
  matius: ['mat', 'mt'],
  markus: ['mrk', 'mk'],
  lukas: ['luk', 'lk'],
  yohanes: ['yoh', 'joh', 'jhn'],
  'kisahpararasul': ['kis', 'act'],
  roma: ['rom', 'rm'],
  korintus: ['kor', 'co'],
  tesalonika: ['tes', 'th'],
  timotius: ['tim', 'ti'],
  petrus: ['ptr', 'pet', 'pe'],
  wahyu: ['why', 'wah', 'rev'],
};

export function normalizeBibleToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function getBookLookupTokens(book: BibleBook): string[] {
  const normalizedName = normalizeBibleToken(book.name);
  const normalizedCode = normalizeBibleToken(book.code);
  const aliasSource = Object.entries(BOOK_ALIASES).find(([key]) => normalizedName.includes(key))?.[1] || [];

  return Array.from(new Set([normalizedName, normalizedCode, ...aliasSource.map(normalizeBibleToken)]));
}

function resolveBibleBook(token: string, books: BibleBook[]): BibleBook | null {
  const normalizedToken = normalizeBibleToken(token);
  if (!normalizedToken) return null;

  const exactMatch = books.find((book) =>
    getBookLookupTokens(book).some((candidate) => candidate === normalizedToken)
  );
  if (exactMatch) return exactMatch;

  const prefixMatch = books.find((book) =>
    getBookLookupTokens(book).some(
      (candidate) =>
        candidate.startsWith(normalizedToken) || normalizedToken.startsWith(candidate)
    )
  );

  return prefixMatch || null;
}

export function buildBibleReferenceLabel(
  bookName: string,
  chapter: number,
  verseStart: number,
  verseEnd?: number | null
): string {
  const normalizedEnd = verseEnd && verseEnd > verseStart ? verseEnd : null;
  return `${bookName} ${chapter}:${verseStart}${normalizedEnd ? `-${normalizedEnd}` : ''}`;
}

export function formatBibleVerseLines(verses: BibleVerseContent[]): string {
  return verses.map((item) => `${item.verse} ${item.text}`).join('\n');
}

export function parseBibleReferenceInput(
  input: string,
  books: BibleBook[]
): BibleReferenceParseResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { status: 'empty' };
  }

  if (!/\d/.test(trimmed) || /[:\-]\s*$/.test(trimmed)) {
    return { status: 'partial' };
  }

  const match = trimmed.match(/^(.+?)\s+(\d+)(?::(\d+)(?:\s*-\s*(\d+))?)?$/i);
  if (!match) {
    return { status: 'invalid', reason: 'Format referensi belum dikenali.' };
  }

  const [, rawBook, rawChapter, rawVerseStart, rawVerseEnd] = match;
  const book = resolveBibleBook(rawBook, books);
  if (!book) {
    return { status: 'invalid', reason: 'Kitab tidak ditemukan.' };
  }

  const chapter = Number(rawChapter);
  const chapterData = book.chapters.find((item) => item.number === chapter);
  if (!chapterData) {
    return { status: 'invalid', reason: 'Pasal tidak tersedia.' };
  }

  const verseStart = rawVerseStart ? Number(rawVerseStart) : 1;
  const chapterVerseNumbers = chapterData.verses.map((item) => item.verse);
  const maxVerse = chapterVerseNumbers[chapterVerseNumbers.length - 1] || 1;
  const verseEnd = rawVerseEnd ? Number(rawVerseEnd) : rawVerseStart ? null : maxVerse;

  if (verseStart < 1 || verseStart > maxVerse) {
    return { status: 'invalid', reason: 'Ayat awal di luar jangkauan pasal.' };
  }

  if (verseEnd != null && (verseEnd < verseStart || verseEnd > maxVerse)) {
    return { status: 'invalid', reason: 'Ayat akhir di luar jangkauan pasal.' };
  }

  return {
    status: 'success',
    parsed: {
      book,
      chapter,
      verseStart,
      verseEnd,
      normalizedReference: buildBibleReferenceLabel(book.name, chapter, verseStart, verseEnd),
    },
  };
}

export function getBibleVersesInRange(
  chapterVerses: BibleVerse[],
  verseStart: number,
  verseEnd?: number | null
): BibleVerse[] {
  const normalizedEnd = verseEnd != null && verseEnd >= verseStart ? verseEnd : verseStart;
  return chapterVerses.filter((item) => item.verse >= verseStart && item.verse <= normalizedEnd);
}
