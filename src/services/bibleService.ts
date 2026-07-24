/**
 * Bible Service - Load and parse Bible data from compressed XML
 */

import pako from "pako";
import { BibleVerse, BibleBook, BibleChapter } from "../types/bible";

let bibleCache: BibleData | null = null;

interface BibleData {
  books: Map<number, BibleBook>;
  verses: BibleVerse[];
  booksByCode: Map<string, BibleBook>;
  booksByName: Map<string, BibleBook>;
}

/**
 * Load Bible data from compressed XML
 * Can load from fetch or from provided buffer
 */
export async function loadBibleData(providedBuffer?: ArrayBuffer): Promise<BibleData> {
  if (bibleCache && !providedBuffer) return bibleCache;

  try {
    let buffer: ArrayBuffer;

    if (providedBuffer) {
      // Use provided buffer (from local file)
      buffer = providedBuffer;
    } else {
      // Fetch compressed Bible data from web or file protocol
      const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";
      const candidates = isFileProtocol
        ? ["data/bible.xml.gz", "./data/bible.xml.gz", "/data/bible.xml.gz"]
        : ["/data/bible.xml.gz", "data/bible.xml.gz", "./data/bible.xml.gz"];

      let lastError: unknown = null;
      let fetchedBuffer: ArrayBuffer | null = null;

      for (const url of candidates) {
        try {
          const response = await fetch(url);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
          }
          fetchedBuffer = await response.arrayBuffer();
          break;
        } catch (error) {
          lastError = error;
        }
      }

      if (!fetchedBuffer) {
        throw new Error(
          `Failed to load Bible data from candidates: ${candidates.join(", ")}. ${String(lastError)}`
        );
      }

      buffer = fetchedBuffer;
    }

    // Some environments transparently decompress `.gz` responses before JS sees them.
    // Only ungzip when the payload still has the gzip magic header.
    const decompressed = await normalizeBiblePayload(buffer);
    const xmlString = new TextDecoder().decode(decompressed);

    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlString, "application/xml");

    if (xmlDoc.getElementsByTagName("parsererror").length > 0) {
      throw new Error("Failed to parse Bible XML");
    }

    // Build data structures
    const bibleData: BibleData = {
      books: new Map(),
      verses: [],
      booksByCode: new Map(),
      booksByName: new Map(),
    };

    let verseIndex = 0;
    const bookElements = xmlDoc.querySelectorAll("book");

    bookElements.forEach((bookEl) => {
      const bookId = parseInt(bookEl.getAttribute("id") || "0");
      const bookCode = bookEl.getAttribute("code") || "";
      const bookName = bookEl.getAttribute("name") || "";
      const testament = bookEl.getAttribute("testament") || "";

      const book: BibleBook = {
        id: bookId,
        code: bookCode,
        name: bookName,
        testament: testament as "OT" | "NT",
        chapters: [],
      };

      const chapterElements = bookEl.querySelectorAll("chapter");

      chapterElements.forEach((chapterEl) => {
        const chapterNumber = parseInt(chapterEl.getAttribute("number") || "0");

        const chapter: BibleChapter = {
          number: chapterNumber,
          verses: [],
          sections: new Map(),
        };

        const verseElements = chapterEl.querySelectorAll("verse, section");

        let currentSection = "";
        verseElements.forEach((el) => {
          if (el.tagName === "section") {
            currentSection = el.getAttribute("title") || "";
          } else {
            const verseNumber = parseInt(el.getAttribute("number") || "0");
            const versePart = el.getAttribute("part") || null;
            const text = el.textContent || "";

            const verse: BibleVerse = {
              id: verseIndex++,
              bookId,
              bookCode,
              bookName,
              chapter: chapterNumber,
              verse: verseNumber,
              versePart,
              text,
              section: currentSection,
            };

            chapter.verses.push(verse);
            bibleData.verses.push(verse);

            if (!chapter.sections.has(verseNumber)) {
              chapter.sections.set(verseNumber, currentSection);
            }
          }
        });

        book.chapters.push(chapter);
      });

      bibleData.books.set(bookId, book);
      bibleData.booksByCode.set(bookCode, book);
      bibleData.booksByName.set(bookName, book);
    });

    bibleCache = bibleData;
    console.log(`✓ Loaded ${bibleData.books.size} books, ${bibleData.verses.length} verses`);

    return bibleData;
  } catch (error) {
    console.error("Error loading Bible data:", error);
    throw error;
  }
}

export function clearBibleDataCache(): void {
  bibleCache = null;
}

/**
 * Decompress gzip buffer using pako
 */
async function normalizeBiblePayload(buffer: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    const data = new Uint8Array(buffer);
    if (!isGzipPayload(data)) {
      return sliceToArrayBuffer(data);
    }

    const decompressed = pako.ungzip(data);
    return sliceToArrayBuffer(decompressed);
  } catch (error) {
    console.error("Gzip decompression error:", error);
    throw new Error("Failed to decompress Bible data");
  }
}

function isGzipPayload(data: Uint8Array): boolean {
  return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

function sliceToArrayBuffer(data: Uint8Array): ArrayBuffer {
  return new Uint8Array(data).buffer;
}

/**
 * Get verse by book, chapter, and verse number
 */
export async function getVerse(
  bookCode: string,
  chapter: number,
  verseNumber: number
): Promise<BibleVerse | undefined> {
  const data = await loadBibleData();
  const book = data.booksByCode.get(bookCode);
  if (!book) return undefined;

  const chapterData = book.chapters.find((c) => c.number === chapter);
  if (!chapterData) return undefined;

  return chapterData.verses.find((v) => v.verse === verseNumber);
}

/**
 * Get all verses in a chapter
 */
export async function getChapter(
  bookCode: string,
  chapter: number
): Promise<BibleVerse[]> {
  const data = await loadBibleData();
  const book = data.booksByCode.get(bookCode);
  if (!book) return [];

  const chapterData = book.chapters.find((c) => c.number === chapter);
  return chapterData?.verses || [];
}

/**
 * Get all books
 */
export async function getBooks(): Promise<BibleBook[]> {
  const data = await loadBibleData();
  return Array.from(data.books.values());
}

/**
 * Search verses by keyword
 */
export async function searchVerses(keyword: string): Promise<BibleVerse[]> {
  const data = await loadBibleData();
  const searchTerm = keyword.toLowerCase();

  return data.verses.filter(
    (verse) =>
      verse.text.toLowerCase().includes(searchTerm) ||
      verse.bookName.toLowerCase().includes(searchTerm) ||
      verse.section.toLowerCase().includes(searchTerm)
  );
}
