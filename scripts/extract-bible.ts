import Database from "better-sqlite3";
import * as fs from "fs";
import * as path from "path";
import * as zlib from "zlib";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, "../docs/bible.db");
const OUTPUT_DIR = path.join(__dirname, "../public/data");
const XML_OUTPUT = path.join(OUTPUT_DIR, "bible.xml");
const COMPRESSED_OUTPUT = path.join(OUTPUT_DIR, "bible.xml.gz");

interface Book {
  id: number;
  code: string;
  name: string;
  testament: string;
  position: number;
}

interface Chapter {
  id: number;
  number: number;
}

interface Verse {
  id: number;
  verse_number: number;
  text: string;
  verse_part: string | null;
}

interface Section {
  id: number;
  start_verse: number;
  end_verse: number | null;
  title: string;
}

async function extractBible() {
  console.log("📖 Starting Bible extraction...");

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    const db = new Database(DB_PATH, { readonly: true });

    // Get all books
    const books = db
      .prepare("SELECT id, code, name, testament, position FROM books ORDER BY position")
      .all() as Book[];

    console.log(`✓ Found ${books.length} books`);

    let xmlContent = '<?xml version="1.0" encoding="UTF-8"?>\n<bible>\n';

    // Process each book
    for (const book of books) {
      xmlContent += `  <book id="${book.id}" code="${escapeXml(book.code)}" name="${escapeXml(book.name)}" testament="${book.testament}">\n`;

      // Get chapters for this book
      const chapters = db
        .prepare(
          `SELECT ch.id, ch.number FROM chapters ch 
           JOIN books b ON ch.book_id = b.id 
           WHERE b.id = ? 
           ORDER BY ch.number`
        )
        .all(book.id) as Chapter[];

      for (const chapter of chapters) {
        xmlContent += `    <chapter number="${chapter.number}">\n`;

        // Get verses for this chapter
        const verses = db
          .prepare(
            `SELECT v.id, v.verse_number, v.text, v.verse_part FROM verses v 
             WHERE v.chapter_id = ? 
             ORDER BY v.verse_number, v.verse_part`
          )
          .all(chapter.id) as Verse[];

        // Get sections (titles) for this chapter
        const sections = db
          .prepare(
            `SELECT id, start_verse, end_verse, title FROM sections 
             WHERE chapter_id = ? 
             ORDER BY start_verse`
          )
          .all(chapter.id) as Section[];

        // Create a map of verse sections
        const sectionMap = new Map<number, string>();
        sections.forEach((section) => {
          sectionMap.set(section.start_verse, section.title);
        });

        // Add verses
        for (const verse of verses) {
          // Check if this verse starts a new section
          const sectionTitle = sectionMap.get(verse.verse_number);
          if (sectionTitle) {
            xmlContent += `      <section title="${escapeXml(sectionTitle)}" />\n`;
          }

          xmlContent += `      <verse number="${verse.verse_number}"`;
          if (verse.verse_part) {
            xmlContent += ` part="${escapeXml(verse.verse_part)}"`;
          }
          xmlContent += `>${escapeXml(verse.text)}</verse>\n`;
        }

        xmlContent += `    </chapter>\n`;
      }

      xmlContent += `  </book>\n`;
    }

    xmlContent += `</bible>\n`;

    // Write uncompressed XML first
    fs.writeFileSync(XML_OUTPUT, xmlContent, "utf-8");
    const xmlSize = fs.statSync(XML_OUTPUT).size;
    console.log(
      `✓ XML created: ${(xmlSize / 1024 / 1024).toFixed(2)} MB`
    );

    // Compress to gzip
    console.log("Compressing...");
    const input = fs.createReadStream(XML_OUTPUT);
    const output = fs.createWriteStream(COMPRESSED_OUTPUT);
    const gzip = zlib.createGzip();

    input.pipe(gzip).pipe(output);

    await new Promise((resolve, reject) => {
      output.on("finish", resolve);
      output.on("error", reject);
    });

    const compressedSize = fs.statSync(COMPRESSED_OUTPUT).size;
    const ratio = ((1 - compressedSize / xmlSize) * 100).toFixed(1);

    console.log(
      `✓ Compressed: ${(compressedSize / 1024 / 1024).toFixed(2)} MB (${ratio}% reduction)`
    );

    // Delete uncompressed XML to save space
    fs.unlinkSync(XML_OUTPUT);
    console.log("✓ Removed uncompressed XML");

    db.close();
    console.log("✅ Bible extraction complete!");
  } catch (error) {
    console.error("❌ Error during extraction:", error);
    process.exit(1);
  }
}

function escapeXml(text: string | null): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

extractBible();
