import { useState, useEffect } from 'react';
import { useBible } from '../../hooks/useBible';
import { BibleBookSelector } from './BibleBookSelector';
import { BibleVersePicker as BibleVerseListPicker } from './BibleVersePicker';
import type { BibleVerse } from '../../types/bible';

interface BibleVersePickerModalProps {
  onSelect?: (data: {
    book: string;
    chapter: number;
    verseStart: number;
    verseEnd?: number;
    verses?: BibleVerse[];
  }) => void;
  onCancel?: () => void;
  mode?: 'single' | 'range';
  compact?: boolean;
}

/**
 * Complete Bible Verse Picker Component
 * Composite component with translation, book, chapter, and verse selection
 */
export function BiblePickerModal({
  onSelect,
  onCancel,
  mode = 'single',
  compact = false,
}: BibleVersePickerModalProps) {
  const { isLoading, error, books } = useBible();
  const [selectedBook, setSelectedBook] = useState<string>('');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [selectedVerses, setSelectedVerses] = useState<BibleVerse[]>([]);

  // Auto-select first book
  useEffect(() => {
    if (books.length > 0 && !selectedBook) {
      setSelectedBook(books[0].code);
    }
  }, [books, selectedBook]);

  const currentBook = books.find(b => b.code === selectedBook);
  const currentChapter = currentBook?.chapters.find(
    c => c.number === selectedChapter
  ) || null;

  const handleSelect = () => {
    if (selectedVerses.length === 0) {
      alert('Please select at least one verse');
      return;
    }

    const verseStart = selectedVerses[0].verse;
    const verseEnd = selectedVerses[selectedVerses.length - 1].verse;

    onSelect?.({
      book: selectedBook,
      chapter: selectedChapter,
      verseStart,
      verseEnd: verseEnd !== verseStart ? verseEnd : undefined,
      verses: selectedVerses,
    });
  };

  if (compact) {
    // Compact inline view for slide editor
    return (
      <div className="space-y-3">
        {/* Chapter Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Chapter
          </label>
          <select
            value={selectedChapter}
            onChange={(e) => {
              setSelectedChapter(parseInt(e.target.value));
              setSelectedVerses([]);
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {currentBook?.chapters.map(ch => (
              <option key={ch.number} value={ch.number}>
                {currentBook.name} {ch.number}
              </option>
            ))}
          </select>
        </div>

        {/* Verse Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Verse
          </label>
          <select
            value={selectedVerses[0]?.verse || ''}
            onChange={(e) => {
              const verse = currentChapter?.verses.find(
                v => v.verse === parseInt(e.target.value)
              );
              if (verse) {
                setSelectedVerses([verse]);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select verse...</option>
            {currentChapter?.verses.map(verse => (
              <option key={verse.id} value={verse.verse}>
                {verse.verse}
              </option>
            ))}
          </select>
        </div>

        {selectedVerses.length > 0 && (
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">{selectedVerses[0].bookName}</span>
              {' '}
              <span>{selectedChapter}:{selectedVerses[0].verse}</span>
            </p>
            <p className="text-sm text-gray-700 mt-2 leading-relaxed">
              {selectedVerses.map(v => v.text).join(' ')}
            </p>
          </div>
        )}
      </div>
    );
  }

  // Full modal view
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading Bible...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Error</p>
          <p className="text-gray-600 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h2 className="text-lg font-bold text-gray-800">Select a Bible Verse</h2>
        <p className="text-sm text-gray-600">
          {mode === 'range'
            ? 'Select two verses to create a range'
            : 'Click on a verse to select'}
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Translation & Books Sidebar */}
        <div className="w-64 border-r border-gray-200 flex flex-col bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-800 text-sm mb-2">Books</h3>
            <BibleBookSelector
              books={books}
              value={selectedBook}
              onChange={(code) => {
                setSelectedBook(code);
                setSelectedChapter(1);
                setSelectedVerses([]);
              }}
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chapter Selector */}
          <div className="bg-white border-b border-gray-200 p-4 flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chapter
              </label>
              <select
                value={selectedChapter}
                onChange={(e) => {
                  setSelectedChapter(parseInt(e.target.value));
                  setSelectedVerses([]);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {currentBook?.chapters.map(ch => (
                  <option key={ch.number} value={ch.number}>
                    Chapter {ch.number}
                  </option>
                ))}
              </select>
            </div>

            {selectedVerses.length > 0 && (
              <div className="text-right">
                <p className="text-sm text-gray-600 mb-2">Selected</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSelect}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Verse List */}
          <div className="flex-1 overflow-hidden">
            <BibleVerseListPicker
              chapter={currentChapter}
              mode={mode}
              onSelect={setSelectedVerses}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default BiblePickerModal;
