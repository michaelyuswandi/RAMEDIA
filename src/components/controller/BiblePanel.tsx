import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Copy,
  Search,
  Star,
  Trash2,
  Plus,
  Send,
} from 'lucide-react';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import { useUIStore } from '../../core/stores/useUIStore';
import { buildBibleVirtualSlides } from '../../core/utils/bibleSlides';
import {
  type BibleContentPayload,
  type BiblePresentationStyle,
  buildBibleReferenceLabel,
  getBibleVersesInRange,
  parseBibleReferenceInput,
} from '../../core/utils/biblePresentation';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { useBible } from '../../hooks/useBible';
import { useElementSize } from '../../hooks/useElementSize';
import { SlideRenderer } from '../common/SlideRenderer';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import type { Template } from '../../electron/database/schema';
import { useI18n } from '../../i18n';

const DEFAULT_STYLE: Required<BiblePresentationStyle> = {
  layoutMode: 'fullscreen',
  backgroundMode: 'solid',
  backgroundColor: '#05070A',
  backgroundMediaId: null,
  backgroundMediaPath: null,
  backgroundMediaType: null,
  overlayOpacity: 0.44,
  textAlign: 'center',
  verticalAlign: 'middle',
  showReference: true,
  showVerseNumbers: true,
  showVersionCode: true,
  referencePosition: 'bottom',
  referenceAlign: 'right',
  showSectionTitle: true,
  sectionDisplay: 'inline',
  textColor: '#FFFFFF',
  referenceColor: '#FACC15',
  versionColor: '#CBD5E1',
  sectionColor: '#93C5FD',
  fontFamily: 'Manrope, Inter, sans-serif',
  textScale: 1,
  referenceScale: 1,
  referenceX: null,
  referenceY: null,
  autoResizeMode: 'off',
  maxVersesPerSlide: null,
  contentX: 50,
  contentY: 56,
  contentWidth: 84,
  contentHeight: 52,
};

