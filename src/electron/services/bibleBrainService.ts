import pako from 'pako';
import { importLocalBible } from './bibleManager';

const BIBLEBRAIN_BASE_URL = 'https://4.dbt.io/api';
const PAGE_LIMIT = 150;

export interface BibleBrainCountry {
  id: string;
  name: string;
  code: string | null;
  languagesCount: number | null;
  biblesCount: number | null;
}

export interface BibleBrainLanguage {
  id: string;
  iso: string;
  name: string;
  autonym: string | null;
  countryId?: string | null;
  countries?: string[];
  biblesCount: number | null;
  population: number | null;
}

export interface BibleBrainBible {
  id: string;
  abbr: string;
  name: string;
  vname: string | null;
  language: string;
  languageIso: string | null;
  autonym: string | null;
  date: string | null;
  filesetId: string;
  filesetType: string;
  size: string | null;
  copyright: string | null;
  publisher: string | null;
}

export type CloudBible = BibleBrainBible;

const bookPositions: Record<string, number> = {
  GEN: 1, EXO: 2, LEV: 3, NUM: 4, DEU: 5, JOS: 6, JDG: 7, RUT: 8,
  '1SA': 9, '2SA': 10, '1KI': 11, '2KI': 12, '1CH': 13, '2CH': 14,
  EZR: 15, NEH: 16, EST: 17, JOB: 18, PSA: 19, PRO: 20, ECC: 21,
  SNG: 22, ISA: 23, JER: 24, LAM: 25, EZK: 26, DAN: 27, HOS: 28,
  JOL: 29, AMO: 30, OBA: 31, JON: 32, MIC: 33, NAM: 34, HAB: 35,
  ZEP: 36, HAG: 37, ZEC: 38, MAL: 39, MAT: 40, MRK: 41, LUK: 42,
  JHN: 43, ACT: 44, ROM: 45, '1CO': 46, '2CO': 47, GAL: 48, EPH: 49,
  PHP: 50, COL: 51, '1TH': 52, '2TH': 53, '1TI': 54, '2TI': 55,
  TIT: 56, PHM: 57, HEB: 58, JAS: 59, '1PE': 60, '2PE': 61,
  '1JN': 62, '2JN': 63, '3JN': 64, JUD: 65, REV: 66,
};

const textFilesetPriority = ['text_plain', 'text_format', 'text_json', 'text_usx', 'text_html'];

const cache = new Map<string, { expiresAt: number; value: unknown }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function determineTestament(bookCode: string): 'OT' | 'NT' {
  return (bookPositions[bookCode.toUpperCase()] || 999) <= 39 ? 'OT' : 'NT';
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '&':
        return '&amp;';
      case '\'':
        return '&apos;';
      case '"':
        return '&quot;';
      default:
        return c;
    }
  });
}

function sanitizeVersionCode(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 32);
}

function getCached<T>(key: string): T | null {
  const cached = cache.get(key);
  if (!cached || cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return cached.value as T;
}

function setCached<T>(key: string, value: T): T {
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}

function getPaginationTotalPages(json: any, fallback: number): number {
  const meta = json?.meta;
  const pagination = meta?.pagination;
  return Number(pagination?.total_pages || meta?.total_pages || fallback) || fallback;
}

function getDataArray(json: any): any[] {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (json?.data && typeof json.data === 'object') return [json.data];
  if (json && typeof json === 'object') return [json];
  return [];
}

let customBibleBrainApiKey: string | null = null;

export function setCustomBibleBrainApiKey(key: string | null): void {
  customBibleBrainApiKey = key ? key.trim() : null;
}

async function bibleBrainGet(pathname: string, params: Record<string, string | number | undefined> = {}) {
  const url = new URL(`${BIBLEBRAIN_BASE_URL}${pathname}`);
  url.searchParams.set('v', '4');
  const activeKey = customBibleBrainApiKey || process.env.VITE_BIBLEBRAIN_API_KEY || process.env.BIBLEBRAIN_API_KEY;
  if (!activeKey) {
    throw new Error('API Key BibleBrain belum dikonfigurasi. Silakan masukkan API Key di pengaturan Alkitab.');
  }
  url.searchParams.set('key', activeKey);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });

  const res = await fetch(url);
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`BibleBrain returned invalid JSON for ${pathname}`);
  }

  if (!res.ok || json?.error) {
    const message = json?.error?.message || json?.message || `HTTP ${res.status}`;
    throw new Error(`BibleBrain ${pathname} failed: ${message}`);
  }

  return json;
}

