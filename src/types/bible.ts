/**
 * Bible data types and interfaces
 */

export interface BibleVerse {
  id: number;
  bookId: number;
  bookCode: string;
  bookName: string;
  chapter: number;
  verse: number;
  versePart: string | null;
  text: string;
  section: string;
}

export interface BibleChapter {
  number: number;
  verses: BibleVerse[];
  sections: Map<number, string>;
}

export interface BibleBook {
  id: number;
  code: string;
  name: string;
  testament: "OT" | "NT";
  chapters: BibleChapter[];
}
