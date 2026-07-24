import { useState, useMemo } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import type { BibleChapter, BibleVerse } from '../../types/bible';

interface BibleVersePickerProps {
  chapter: BibleChapter | null;
  mode?: 'single' | 'range';
  onSelect?: (verses: BibleVerse[]) => void;
  isLoading?: boolean;
}

/**
 * Bible Verse Picker Component
 * Select single or range of verses
 */
export function BibleVersePicker({
  chapter,
  mode = 'single',
  onSelect,
  isLoading = false,
}: BibleVersePickerProps) {
  const [selectedSingle, setSelectedSingle] = useState<number | null>(null);
  const [selectedRangeStart, setSelectedRangeStart] = useState<number | null>(null);
  const [selectedRangeEnd, setSelectedRangeEnd] = useState<number | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  // Group verses by section
  const groupedVerses = useMemo(() => {
    if (!chapter) return [];

    const groups: Array<{
      section: string;
      verses: BibleVerse[];
    }> = [];

    let currentSection = '';
    let currentGroup: BibleVerse[] = [];

    chapter.verses.forEach(verse => {
      if (verse.section && verse.section !== currentSection) {
        if (currentGroup.length > 0) {
          groups.push({
            section: currentSection,
            verses: currentGroup,
          });
        }
        currentSection = verse.section;
        currentGroup = [verse];
      } else {
        currentGroup.push(verse);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({
        section: currentSection,
        verses: currentGroup,
      });
    }

    return groups;
  }, [chapter]);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleVerseSelect = (verseNumber: number) => {
    if (mode === 'single') {
      setSelectedSingle(verseNumber);
      const selected = chapter?.verses.filter(v => v.verse === verseNumber) || [];
      onSelect?.(selected);
    } else {
      // Range mode
      if (selectedRangeStart === null) {
        setSelectedRangeStart(verseNumber);
        setSelectedRangeEnd(null);
      } else if (selectedRangeEnd === null) {
        const start = Math.min(selectedRangeStart, verseNumber);
        const end = Math.max(selectedRangeStart, verseNumber);
        setSelectedRangeStart(start);
        setSelectedRangeEnd(end);

        // Get selected verses
        const selected = chapter?.verses.filter(
          v => v.verse >= start && v.verse <= end
        ) || [];
        onSelect?.(selected);
      } else {
        // Reset and start new selection
        setSelectedRangeStart(verseNumber);
        setSelectedRangeEnd(null);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="animate-pulse">Loading verses...</div>
      </div>
    );
  }

  if (!chapter) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
        <p>Select a chapter first</p>
      </div>
    );
  }

  if (chapter.verses.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
        <p>No verses in this chapter</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <h3 className="font-semibold text-gray-800 mb-2">Select Verses</h3>
        <p className="text-xs text-gray-600">
          {mode === 'single'
            ? 'Click to select a single verse'
            : 'Click to select start and end verse'}
        </p>
        {mode === 'range' && (
          <div className="text-xs text-gray-600 mt-2">
            {selectedRangeStart !== null && (
              <span>
                {selectedRangeEnd !== null
                  ? `Selected: ${selectedRangeStart}-${selectedRangeEnd}`
                  : `Start: ${selectedRangeStart}`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Verses List */}
      <div className="flex-1 overflow-y-auto">
        {groupedVerses.map((group, idx) => {
          const isExpanded = expandedSections.has(group.section || `group-${idx}`);
          const sectionKey = group.section || `group-${idx}`;

          return (
            <div key={sectionKey}>
              {/* Section Header */}
              {group.section && (
                <button
                  onClick={() => toggleSection(sectionKey)}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-blue-50 border-b border-gray-200 hover:bg-blue-100 transition-colors text-left font-medium text-sm text-blue-900"
                >
                  <ChevronDown
                    size={16}
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  />
                  {group.section}
                </button>
              )}

              {/* Verses */}
              {(isExpanded || !group.section) && (
                <div className="divide-y divide-gray-100">
                  {group.verses.map(verse => {
                    const isSelected =
                      mode === 'single'
                        ? selectedSingle === verse.verse
                        : selectedRangeStart !== null &&
                          selectedRangeEnd !== null &&
                          verse.verse >= selectedRangeStart &&
                          verse.verse <= selectedRangeEnd;

                    return (
                      <button
                        key={verse.id}
                        onClick={() => handleVerseSelect(verse.verse)}
                        className={`w-full text-left px-4 py-2 transition-colors ${
                          isSelected
                            ? 'bg-blue-100 text-blue-900 font-medium'
                            : 'bg-white hover:bg-gray-50 text-gray-800'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <span
                            className={`flex-shrink-0 w-8 font-medium ${
                              isSelected ? 'text-blue-600' : 'text-gray-500'
                            }`}
                          >
                            {verse.verse}
                          </span>
                          <span className="flex-1 text-sm leading-relaxed break-words">
                            {verse.text}
                          </span>
                          {isSelected && (
                            <Check size={16} className="flex-shrink-0 mt-1" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
