import { useState, useEffect } from "react";
import { BibleBook } from "../types/bible";
import {
  clearBibleDataCache,
  loadBibleData,
  getVerse,
  getChapter,
  getBooks,
  searchVerses,
} from "../services/bibleService";

export function useBible() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [books, setBooks] = useState<BibleBook[]>([]);

  // Load Bible data on hook mount
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        clearBibleDataCache();
        const activeBuffer = await window.api?.bible?.getActiveBuffer?.();
        await loadBibleData(activeBuffer || undefined);
        const bookList = await getBooks();
        setBooks(bookList);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load Bible data");
      } finally {
        setIsLoading(false);
      }
    };

    void load();
    window.addEventListener("bible-version-changed", load);
    return () => window.removeEventListener("bible-version-changed", load);
  }, []);

  return {
    isLoading,
    error,
    books,
    getVerse,
    getChapter,
    searchVerses,
  };
}