async function fetchPaginated(pathname: string, params: Record<string, string | number | undefined> = {}) {
  const items: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const json = await bibleBrainGet(pathname, { ...params, page, limit: PAGE_LIMIT });
    totalPages = getPaginationTotalPages(json, totalPages);
    const pageItems = getDataArray(json);
    items.push(...pageItems);

    if (pageItems.length === 0 || (totalPages === 1 && pageItems.length < PAGE_LIMIT)) break;
    if (totalPages === 1 && pageItems.length >= PAGE_LIMIT) totalPages = page + 1;
    page += 1;
    if (page <= totalPages) await new Promise((resolve) => setTimeout(resolve, 150));
  }

  return items;
}

function flattenFilesets(filesets: any): any[] {
  if (!filesets) return [];
  if (Array.isArray(filesets)) return filesets;
  if (typeof filesets !== 'object') return [];

  const result: any[] = [];
  Object.values(filesets).forEach((value) => {
    if (Array.isArray(value)) result.push(...value);
    else if (value && typeof value === 'object') result.push(value);
  });
  return result;
}

function chooseTextFileset(filesets: any): any | null {
  const textFilesets = flattenFilesets(filesets).filter((fileset) =>
    textFilesetPriority.includes(String(fileset?.type || ''))
  );

  textFilesets.sort((a, b) => {
    const typeRank = textFilesetPriority.indexOf(String(a.type)) - textFilesetPriority.indexOf(String(b.type));
    if (typeRank !== 0) return typeRank;
    const sizeRank = String(b.size || '').localeCompare(String(a.size || ''));
    return sizeRank;
  });

  return textFilesets[0] || null;
}

function mapCountry(item: any): BibleBrainCountry {
  const iso2 = item.codes?.iso_a2 || item.iso_a2 || item.code;
  const iso3 = item.codes?.iso_a3 || item.iso_a3;
  const fallbackId = iso2 || iso3 || item.id || item.country_id || item.name;
  return {
    id: String(fallbackId),
    name: String(item.name ?? item.country ?? item.country_name ?? 'Unknown country'),
    code: iso2 || iso3 || item.iso || item.abbreviation || null,
    languagesCount: Number(item.languages ?? item.language_count ?? item.languages_count) || null,
    biblesCount: Number(item.bibles ?? item.bible_count ?? item.bibles_count) || null,
  };
}

function mapLanguage(item: any): BibleBrainLanguage {
  return {
    id: String(item.id ?? item.language_id ?? item.iso ?? item.name),
    iso: String(item.iso ?? item.language_code ?? item.code ?? '').toLowerCase(),
    name: String(item.name ?? item.language ?? 'Unknown language'),
    autonym: item.autonym || item.name_local || null,
    countryId: item.country_id ? String(item.country_id) : null,
    countries: Array.isArray(item.countries) ? item.countries.map((country: any) => String(country.name || country)) : undefined,
    biblesCount: Number(item.bibles ?? item.bible_count ?? item.bibles_count) || null,
    population: Number(item.population) || null,
  };
}

function mapBible(item: any): BibleBrainBible | null {
  if (!item?.abbr && !item?.id) return null;
  const fileset = chooseTextFileset(item.filesets);
  if (!fileset?.id) return null;

  return {
    id: String(item.id || item.abbr),
    abbr: String(item.abbr || item.id),
    name: String(item.name || item.vname || item.abbr || item.id),
    vname: item.vname || null,
    language: String(item.language || item.language_name || 'Unknown'),
    languageIso: item.iso || item.language_iso || item.language_code || null,
    autonym: item.autonym || null,
    date: item.date || null,
    filesetId: String(fileset.id),
    filesetType: String(fileset.type || 'text_plain'),
    size: fileset.size || null,
    copyright: item.copyright || item.copyright_text || null,
    publisher: item.publisher || null,
  };
}