function parsePayload(content: string | null | undefined): BibleContentPayload {
  if (!content) return {};
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function getStyle(payload: BibleContentPayload): Required<BiblePresentationStyle> {
  return {
    ...DEFAULT_STYLE,
    ...(payload.style || {}),
  };
}

export default function BiblePanel() {
  const { t } = useI18n();
  const setActiveView = useUIStore((state) => state.setActiveView);
  const { isLoading, error, books } = useBible();
  const { isClear, setPreviewSlide, goLive, setClear } = usePresentationStore();
  const {
    outputWidth,
    outputHeight,
    defaultBibleContentThemeId,
    defaultBibleContentThemeName,
    defaultBibleContentThemeLayersData,
  } = useSettingsStore();
  const {
    currentSchedule,
    selectedItemId,
    addItem,
    updateItem,
    setSelectedItem,
  } = useScheduleStore();
  const { ref: previewRef, width: previewWidth, height: previewHeight } = useElementSize<HTMLDivElement>();

  const selectedScheduleBibleItem = useMemo(() => {
    return currentSchedule?.items.find((item) => item.id === selectedItemId && item.itemType === 'bible') || null;
  }, [currentSchedule, selectedItemId]);

  const [selectedBibleVersion, setSelectedBibleVersion] = useState('DEFAULT');
  const [selectedBibleBookCode, setSelectedBibleBookCode] = useState('');
  const [selectedBibleChapter, setSelectedBibleChapter] = useState(1);
  const [selectedBibleVerseStart, setSelectedBibleVerseStart] = useState(1);
  const [selectedBibleVerseEnd, setSelectedBibleVerseEnd] = useState<number | null>(null);
  const [selectedBibleDuration, setSelectedBibleDuration] = useState(3);
  const [bibleQuickReference, setBibleQuickReference] = useState('');
  const [bibleQuickReferenceError, setBibleQuickReferenceError] = useState<string | null>(null);
  const [selectedBibleSplitMode, setSelectedBibleSplitMode] = useState<'auto' | 'fixed' | 'per-verse'>('auto');
  const [selectedBibleSlideCount, setSelectedBibleSlideCount] = useState<number>(2);
  const [style, setStyle] = useState<Required<BiblePresentationStyle>>(DEFAULT_STYLE);
  const [scriptureThemes, setScriptureThemes] = useState<Template[]>([]);
  const [selectedBibleContentThemeId, setSelectedBibleContentThemeId] = useState(defaultBibleContentThemeId || '');
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [bookSearchQuery, setBookSearchQuery] = useState('');
  const [showFavoriteBooksOnly, setShowFavoriteBooksOnly] = useState(false);
  const [favoriteBookCodes, setFavoriteBookCodes] = useState<string[]>([]);
  const [favoriteVerseIds, setFavoriteVerseIds] = useState<number[]>([]);
  const isSyncingQuickReference = useRef(false);
  const loadedScheduleItemRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadScriptureThemes = async () => {
      await ipcTemplateService.seed();
      const page = await ipcTemplateService.getLibraryPage({ contentType: 'scripture', limit: 250 });
      if (active) setScriptureThemes(page.items);
    };
    const refreshThemes = () => void loadScriptureThemes().catch(() => undefined);
    refreshThemes();
    window.addEventListener('rumedia:templates-changed', refreshThemes);
    return () => {
      active = false;
      window.removeEventListener('rumedia:templates-changed', refreshThemes);
    };
  }, []);

  useEffect(() => {
    if (books.length === 0) return;

    if (selectedScheduleBibleItem && loadedScheduleItemRef.current !== selectedScheduleBibleItem.id) {
      const payload = parsePayload(selectedScheduleBibleItem.content);
      const selectedBookCode = selectedScheduleBibleItem.bibleBook || books[0]?.code || '';
      const selectedBook = books.find((book) => book.code === selectedBookCode) || books[0];
      const selectedChapterNumber = selectedScheduleBibleItem.bibleChapter || selectedBook?.chapters[0]?.number || 1;
      const selectedChapterData =
        selectedBook?.chapters.find((chapter) => chapter.number === selectedChapterNumber) || selectedBook?.chapters[0];
      const firstVerse = selectedChapterData?.verses[0]?.verse || 1;

      setSelectedBibleVersion(payload.versionCode || 'DEFAULT');
      setSelectedBibleBookCode(selectedBook?.code || '');
      setSelectedBibleChapter(selectedChapterData?.number || 1);
      setSelectedBibleVerseStart(selectedScheduleBibleItem.bibleVerseStart || firstVerse);
      setSelectedBibleVerseEnd(selectedScheduleBibleItem.bibleVerseEnd || null);
      setSelectedBibleDuration(selectedScheduleBibleItem.duration || 3);
      setSelectedBibleSplitMode(payload.splitMode || 'auto');
      setSelectedBibleSlideCount(payload.slideCount || 2);
      setStyle(getStyle(payload));
      setSelectedBibleContentThemeId(payload.contentThemeId || '');
      setSelectedSlideIndex(0);
      loadedScheduleItemRef.current = selectedScheduleBibleItem.id;
      return;
    }

    if (!selectedBibleBookCode) {
      const firstBook = books[0];
      if (firstBook) {
        setSelectedBibleBookCode(firstBook.code);
        setSelectedBibleChapter(firstBook.chapters[0]?.number || 1);
        setSelectedBibleVerseStart(firstBook.chapters[0]?.verses[0]?.verse || 1);
      }
    }
  }, [books, selectedBibleBookCode, selectedScheduleBibleItem]);

  useEffect(() => {
    if (!selectedScheduleBibleItem) {
      setSelectedBibleContentThemeId(defaultBibleContentThemeId || '');
    }
  }, [defaultBibleContentThemeId, selectedScheduleBibleItem]);

  const selectedBibleBook = useMemo(
    () => books.find((item) => item.code === selectedBibleBookCode),
    [books, selectedBibleBookCode],
  );

  const selectedBibleChapterData = useMemo(
    () => selectedBibleBook?.chapters.find((item) => item.number === selectedBibleChapter),
    [selectedBibleBook, selectedBibleChapter],
  );

  const selectedBibleChapterVerses = selectedBibleChapterData?.verses || [];

  const selectedBibleVerses = useMemo(() => {
    return getBibleVersesInRange(
      selectedBibleChapterVerses,
      selectedBibleVerseStart,
      selectedBibleVerseEnd,
    );
  }, [selectedBibleChapterVerses, selectedBibleVerseEnd, selectedBibleVerseStart]);

  const buildBibleReference = () =>
    selectedBibleBook
      ? buildBibleReferenceLabel(
          selectedBibleBook.name,
          selectedBibleChapter,
          selectedBibleVerseStart,
          selectedBibleVerseEnd,
        )
      : '';

  useEffect(() => {
    if (!selectedBibleBook) return;
    const nextReference = buildBibleReference();
    if (bibleQuickReference === nextReference) return;

    isSyncingQuickReference.current = true;
    setBibleQuickReference(nextReference);
  }, [selectedBibleBook, selectedBibleChapter, selectedBibleVerseStart, selectedBibleVerseEnd]);

  useEffect(() => {
    if (isSyncingQuickReference.current) {
      isSyncingQuickReference.current = false;
      setBibleQuickReferenceError(null);
      return;
    }

    if (!bibleQuickReference.trim() || books.length === 0) {
      setBibleQuickReferenceError(null);
      return;
    }

    const result = parseBibleReferenceInput(bibleQuickReference, books);
    if (result.status === 'success' && result.parsed) {
      const { parsed } = result;
      if (
        parsed.book.code !== selectedBibleBookCode ||
        parsed.chapter !== selectedBibleChapter ||
        parsed.verseStart !== selectedBibleVerseStart ||
        (parsed.verseEnd || null) !== (selectedBibleVerseEnd || null)
      ) {
        setSelectedBibleBookCode(parsed.book.code);
        setSelectedBibleChapter(parsed.chapter);
        setSelectedBibleVerseStart(parsed.verseStart);
        setSelectedBibleVerseEnd(parsed.verseEnd);
        setSelectedSlideIndex(0);
      }
      setBibleQuickReferenceError(null);
      return;
    }

    if (result.status === 'invalid') {
      setBibleQuickReferenceError(result.reason || 'Referensi tidak valid.');
      return;
    }

    setBibleQuickReferenceError(null);
  }, [bibleQuickReference, books, selectedBibleBookCode, selectedBibleChapter, selectedBibleVerseEnd, selectedBibleVerseStart]);

  const handleBibleBookChange = (bookCode: string) => {
    const book = books.find((item) => item.code === bookCode);
    const nextChapter = book?.chapters[0];
    const nextVerse = nextChapter?.verses[0]?.verse || 1;

    setSelectedBibleBookCode(bookCode);
    setSelectedBibleChapter(nextChapter?.number || 1);
    setSelectedBibleVerseStart(nextVerse);
    setSelectedBibleVerseEnd(null);
    setSelectedSlideIndex(0);
  };

  const handleBibleChapterChange = (chapter: number) => {
    const chapterData = selectedBibleBook?.chapters.find((item) => item.number === chapter);
    const nextVerse = chapterData?.verses[0]?.verse || 1;

    setSelectedBibleChapter(chapter);
    setSelectedBibleVerseStart(nextVerse);
    setSelectedBibleVerseEnd(null);
    setSelectedSlideIndex(0);
  };

  const handleBibleVerseClick = (verse: number, extendRange = false) => {
    if (extendRange) {
      const start = Math.min(selectedBibleVerseStart, verse);
      const end = Math.max(selectedBibleVerseStart, verse);
      setSelectedBibleVerseStart(start);
      setSelectedBibleVerseEnd(end === start ? null : end);
      setSelectedSlideIndex(0);
      return;
    }

    setSelectedBibleVerseStart(verse);
    setSelectedBibleVerseEnd(null);
    setSelectedSlideIndex(0);
  };

  const handleToggleBookFavorite = (bookCode: string) => {
    setFavoriteBookCodes((current) =>
      current.includes(bookCode)
        ? current.filter((code) => code !== bookCode)
        : [...current, bookCode],
    );
  };

  const handleToggleVerseFavorite = (verseId: number) => {
    setFavoriteVerseIds((current) =>
      current.includes(verseId)
        ? current.filter((id) => id !== verseId)
        : [...current, verseId],
    );
  };

  const handleCopyVerse = async (verse: { verse: number; text: string }) => {
    if (!selectedBibleBook || !navigator.clipboard?.writeText) return;
    const reference = buildBibleReferenceLabel(selectedBibleBook.name, selectedBibleChapter, verse.verse, null);
    await navigator.clipboard.writeText(`${reference} ${verse.text}`);
  };

  const handlePreviousChapter = () => {
    if (!selectedBibleBook) return;
    const currentIndex = selectedBibleBook.chapters.findIndex((chapter) => chapter.number === selectedBibleChapter);
    const previousChapter = selectedBibleBook.chapters[currentIndex - 1];
    if (previousChapter) {
      handleBibleChapterChange(previousChapter.number);
    }
  };

  const handleNextChapter = () => {
    if (!selectedBibleBook) return;
    const currentIndex = selectedBibleBook.chapters.findIndex((chapter) => chapter.number === selectedBibleChapter);
    const nextChapter = selectedBibleBook.chapters[currentIndex + 1];
    if (nextChapter) {
      handleBibleChapterChange(nextChapter.number);
    }
  };

  const handleClearScreen = () => {
    setClear(true);
  };

  const currentPayload = useMemo<BibleContentPayload>(() => {
    const selectedTheme = scriptureThemes.find((theme) => theme.id === selectedBibleContentThemeId) || null;
    const usesStoredDefault = !selectedTheme && selectedBibleContentThemeId === defaultBibleContentThemeId;
    return {
      reference: buildBibleReference(),
      text: selectedBibleVerses.map((item) => item.text).join('\n'),
      verseStart: selectedBibleVerseStart,
      verseEnd: selectedBibleVerseEnd,
      versionCode: selectedBibleVersion,
      verses: selectedBibleVerses.map((item) => ({
        verse: item.verse,
        text: item.text,
        section: item.section || undefined,
      })),
      splitMode: selectedBibleSplitMode,
      slideCount: selectedBibleSplitMode === 'fixed' ? selectedBibleSlideCount : null,
      contentThemeId: selectedTheme?.id || (usesStoredDefault ? defaultBibleContentThemeId : null),
      contentThemeName: selectedTheme?.name || (usesStoredDefault ? defaultBibleContentThemeName : null),
      contentThemeLayersData: selectedTheme?.layersData || (usesStoredDefault ? defaultBibleContentThemeLayersData : null),
      style,
    };
  }, [
    selectedBibleSlideCount,
    selectedBibleSplitMode,
    selectedBibleContentThemeId,
    selectedBibleVerseEnd,
    selectedBibleVerseStart,
    selectedBibleVerses,
    selectedBibleVersion,
    defaultBibleContentThemeId,
    defaultBibleContentThemeLayersData,
    defaultBibleContentThemeName,
    scriptureThemes,
    style,
  ]);

  const previewItem = useMemo(() => {
    return {
      id: selectedScheduleBibleItem?.id || `bible-preview-${selectedBibleBookCode}-${selectedBibleChapter}-${selectedBibleVerseStart}-${selectedBibleVerseEnd || selectedBibleVerseStart}`,
      itemType: 'bible',
      bibleBook: selectedBibleBookCode,
      bibleChapter: selectedBibleChapter,
      bibleVerseStart: selectedBibleVerseStart,
      bibleVerseEnd: selectedBibleVerseEnd,
      content: JSON.stringify(currentPayload),
    } as any;
  }, [
    currentPayload,
    selectedBibleBookCode,
    selectedBibleChapter,
    selectedBibleVerseEnd,
    selectedBibleVerseStart,
    selectedScheduleBibleItem?.id,
  ]);

  const generatedSlides = useMemo(() => buildBibleVirtualSlides(previewItem), [previewItem]);
  const selectedPreviewSlide = generatedSlides[selectedSlideIndex] || generatedSlides[0] || null;

  useEffect(() => {
    if (generatedSlides.length === 0) {
      setSelectedSlideIndex(0);
      return;
    }

    setSelectedSlideIndex((current) => Math.min(current, generatedSlides.length - 1));
  }, [generatedSlides]);

  const targetAspect = outputWidth / outputHeight;
  const hasBounds = previewWidth > 0 && previewHeight > 0;
  let monitorWidth = previewWidth;
  let monitorHeight = previewWidth / targetAspect;

  if (hasBounds && monitorHeight > previewHeight) {
    monitorHeight = previewHeight;
    monitorWidth = previewHeight * targetAspect;
  }

  const boxStyle = hasBounds
    ? { width: `${monitorWidth}px`, height: `${monitorHeight}px`, maxWidth: '100%', maxHeight: '100%' }
    : { width: '100%', aspectRatio: targetAspect };

  const handleCuePrevious = () => {
    setSelectedSlideIndex((current) => Math.max(0, current - 1));
  };

  const handleCueNext = () => {
    setSelectedSlideIndex((current) => Math.min(generatedSlides.length - 1, current + 1));
  };

  const handleGoLive = () => {
    if (selectedPreviewSlide) {
      setPreviewSlide(selectedPreviewSlide as any);
      goLive(selectedPreviewSlide as any);
    }
  };

  const handleSaveToRundown = async () => {
    if (!selectedBibleBook || selectedBibleVerses.length === 0) return;

    const itemData = {
      itemType: 'bible' as const,
      bibleBook: selectedBibleBookCode,
      bibleChapter: selectedBibleChapter,
      bibleVerseStart: selectedBibleVerseStart,
      bibleVerseEnd: selectedBibleVerseEnd,
      content: JSON.stringify(currentPayload),
      duration: selectedBibleDuration,
    };

    if (selectedScheduleBibleItem) {
      await updateItem(selectedScheduleBibleItem.id, itemData);
      setSelectedItem(selectedScheduleBibleItem.id);
      return;
    }

    const itemId = await addItem(itemData);
    setSelectedItem(itemId);
  };

  const testamentGroups = useMemo(() => {
    const normalizedQuery = bookSearchQuery.trim().toLowerCase();
    const filterBooks = (sourceBooks: typeof books) =>
      sourceBooks.filter((book) => {
        const matchesSearch =
          !normalizedQuery ||
          book.name.toLowerCase().includes(normalizedQuery) ||
          book.code.toLowerCase().includes(normalizedQuery);
        const matchesFavorite = !showFavoriteBooksOnly || favoriteBookCodes.includes(book.code);
        return matchesSearch && matchesFavorite;
      });
    const oldTestament = books.slice(0, 39);
    const newTestament = books.slice(39);
    return [
      { label: t('biblePanel.oldTestament'), books: filterBooks(oldTestament) },
      { label: t('biblePanel.newTestament'), books: filterBooks(newTestament) },
    ];
  }, [bookSearchQuery, books, favoriteBookCodes, showFavoriteBooksOnly, t]);

  const goLiveCountLabel = t('biblePanel.versesReady', { count: selectedBibleVerses.length });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable;

      if (isTypingTarget) return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        handleCuePrevious();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handleCueNext();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        void handleSaveToRundown();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [generatedSlides.length, selectedPreviewSlide, selectedBibleBook, selectedBibleVerses.length, currentPayload]);

  if (isLoading) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="text-center text-text/50">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
          <div className="text-xs uppercase tracking-[0.18em]">{t('biblePanel.loading')}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="max-w-md rounded-2xl border border-error/35 bg-error/10 p-5 text-sm text-error">
          <div className="font-semibold">{t('biblePanel.loadFailed')}</div>
          <div className="mt-2 text-error/85">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="theme-scope absolute inset-0 z-40 bg-background text-text">
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-text/10 bg-surface px-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveView('songs')}
              className="flex h-10 items-center gap-2 rounded-lg border border-text/10 bg-text/[0.04] px-3 text-sm font-semibold text-text/78 transition hover:bg-text/[0.08] hover:text-text"
            >
              <ArrowLeft size={15} /> {t('common.back')}
            </button>
            <div>
              <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-primary">{t('biblePanel.workspace')}</div>
              <div className="text-base font-bold text-text">{t('biblePanel.title')}</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-sm font-semibold text-text/78">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              {goLiveCountLabel}
            </span>
            <button
              onClick={handleClearScreen}
              className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                isClear
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : 'border-text/10 bg-text/[0.04] text-text/78 hover:bg-text/[0.08] hover:text-text'
              }`}
            >
              {isClear ? t('biblePanel.cleared') : t('biblePanel.clear')}
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-3 p-3" style={{ gridTemplateColumns: '300px minmax(480px, 1fr) 380px' }}>
          <aside className="flex min-h-0 flex-col gap-3">
            <section className="rounded-xl border border-text/10 bg-surface p-3 shadow-[0_12px_32px_rgba(var(--color-shadow-rgb),0.12)]">
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-primary">{t('biblePanel.quickReference')}</div>
              <input
                value={bibleQuickReference}
                onChange={(e) => setBibleQuickReference(e.target.value)}
                placeholder={t('biblePanel.quickReferencePlaceholder')}
                className="h-11 w-full rounded-lg border border-text/10 bg-text/[0.04] px-3 text-sm font-semibold text-text outline-none transition placeholder:text-text/38 focus:border-primary/55 focus:bg-text/[0.07]"
              />
              <div className={`mt-2 text-xs ${bibleQuickReferenceError ? 'text-rose-500' : 'text-text/52'}`}>
                {bibleQuickReferenceError || t('biblePanel.quickReferenceHelp')}
              </div>
            </section>

            <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-text/10 bg-surface shadow-[0_12px_32px_rgba(var(--color-shadow-rgb),0.12)]">
              <div className="border-b border-text/10 p-3">
                <label className="flex h-10 items-center gap-2 rounded-lg border border-text/10 bg-text/[0.04] px-3 text-text/52">
                  <Search size={16} />
                  <input
                    value={bookSearchQuery}
                    onChange={(e) => setBookSearchQuery(e.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text/38"
                    placeholder={t('biblePanel.searchBookPlaceholder')}
                  />
                </label>
                <div className="mt-3 grid grid-cols-2 rounded-lg border border-text/10 bg-text/[0.04] p-1">
                  <button
                    onClick={() => setShowFavoriteBooksOnly(false)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                      !showFavoriteBooksOnly ? 'bg-primary/16 text-primary shadow-sm' : 'text-text/52 hover:text-text'
                    }`}
                  >
                    {t('common.all')}
                  </button>
                  <button
                    onClick={() => setShowFavoriteBooksOnly(true)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                      showFavoriteBooksOnly ? 'bg-primary/16 text-primary shadow-sm' : 'text-text/52 hover:text-text'
                    }`}
                  >
                    {t('biblePanel.favorite')}
                  </button>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {testamentGroups.map((group) => (
                  <div key={group.label} className="mb-3">
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
                      {group.label}
                      <ChevronRight size={14} className="rotate-90 text-text/38" />
                    </div>
                    <div className="space-y-0.5">
                      {group.books.map((book) => (
                        <div
                          key={book.code}
                          className={`grid h-8 w-full grid-cols-[1fr_34px] items-center rounded-md px-2 text-left text-sm transition ${
                            selectedBibleBookCode === book.code
                              ? 'bg-primary text-black shadow-sm'
                              : 'text-text/76 hover:bg-text/[0.05] hover:text-text'
                          }`}
                        >
                          <button onClick={() => handleBibleBookChange(book.code)} className="min-w-0 truncate text-left font-semibold">
                            {book.name}
                          </button>
                          <button
                            onClick={() => handleToggleBookFavorite(book.code)}
                            className={`flex items-center justify-end gap-1 font-mono text-xs ${
                              selectedBibleBookCode === book.code ? 'text-black/75' : 'text-text/50'
                            }`}
                            title={favoriteBookCodes.includes(book.code) ? t('biblePanel.removeFavoriteVerse') : t('biblePanel.addFavoriteVerse')}
                          >
                            {book.chapters.length}
                            <Star
                              size={12}
                              className={favoriteBookCodes.includes(book.code) ? 'fill-amber-400 text-amber-400' : ''}
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {testamentGroups.every((group) => group.books.length === 0) && (
                  <div className="rounded-lg border border-dashed border-text/14 p-4 text-center text-sm text-text/52">
                    {t('biblePanel.noMatchingBooks')}
                  </div>
                )}
              </div>
              <div className="border-t border-text/10 p-3">
                <div className="flex w-full items-center justify-between rounded-lg border border-text/10 bg-text/[0.04] px-3 py-3 text-left text-sm font-semibold text-text/76">
                  <span>
                    <span className="block text-xs text-text/52">{t('biblePanel.bibleVersion')}</span>
                    TB (Terjemahan Baru)
                  </span>
                  <span className="text-xs text-text/38">{t('biblePanel.active')}</span>
                </div>
              </div>
            </section>
          </aside>

          <main className="flex min-h-0 flex-col rounded-xl border border-text/10 bg-surface shadow-[0_12px_32px_rgba(var(--color-shadow-rgb),0.12)]">
            <div className="shrink-0 border-b border-text/10 p-4">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-extrabold text-text">{selectedBibleBook?.name || t('biblePanel.selectBook')}</h2>
                <div className="flex items-center gap-2">
                  <span className="mr-1 text-xs font-semibold text-text/52">{t('biblePanel.display')}</span>
                  <button
                    onClick={() => setSelectedBibleSplitMode('per-verse')}
                    className={`rounded-lg border px-4 py-2 text-sm font-bold ${
                      selectedBibleSplitMode === 'per-verse'
                        ? 'border-primary/45 bg-primary/16 text-primary'
                        : 'border-text/10 bg-text/[0.04] text-text/62 hover:bg-text/[0.08] hover:text-text'
                    }`}
                  >
                    {t('biblePanel.verse')}
                  </button>
                  <button
                    onClick={() => setSelectedBibleSplitMode('auto')}
                    className={`rounded-lg border px-4 py-2 text-sm font-bold ${
                      selectedBibleSplitMode !== 'per-verse'
                        ? 'border-primary/45 bg-primary/16 text-primary'
                        : 'border-text/10 bg-text/[0.04] text-text/62 hover:bg-text/[0.08] hover:text-text'
                    }`}
                  >
                    {t('biblePanel.paragraph')}
                  </button>
                  <label className="ml-2 flex items-center gap-2 text-xs font-semibold text-text/52">
                    {t('biblePanel.theme')}
                    <select
                      value={selectedBibleContentThemeId}
                      onChange={(event) => setSelectedBibleContentThemeId(event.target.value)}
                      className="h-9 max-w-56 rounded-lg border border-text/10 bg-text/[0.04] px-3 text-xs font-semibold text-text outline-none transition focus:border-primary/55"
                    >
                      <option value="">{t('biblePanel.noItemTheme')}</option>
                      {scriptureThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 overflow-x-auto">
                <button
                  onClick={handlePreviousChapter}
                  disabled={!selectedBibleBook || selectedBibleChapter <= (selectedBibleBook.chapters[0]?.number || 1)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text/52 hover:bg-text/[0.05] hover:text-text disabled:opacity-35"
                >
                  <ChevronLeft size={16} />
                </button>
                {(selectedBibleBook?.chapters || []).slice(0, 12).map((chapter) => (
                  <button
                    key={chapter.number}
                    onClick={() => handleBibleChapterChange(chapter.number)}
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-sm font-bold transition ${
                      selectedBibleChapter === chapter.number
                        ? 'bg-primary text-black shadow-sm'
                        : 'text-text/76 hover:bg-text/[0.05] hover:text-text'
                    }`}
                  >
                    {chapter.number}
                  </button>
                ))}
                {(selectedBibleBook?.chapters.length || 0) > 12 && <span className="px-2 text-text/52">...</span>}
                <button
                  onClick={handleNextChapter}
                  disabled={!selectedBibleBook || selectedBibleChapter >= (selectedBibleBook.chapters[selectedBibleBook.chapters.length - 1]?.number || 1)}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text/52 hover:bg-text/[0.05] hover:text-text disabled:opacity-35"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <div className="divide-y divide-text/10 rounded-lg border border-text/10">
                {selectedBibleChapterVerses.map((verse) => {
                  const selected =
                    verse.verse >= selectedBibleVerseStart &&
                    verse.verse <= (selectedBibleVerseEnd || selectedBibleVerseStart);
                  return (
                    <div
                      key={verse.id}
                      role="button"
                      tabIndex={0}
                      onClick={(event) => handleBibleVerseClick(verse.verse, event.shiftKey)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          handleBibleVerseClick(verse.verse, event.shiftKey);
                        }
                      }}
                      onDoubleClick={handleGoLive}
                      className={`grid w-full grid-cols-[46px_1fr_96px] items-start gap-3 px-4 py-3 text-left transition ${
                        selected ? 'bg-primary/12 ring-1 ring-inset ring-primary/40' : 'bg-surface hover:bg-text/[0.04]'
                      }`}
                    >
                      <span className={`font-mono text-sm ${selected ? 'text-primary' : 'text-text/52'}`}>{verse.verse}</span>
                      <span className="text-sm leading-6 text-text/82">{verse.text}</span>
                        <span className="flex items-center justify-end gap-2 text-text/42">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggleVerseFavorite(verse.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              handleToggleVerseFavorite(verse.id);
                            }
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md border border-transparent hover:border-text/10 hover:bg-text/[0.06] hover:text-text"
                          title={favoriteVerseIds.includes(verse.id) ? 'Hapus favorit ayat' : 'Favoritkan ayat'}
                        >
                          <Star
                            size={15}
                            className={favoriteVerseIds.includes(verse.id) ? 'fill-amber-400 text-amber-400' : ''}
                          />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCopyVerse(verse);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              void handleCopyVerse(verse);
                            }
                          }}
                          className="grid h-7 w-7 place-items-center rounded-md border border-transparent hover:border-text/10 hover:bg-text/[0.06] hover:text-text"
                          title={t('biblePanel.copyVerse')}
                        >
                          <Copy size={15} />
                        </span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => {
                            event.stopPropagation();
                            handleBibleVerseClick(verse.verse, true);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              handleBibleVerseClick(verse.verse, true);
                            }
                          }}
                          className="rounded-md border border-text/10 bg-text/[0.04] px-2 py-1 text-[11px] font-bold text-text/70 hover:bg-text/[0.08] hover:text-text"
                        >
                          {t('biblePanel.untilVerse')}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex shrink-0 justify-center border-t border-text/10 p-2">
              <div className="flex items-center gap-3 rounded-lg border border-text/10 bg-text/[0.04] px-4 py-2 text-xs text-text/52">
                <span>{t('biblePanel.shortcut')}</span>
                <span className="rounded-md bg-surface px-2 py-1 font-semibold text-text/78">{t('biblePanel.shortcutShiftClick')}</span>
                <span className="rounded-md bg-surface px-2 py-1 font-semibold text-text/78">{t('biblePanel.shortcutDoubleClick')}</span>
              </div>
            </div>
          </main>

          <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            <section className="flex shrink-0 flex-col overflow-hidden rounded-xl border border-text/10 bg-surface shadow-[0_12px_32px_rgba(var(--color-shadow-rgb),0.12)]">
              <div className="flex h-14 shrink-0 items-center gap-8 border-b border-text/10 px-4">
                <button className="h-full border-b-2 border-transparent text-sm font-extrabold text-text">PREVIEW</button>
                <button className="flex h-full items-center gap-2 border-b-2 border-emerald-500 text-sm font-extrabold text-text">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" /> LIVE
                </button>
              </div>
              <div ref={previewRef} className="p-3">
                <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl bg-slate-950 p-2">
                  {selectedPreviewSlide ? (
                    <div className="overflow-hidden rounded-lg bg-black" style={boxStyle}>
                      <SlideRenderer slide={selectedPreviewSlide as any} forceMuted renderMode="preview" />
                    </div>
                  ) : (
                    <div className="text-sm text-white/40">No Preview</div>
                  )}
                </div>
              </div>
              <div className="grid shrink-0 grid-cols-[44px_minmax(54px,1fr)_44px_minmax(116px,1.3fr)] items-center gap-2 border-t border-text/10 bg-surface p-3">
                <button
                  onClick={handleCuePrevious}
                  disabled={selectedSlideIndex <= 0}
                  className="grid h-10 place-items-center rounded-lg border border-text/10 bg-text/[0.04] text-text/68 hover:bg-text/[0.08] hover:text-text disabled:opacity-40"
                >
                  <ChevronLeft size={16} />
                </button>
                <div className="text-center font-mono text-sm font-semibold text-text/76">
                  {generatedSlides.length === 0 ? '0 / 0' : `${selectedSlideIndex + 1} / ${generatedSlides.length}`}
                </div>
                <button
                  onClick={handleCueNext}
                  disabled={generatedSlides.length === 0 || selectedSlideIndex >= generatedSlides.length - 1}
                  className="grid h-10 place-items-center rounded-lg border border-text/10 bg-text/[0.04] text-text/68 hover:bg-text/[0.08] hover:text-text disabled:opacity-40"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  onClick={handleClearScreen}
                  className={`h-10 rounded-lg border px-3 text-sm font-semibold ${
                    isClear
                      ? 'border-rose-200 bg-rose-50 text-rose-700'
                      : 'border-text/10 bg-text/[0.04] text-text/76 hover:bg-text/[0.08] hover:text-text'
                  }`}
                >
                  {isClear ? t('biblePanel.cleared') : t('biblePanel.clearOnScreen')}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-text/10 bg-surface p-3 shadow-[0_12px_32px_rgba(var(--color-shadow-rgb),0.12)]">
              <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-text/52">{t('biblePanel.verseOnScreen')}</div>
              <div className="rounded-lg border border-primary/35 bg-primary/12 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-bold text-text">{buildBibleReference()}</div>
                    <div className="mt-2 text-sm leading-5 text-text/76">{selectedBibleVerses[0]?.text || t('biblePanel.selectVersePrompt')}</div>
                  </div>
                  <button
                    onClick={handleClearScreen}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-text/42 hover:bg-text/[0.08] hover:text-rose-500"
                    title={t('biblePanel.clearFromScreen')}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  onClick={handleGoLive}
                  disabled={!selectedPreviewSlide}
                  className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-black transition hover:brightness-105 disabled:opacity-40"
                >
                  <Send size={16} /> {t('biblePanel.showOnScreen')}
                </button>
                <button
                  onClick={() => void handleSaveToRundown()}
                  disabled={!selectedPreviewSlide}
                  className="flex h-12 items-center justify-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/12 text-sm font-bold text-emerald-500 transition hover:bg-emerald-500/18 disabled:opacity-40"
                >
                  <Plus size={16} /> {t('biblePanel.addToRundown')}
                </button>
              </div>
            </section>

            <section className="rounded-xl border border-text/10 bg-surface p-3 shadow-[0_12px_32px_rgba(var(--color-shadow-rgb),0.12)]">
              <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.14em] text-text/52">{t('biblePanel.activeRundown')}</div>
              <div className="flex items-center justify-between rounded-lg border border-text/10 bg-text/[0.04] p-3">
                <div>
                  <div className="font-bold text-text">{currentSchedule?.name || t('schedulePanel.quickRundown')}</div>
                  <div className="mt-1 text-xs text-text/52">{currentSchedule?.items.length || 0} item</div>
                </div>
                <button
                  onClick={() => setActiveView('songs')}
                  className="rounded-lg border border-text/10 bg-text/[0.04] px-3 py-2 text-sm font-semibold text-text/76 hover:bg-text/[0.08] hover:text-text"
                >
                  {t('biblePanel.openRundown')}
                </button>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
