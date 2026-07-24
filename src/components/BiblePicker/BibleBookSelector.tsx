import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import type { BibleBook } from '../../types/bible';

interface BibleBookSelectorProps {
  books: BibleBook[];
  value?: string;
  onChange?: (bookCode: string) => void;
  isLoading?: boolean;
}

/**
 * Bible Book Selector Component
 * Display list of books with search functionality
 */
export function BibleBookSelector({
  books,
  value,
  onChange,
  isLoading = false,
}: BibleBookSelectorProps) {
  const [search, setSearch] = useState('');

  const filteredBooks = useMemo(() => {
    if (!search) return books;

    const searchTerm = search.toLowerCase();
    return books.filter(
      book =>
        book.name.toLowerCase().includes(searchTerm) ||
        book.code.toLowerCase().includes(searchTerm)
    );
  }, [books, search]);

  // Group books by testament
  const otBooks = filteredBooks.filter(b => b.testament === 'OT');
  const ntBooks = filteredBooks.filter(b => b.testament === 'NT');

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse">Loading books...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Search Bar */}
      <div className="p-4 border-b border-gray-200">
        <div className="relative">
          <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search books..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Books List */}
      <div className="flex-1 overflow-y-auto">
        {otBooks.length === 0 && ntBooks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p>No books found</p>
          </div>
        ) : (
          <>
            {/* Old Testament */}
            {otBooks.length > 0 && (
              <div>
                <div className="sticky top-0 px-4 py-2 bg-gray-100 border-b border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase">Old Testament</h3>
                </div>
                {otBooks.map(book => (
                  <button
                    key={book.code}
                    onClick={() => onChange?.(book.code)}
                    className={`w-full text-left px-4 py-2 transition-colors border-l-4 ${
                      value === book.code
                        ? 'bg-blue-50 border-l-blue-500 text-blue-900 font-semibold'
                        : 'bg-white border-l-transparent text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{book.name}</span>
                      <span className="text-xs text-gray-500">{book.chapters.length} ch</span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* New Testament */}
            {ntBooks.length > 0 && (
              <div>
                <div className="sticky top-0 px-4 py-2 bg-gray-100 border-b border-gray-200 border-t border-gray-300">
                  <h3 className="text-xs font-semibold text-gray-700 uppercase">New Testament</h3>
                </div>
                {ntBooks.map(book => (
                  <button
                    key={book.code}
                    onClick={() => onChange?.(book.code)}
                    className={`w-full text-left px-4 py-2 transition-colors border-l-4 ${
                      value === book.code
                        ? 'bg-blue-50 border-l-blue-500 text-blue-900 font-semibold'
                        : 'bg-white border-l-transparent text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{book.name}</span>
                      <span className="text-xs text-gray-500">{book.chapters.length} ch</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