function uniqueBy<T>(items: T[], keySelector: (item: T) => string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keySelector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getBibleBrainCountries(query = ''): Promise<BibleBrainCountry[]> {
  const cacheKey = `countries:${query.trim().toLowerCase()}`;
  const cached = getCached<BibleBrainCountry[]>(cacheKey);
  if (cached) return cached;

  const countries = (await fetchPaginated('/countries', { include_translations: 'true' }))
    .map(mapCountry)
    .filter((country) => !query || country.name.toLowerCase().includes(query.toLowerCase()));

  countries.sort((a, b) => a.name.localeCompare(b.name));
  return setCached(cacheKey, countries);
}

export async function getBibleBrainLanguages(countryId?: string, query = ''): Promise<BibleBrainLanguage[]> {
  const normalizedCountryId = countryId?.trim();
  const cacheKey = `languages:${normalizedCountryId || 'all'}:${query.trim().toLowerCase()}`;
  const cached = getCached<BibleBrainLanguage[]>(cacheKey);
  if (cached) return cached;

  let rawLanguages: any[] = [];
  if (normalizedCountryId) {
    try {
      const detail = await bibleBrainGet(`/countries/${encodeURIComponent(normalizedCountryId)}`, {
        include_translations: 'true',
      });
      const detailData = getDataArray(detail)[0] || detail?.data || detail;
      if (Array.isArray(detailData?.languages)) rawLanguages = detailData.languages;
      else if (Array.isArray(detailData?.languages_list)) rawLanguages = detailData.languages_list;
    } catch (error) {
      console.warn(`[BibleBrain] Country detail language lookup failed for ${normalizedCountryId}:`, error);
    }
  }

  if (rawLanguages.length === 0) {
    rawLanguages = await fetchPaginated('/languages', { include_translations: 'true' });
  }

  let languages = rawLanguages.map(mapLanguage).filter((language) => language.iso || language.id);

  if (normalizedCountryId && rawLanguages.length > 0) {
    languages = languages.filter((language) => !language.countryId || language.countryId === normalizedCountryId);
  }

  if (query.trim()) {
    const normalizedQuery = query.trim().toLowerCase();
    languages = languages.filter((language) =>
      language.name.toLowerCase().includes(normalizedQuery) ||
      language.iso.toLowerCase().includes(normalizedQuery) ||
      (language.autonym || '').toLowerCase().includes(normalizedQuery)
    );
  }

  languages = uniqueBy(languages, (language) => language.iso || language.id);
  languages.sort((a, b) => a.name.localeCompare(b.name));
  return setCached(cacheKey, languages);
}

export async function getBibleBrainBibles(languageIsoOrId: string, query = ''): Promise<BibleBrainBible[]> {
  const language = languageIsoOrId.trim();
  if (!language) return [];

  const cacheKey = `bibles:${language.toLowerCase()}:${query.trim().toLowerCase()}`;
  const cached = getCached<BibleBrainBible[]>(cacheKey);
  if (cached) return cached;

  let rawBibles: any[] = [];
  try {
    rawBibles = await fetchPaginated('/bibles', { language_code: language.toUpperCase(), include_translations: 'true' });
  } catch (error) {
    console.warn(`[BibleBrain] Bible lookup by language_code failed for ${language}:`, error);
  }

  if (rawBibles.length === 0 && /^\d+$/.test(language)) {
    rawBibles = await fetchPaginated('/bibles', { language_id: language, include_translations: 'true' });
  }

  let bibles = rawBibles.map(mapBible).filter((bible): bible is BibleBrainBible => !!bible);
  if (query.trim()) {
    const normalizedQuery = query.trim().toLowerCase();
    bibles = bibles.filter((bible) =>
      bible.abbr.toLowerCase().includes(normalizedQuery) ||
      bible.name.toLowerCase().includes(normalizedQuery) ||
      (bible.vname || '').toLowerCase().includes(normalizedQuery)
    );
  }

  bibles = uniqueBy(bibles, (bible) => `${bible.abbr}:${bible.filesetId}`);
  bibles.sort((a, b) => (a.vname || a.name).localeCompare(b.vname || b.name));
  return setCached(cacheKey, bibles);
}

export async function getCloudBibles(): Promise<CloudBible[]> {
  return getBibleBrainBibles('IND');
}

export async function searchCloudBibles(query: string): Promise<CloudBible[]> {
  if (!query.trim()) return getCloudBibles();
  const rawResults = await fetchPaginated(`/bibles/search/${encodeURIComponent(query.trim())}`, {
    include_translations: 'true',
  });
  return uniqueBy(
    rawResults.map(mapBible).filter((bible): bible is BibleBrainBible => !!bible),
    (bible) => `${bible.abbr}:${bible.filesetId}`
  );
}

export async function downloadCloudBible(
  abbr: string,
  name: string,
  filesetId: string,
  onProgress?: (percent: number) => void,
  language = 'id'
): Promise<any> {
  const allVerses: any[] = [];
  const books = await getDownloadBookIds(abbr, filesetId);

  for (let index = 0; index < books.length; index += 1) {
    const bookId = books[index];
    const json = await bibleBrainGet(`/download/${encodeURIComponent(filesetId)}/${encodeURIComponent(bookId)}`);
    allVerses.push(...getDataArray(json));
    onProgress?.(Math.min(95, ((index + 1) / books.length) * 95));
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const extractedVerses = allVerses
    .map((v: any) => ({
      bookCode: String(v.book_id || v.book || '').toUpperCase(),
      bookName: String(v.book_name_alt || v.book_name || v.book_title || v.book_id || v.book || ''),
      chapter: Number.parseInt(String(v.chapter || v.chapter_number || v.chapter_start || ''), 10),
      verse: Number.parseInt(String(v.verse_start || v.verse_number || v.verse || ''), 10),
      text: String(v.verse_text || v.text || v.content || '').trim(),
    }))
    .filter((v) => v.bookCode && !Number.isNaN(v.chapter) && !Number.isNaN(v.verse) && v.text);

  if (extractedVerses.length === 0) {
    throw new Error('No valid verses found in downloaded BibleBrain fileset.');
  }

  const xmlString = buildXmlString(extractedVerses);
  const compressed = pako.gzip(new TextEncoder().encode(xmlString));
  const buffer = compressed.buffer.slice(compressed.byteOffset, compressed.byteOffset + compressed.byteLength);
  const versionCode = sanitizeVersionCode(abbr || filesetId);

  onProgress?.(98);
  const version = await importLocalBible(versionCode, name, buffer, language);
  onProgress?.(100);
  return version;
}

async function getDownloadBookIds(abbr: string, filesetId: string): Promise<string[]> {
  try {
    const json = await bibleBrainGet(`/bibles/${encodeURIComponent(abbr)}/book`);
    const books = getDataArray(json)
      .map((book: any) => String(book.book_id || book.id || '').toUpperCase())
      .filter(Boolean);
    if (books.length > 0) return books;
  } catch (error) {
    console.warn(`[BibleBrain] Failed to load book list for ${abbr}; falling back to canonical list:`, error);
  }

  const isNewTestamentFileset = /N[_A-Z0-9]*(?:ET|NT)?$/i.test(filesetId) && !/O[_A-Z0-9]*(?:ET|OT)?$/i.test(filesetId);
  const isOldTestamentFileset = /O[_A-Z0-9]*(?:ET|OT)?$/i.test(filesetId);
  return Object.entries(bookPositions)
    .filter(([, position]) => {
      if (isNewTestamentFileset) return position >= 40;
      if (isOldTestamentFileset) return position <= 39;
      return true;
    })
    .sort((a, b) => a[1] - b[1])
    .map(([bookId]) => bookId);
}

function buildXmlString(verses: Array<{ bookCode: string; bookName: string; chapter: number; verse: number; text: string }>): string {
  const booksMap = new Map<string, { name: string; chapters: Map<number, typeof verses> }>();

  for (const verse of verses) {
    if (!booksMap.has(verse.bookCode)) {
      booksMap.set(verse.bookCode, { name: verse.bookName, chapters: new Map() });
    }
    const book = booksMap.get(verse.bookCode)!;
    if (!book.chapters.has(verse.chapter)) book.chapters.set(verse.chapter, []);
    book.chapters.get(verse.chapter)!.push(verse);
  }

  const sortedBookCodes = Array.from(booksMap.keys()).sort((a, b) => {
    const posA = bookPositions[a] || 999;
    const posB = bookPositions[b] || 999;
    return posA - posB || a.localeCompare(b);
  });

  let xml = '<?xml version="1.0" encoding="utf-8"?>\n<bible>\n';

  for (const bookCode of sortedBookCodes) {
    const book = booksMap.get(bookCode)!;
    const bookId = bookPositions[bookCode] || 999;
    const testament = determineTestament(bookCode);

    xml += `  <book id="${bookId}" code="${bookCode}" name="${escapeXml(book.name)}" testament="${testament}">\n`;

    const sortedChapters = Array.from(book.chapters.keys()).sort((a, b) => a - b);
    for (const chapterNumber of sortedChapters) {
      xml += `    <chapter number="${chapterNumber}">\n`;
      const chapterVerses = book.chapters.get(chapterNumber)!.sort((a, b) => a.verse - b.verse);
      for (const verse of chapterVerses) {
        xml += `      <verse number="${verse.verse}">${escapeXml(verse.text)}</verse>\n`;
      }
      xml += '    </chapter>\n';
    }

    xml += '  </book>\n';
  }

  xml += '</bible>';
  return xml;
}
