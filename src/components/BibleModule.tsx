import { useState } from "react";
import { useBible } from "../hooks/useBible";
import { Search } from "lucide-react";

export function BibleModule() {
  const { isLoading, error, books, searchVerses } = useBible();
  const [selectedBook, setSelectedBook] = useState<string>("");
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading Bible data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-red-600 font-semibold">Error loading Bible</p>
          <p className="text-gray-500 mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const selectedBookData = books.find((b) => b.code === selectedBook);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const results = await searchVerses(searchQuery);
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectBook = (bookCode: string) => {
    setSelectedBook(bookCode);
    setSelectedChapter(1);
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleLoadChapter = async (chapter: number) => {
    setSelectedChapter(chapter);
    setSearchResults([]);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-2xl font-bold text-gray-800">📖 Alkitab</h1>
        <p className="text-sm text-gray-500">
          {books.length} kitab • {books.reduce((sum, b) => sum + b.chapters.length, 0)} pasal
        </p>
      </div>

      {/* Search Bar */}
      <div className="bg-white border-b border-gray-200 p-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ayat..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
          >
            {isSearching ? "Searching..." : "Search"}
          </button>
        </form>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Books List */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Kitab</h2>
            <div className="space-y-1">
              {books.map((book) => (
                <button
                  key={book.code}
                  onClick={() => handleSelectBook(book.code)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedBook === book.code
                      ? "bg-blue-100 text-blue-900 font-semibold"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{book.name}</span>
                    <span className="text-xs text-gray-500">
                      {book.chapters.length}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {searchResults.length > 0 ? (
            // Search Results View
            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-gray-800">
                  Search Results ({searchResults.length})
                </h2>
                <p className="text-sm text-gray-500">
                  Query: "{searchQuery}"
                </p>
              </div>
              <div className="space-y-4">
                {searchResults.slice(0, 100).map((verse) => (
                  <div
                    key={verse.id}
                    className="bg-white p-4 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-semibold text-gray-800">
                        {verse.bookName} {verse.chapter}:{verse.verse}
                      </span>
                      {verse.section && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {verse.section}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-700">{verse.text}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : selectedBookData ? (
            // Book Chapter View
            <div className="flex flex-col overflow-hidden">
              {/* Chapter Selector */}
              <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-800">
                    {selectedBookData.name}
                  </h2>
                  <p className="text-sm text-gray-500">Pasal {selectedChapter}</p>
                </div>
                <select
                  value={selectedChapter}
                  onChange={(e) =>
                    handleLoadChapter(parseInt(e.target.value))
                  }
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {selectedBookData.chapters.map((ch) => (
                    <option key={ch.number} value={ch.number}>
                      Pasal {ch.number}
                    </option>
                  ))}
                </select>
              </div>

              {/* Verses Display */}
              <div className="flex-1 overflow-y-auto p-6">
                <ChapterView
                  book={selectedBookData}
                  chapterNumber={selectedChapter}
                />
              </div>
            </div>
          ) : (
            // Empty State
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-gray-500">
                  Pilih kitab untuk melihat ayat
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChapterView({
  book,
  chapterNumber,
}: {
  book: any;
  chapterNumber: number;
}) {
  const chapter = book.chapters.find((c: any) => c.number === chapterNumber);

  if (!chapter) {
    return <div className="text-gray-500">Chapter not found</div>;
  }

  return (
    <div className="space-y-3">
      {chapter.verses.map((verse: any) => (
        <div key={verse.id} className="mb-4">
          {verse.section && (
            <h3 className="text-lg font-semibold text-gray-800 mb-2 text-blue-700">
              {verse.section}
            </h3>
          )}
          <div className="flex gap-3">
            <span className="text-sm font-bold text-gray-500 min-w-8">
              {verse.verse}
            </span>
            <p className="text-gray-700 leading-relaxed">{verse.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
