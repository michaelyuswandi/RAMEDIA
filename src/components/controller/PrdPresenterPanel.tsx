import { useState, useEffect, useCallback, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import {
  ArrowLeft,
  Presentation,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Send,
  FileText,
  Search,
  RefreshCw,
  Monitor,
  Tv,
  LayoutGrid,
  List,
  MousePointer2,
  Maximize2,
  ZoomIn,
  ZoomOut,
  CircleOff,
  PanelTopClose,
  PenTool,
  Highlighter,
  Type,
  Undo2,
  Play,
  Pause,
  TimerReset,
  PencilLine,
  Sparkles,
  Upload,
  Trash2,
  Copy,
  Image as ImageIcon,
} from 'lucide-react';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import type { Media } from '../../electron/database/schema';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import { getPdfPlaybackSettings } from '../../core/utils/pdf';
import { buildMediaVirtualSlides } from '../../core/utils/mediaSlides';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import { useUIStore } from '../../core/stores/useUIStore';
import { PresentationAnnotationOverlay } from '../common/PresentationAnnotationOverlay';
import type { AnnotationPoint, SlideAnnotation, TransitionMode } from '../../core/models/types';
import { useSettingsStore } from '../../core/stores/useSettingsStore';

type ViewMode = 'grid' | 'list';
type PresenterTool = 'browse' | 'laser' | 'line' | 'pen' | 'highlighter' | 'text';
type ToolSize = 'sm' | 'md' | 'lg' | 'xl';

const INITIAL_OUTPUT_STATE = {
  isOpen: false,
  isFullscreen: false,
  openCount: 0,
  totalLocalOutputs: 0,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getThumbSrc(media: Media): string {
  return toRenderableMediaUrl(media.thumbnail || '');
}

const COLOR_SWATCHES = ['#0f172a', '#ef4444', '#f59e0b', '#facc15', '#22c55e', '#2563eb', '#7c3aed'];

const TOOL_WIDTHS: Record<ToolSize, { line: number; pen: number; highlighter: number; text: number }> = {
  sm: { line: 0.45, pen: 0.35, highlighter: 1.1, text: 14 },
  md: { line: 0.7, pen: 0.55, highlighter: 1.8, text: 18 },
  lg: { line: 1, pen: 0.85, highlighter: 2.4, text: 24 },
  xl: { line: 1.35, pen: 1.15, highlighter: 3.1, text: 30 },
};

function pointsDistance(a: AnnotationPoint, b: AnnotationPoint) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PrdPresenterPanel() {
  const setActiveView = useUIStore((state) => state.setActiveView);
  const {
    goLive,
    currentSlide,
    isBlack,
    isClear,
    isLogo,
    pointer,
    transitionMode,
    annotations,
    setBlack,
    setClear,
    setLogo,
    setPointerEnabled,
    updatePointer,
    hidePointer,
    setTransitionMode,
    addAnnotation,
    clearAnnotations,
    undoAnnotation,
  } = usePresentationStore();
  const logoOutput = useSettingsStore((state) => state.logoOutput);
  const { addItem, setSelectedItem, setLibraryPreviewMedia, presenterMedia, setPresenterMedia } = useScheduleStore();

  const [pdfList, setPdfList] = useState<Media[]>([]);
  const [selectedPdf, setSelectedPdf] = useState<Media | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isLoading, setIsLoading] = useState(false);
  const [outputState, setOutputState] = useState(INITIAL_OUTPUT_STATE);
  const [activeTool, setActiveTool] = useState<PresenterTool>('browse');
  const [autoSlideSeconds, setAutoSlideSeconds] = useState(5);
  const [isAutoSlideRunning, setIsAutoSlideRunning] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(1);
  const [columnCount, setColumnCount] = useState<number>(3);
  const [toolColor, setToolColor] = useState('#2563eb');
  const [toolSize, setToolSize] = useState<ToolSize>('md');
  const [draftAnnotation, setDraftAnnotation] = useState<SlideAnnotation | null>(null);
  const drawingRef = useRef<{ start: AnnotationPoint; points: AnnotationPoint[] } | null>(null);
  const draftAnnotationRef = useRef<SlideAnnotation | null>(null);
  const draftFrameRef = useRef<number | null>(null);

  // ── Load PDF list ──────────────────────────────────────────────────────────
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await ipcMediaService.getAll();
      const pdfs = items.filter((item) => item.mediaType === 'pdf');
      setPdfList(pdfs);
    } catch (err) {
      console.error('[PrdPresenterPanel] Failed to load PDFs', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (selectedPdf || pdfList.length === 0) return;
    selectPdf(pdfList[0]);
  }, [pdfList, selectedPdf]);

  useEffect(() => {
    if (!window.api) return;
    window.api.window.getOutputState().then(setOutputState).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!presenterMedia) return;

    setSelectedPdf(presenterMedia);
    setCurrentPage(1);
    setLibraryPreviewMedia(presenterMedia);
    setPresenterMedia(null);
  }, [presenterMedia, setLibraryPreviewMedia, setPresenterMedia]);

  // ── Select PDF ─────────────────────────────────────────────────────────────
  const selectPdf = (media: Media) => {
    setSelectedPdf(media);
    setCurrentPage(1);
    setLibraryPreviewMedia(media);
  };

  const importPdf = async () => {
    const imported = await ipcMediaService.importPdfFile();
    if (imported) {
      await refreshData();
      const nextPdf = Array.isArray(imported) ? imported[0] : imported;
      if (nextPdf?.id) {
        setSelectedPdf(nextPdf);
        setCurrentPage(1);
        setLibraryPreviewMedia(nextPdf);
      }
    }
  };

  const removeSelectedDeck = async () => {
    if (!selectedPdf) return;
    const confirmed = window.confirm(`Remove ${selectedPdf.filename}?`);
    if (!confirmed) return;
    await ipcMediaService.delete(selectedPdf.id);
    setSelectedPdf(null);
    setCurrentPage(1);
    await refreshData();
  };

  const duplicateSelectedDeck = async () => {
    if (!selectedPdf) return;
    const id = await ipcMediaService.create({
      ...selectedPdf,
      id: undefined,
      filename: `${selectedPdf.filename.replace(/\.pdf$/i, '')} Copy.pdf`,
      createdAt: undefined,
      updatedAt: undefined,
    });
    await refreshData();
    const items = await ipcMediaService.getAll();
    const duplicated = items.find((item) => item.id === id);
    if (duplicated) selectPdf(duplicated);
  };

  const addSelectedDeckToRundown = async () => {
    if (!selectedPdf) return;
    const itemId = await addItem({
      itemType: 'media',
      mediaId: selectedPdf.id,
      content: selectedPdf.filename,
      duration: Math.max(1, totalPages),
    });
    setSelectedItem(itemId);
  };

  // ── Page navigation ────────────────────────────────────────────────────────
  const pdfSettings = selectedPdf ? getPdfPlaybackSettings(selectedPdf) : null;
  const totalPages = pdfSettings ? pdfSettings.pageCount : 0;
  const pdfPageUrls = pdfSettings?.pageUrls || [];

  const goToPage = (page: number) => {
    const clamped = Math.min(Math.max(page, 1), totalPages);
    setCurrentPage(clamped);
  };

  const goLivePage = (page: number) => {
    if (!selectedPdf) return;
    const slides = buildMediaVirtualSlides(selectedPdf);
    const slide = slides[page - 1];
    if (slide) {
      setCurrentPage(page);
      goLive(slide as any);
    }
  };

  // ── Push current page to live ──────────────────────────────────────────────
  const pushToLive = () => {
    goLivePage(currentPage);
  };

  const isCurrentPageLive = currentSlide?.id === `virtual-pdf-${selectedPdf?.id}-${currentPage}`;

  // ── Keyboard navigation ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!selectedPdf) return;
      const target = e.target as HTMLElement | null;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      )
        return;

      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pushToLive();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToPage(1);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToPage(totalPages);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedPdf, currentPage, totalPages]);

  const filteredPdfs = pdfList.filter((p) =>
    p.filename.toLowerCase().includes(searchQuery.toLowerCase()),
  );
  const currentPreviewSlideId = selectedPdf ? `virtual-pdf-${selectedPdf.id}-${currentPage}` : '';
  const currentPageAnnotations = currentPreviewSlideId ? annotations[currentPreviewSlideId] || [] : [];

  const refreshOutputState = useCallback(async () => {
    if (!window.api) return;
    setOutputState(await window.api.window.getOutputState());
  }, []);

  const openOutput = useCallback(async () => {
    if (!window.api) return;
    await window.api.window.openOutput();
    await refreshOutputState();
  }, [refreshOutputState]);

  const toggleOutputFullscreen = useCallback(async () => {
    if (!window.api) return;
    await window.api.window.toggleOutputFullscreen();
    await refreshOutputState();
  }, [refreshOutputState]);

  const handlePointerMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!pointer.enabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    updatePointer(x, y, true);
  };

  const handlePointerLeave = () => {
    if (pointer.enabled) {
      hidePointer();
    }
  };

  const getRelativePoint = (event: ReactMouseEvent<HTMLDivElement>): AnnotationPoint => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1),
      y: Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1),
    };
  };

  const selectTool = (tool: PresenterTool) => {
    const nextTool = activeTool === tool ? 'browse' : tool;
    setActiveTool(nextTool);
    setPointerEnabled(nextTool === 'laser');
    if (nextTool !== 'laser') {
      hidePointer();
    }
    setDraftAnnotation(null);
    draftAnnotationRef.current = null;
    drawingRef.current = null;
  };

  const queueDraftAnnotation = (annotation: SlideAnnotation) => {
    draftAnnotationRef.current = annotation;
    if (draftFrameRef.current !== null) return;

    draftFrameRef.current = window.requestAnimationFrame(() => {
      draftFrameRef.current = null;
      setDraftAnnotation(draftAnnotationRef.current);
    });
  };

  const handleCanvasMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!selectedPdf || !currentPreviewSlideId) return;
    if (activeTool === 'browse' || activeTool === 'laser') return;
    event.preventDefault();
    const point = getRelativePoint(event);

    if (activeTool === 'text') {
      const text = window.prompt('Masukkan teks untuk slide ini:');
      if (text && text.trim()) {
        addAnnotation(currentPreviewSlideId, {
          id: crypto.randomUUID(),
          type: 'text',
          x: point.x,
          y: point.y,
          text: text.trim(),
          color: toolColor,
          size: TOOL_WIDTHS[toolSize].text,
        });
      }
      return;
    }

    drawingRef.current = { start: point, points: [point] };
    if (activeTool === 'line') {
      const annotation: SlideAnnotation = {
        id: 'draft-line',
        type: 'line',
        from: point,
        to: point,
        color: toolColor,
        width: TOOL_WIDTHS[toolSize].line,
      };
      queueDraftAnnotation(annotation);
      return;
    }

    const strokeTool = activeTool === 'highlighter' ? 'highlighter' : 'pen';
    const annotation: SlideAnnotation = {
      id: `draft-${strokeTool}`,
      type: strokeTool,
      points: [point],
      color: activeTool === 'highlighter' ? '#facc15' : toolColor,
      width: activeTool === 'highlighter' ? TOOL_WIDTHS[toolSize].highlighter : TOOL_WIDTHS[toolSize].pen,
    };
    queueDraftAnnotation(annotation);
  };

  const handleCanvasMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (activeTool === 'laser') {
      handlePointerMove(event);
      return;
    }

    if (!drawingRef.current) return;
    const point = getRelativePoint(event);
    const draft = draftAnnotationRef.current;
    if (!draft) return;

    if (draft.type === 'line') {
      queueDraftAnnotation({ ...draft, to: point });
      return;
    }

    if (draft.type === 'pen' || draft.type === 'highlighter') {
      const lastPoint = drawingRef.current.points[drawingRef.current.points.length - 1];
      if (lastPoint && pointsDistance(lastPoint, point) < 0.0035) {
        return;
      }
      const nextPoints = [...drawingRef.current.points, point];
      drawingRef.current.points = nextPoints;
      queueDraftAnnotation({ ...draft, points: nextPoints });
    }
  };

  const handleCanvasMouseUp = () => {
    const currentDraft = draftAnnotationRef.current;
    if (!drawingRef.current || !currentDraft || !currentPreviewSlideId) return;

    if (currentDraft.type === 'line') {
      addAnnotation(currentPreviewSlideId, { ...currentDraft, id: crypto.randomUUID() });
    } else if ((currentDraft.type === 'pen' || currentDraft.type === 'highlighter') && currentDraft.points.length > 1) {
      addAnnotation(currentPreviewSlideId, { ...currentDraft, id: crypto.randomUUID() });
    }

    drawingRef.current = null;
    draftAnnotationRef.current = null;
    if (draftFrameRef.current !== null) {
      window.cancelAnimationFrame(draftFrameRef.current);
      draftFrameRef.current = null;
    }
    setDraftAnnotation(null);
  };

  const handleCanvasMouseLeave = () => {
    handlePointerLeave();
    if (drawingRef.current) {
      handleCanvasMouseUp();
    }
  };

  const toggleBlack = () => {
    const next = !isBlack;
    setBlack(next);
    if (next && isClear) {
      setClear(false);
    }
  };

  const toggleClear = () => {
    const next = !isClear;
    setClear(next);
    if (next && isBlack) {
      setBlack(false);
    }
  };

  useEffect(() => {
    if (!isAutoSlideRunning || !selectedPdf || totalPages <= 1) return;

    const interval = window.setInterval(() => {
      const nextPage = currentPage + 1;
      if (nextPage > totalPages) {
        window.clearInterval(interval);
        setIsAutoSlideRunning(false);
        return;
      }
      goLivePage(nextPage);
    }, Math.max(1, autoSlideSeconds) * 1000);

    return () => window.clearInterval(interval);
  }, [isAutoSlideRunning, autoSlideSeconds, selectedPdf, totalPages, currentPage]);

  useEffect(() => {
    return () => {
      if (draftFrameRef.current !== null) {
        window.cancelAnimationFrame(draftFrameRef.current);
      }
    };
  }, []);

  // ── Grid page thumbnails ───────────────────────────────────────────────────
  const renderPageGrid = () => {
    if (!selectedPdf) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const colClass =
      columnCount === 2
        ? 'grid-cols-2'
        : columnCount === 3
        ? 'grid-cols-3'
        : columnCount === 4
        ? 'grid-cols-4'
        : columnCount === 6
        ? 'grid-cols-6'
        : 'grid-cols-8';

    return (
      <div className={`grid ${colClass} content-start gap-4 p-4`}>
        {pages.map((page) => {
          const isLive = currentSlide?.id === `virtual-pdf-${selectedPdf.id}-${page}`;
          const isCurrent = page === currentPage;
          return (
            <button
              key={page}
              onClick={() => goLivePage(page)}
              className={`group relative flex flex-col overflow-hidden rounded-xl border transition-all duration-150 text-left ${
                isLive
                  ? 'border-emerald-400/50 bg-emerald-500/10 shadow-[0_10px_24px_rgba(16,185,129,0.14)]'
                  : isCurrent
                  ? 'border-primary/50 bg-primary/10 shadow-[0_10px_24px_rgba(var(--color-primary-rgb),0.14)]'
                  : 'border-text/10 bg-surface hover:border-text/18 hover:bg-text/[0.03]'
              }`}
            >
              {/* Page preview canvas */}
              <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-text/[0.04]">
                {pdfPageUrls[page - 1] ? (
                  <img src={toRenderableMediaUrl(pdfPageUrls[page - 1])} className="w-full h-full object-contain" alt={`Page ${page}`} />
                ) : (
                   <span className="text-[10px] font-medium text-text/30">Page {page}</span>
                )}
              </div>

              {/* Page label */}
              <div
                className={`flex items-center justify-between px-1.5 py-1 text-[8px] font-semibold uppercase tracking-[0.08em] ${
                  isLive ? 'text-primary' : isCurrent ? 'text-info' : 'text-text/45'
                }`}
              >
                <span>P {page}</span>
                {isLive && (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                    Live
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // ── List page rows ─────────────────────────────────────────────────────────
  const renderPageList = () => {
    if (!selectedPdf) return null;
    const pages = Array.from({ length: totalPages }, (_, i) => i + 1);
    return (
      <div className="flex flex-col gap-2 p-4">
        {pages.map((page) => {
          const isLive = currentSlide?.id === `virtual-pdf-${selectedPdf.id}-${page}`;
          const isCurrent = page === currentPage;
          return (
            <button
              key={page}
              onClick={() => goLivePage(page)}
              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition-all duration-150 ${
                isLive
                  ? 'border-emerald-500/30 bg-emerald-500/10 shadow-[0_6px_16px_rgba(16,185,129,0.14)]'
                  : isCurrent
                  ? 'border-primary/30 bg-primary/10'
                  : 'border-text/10 bg-surface hover:border-text/15 hover:bg-text/[0.04]'
              }`}
            >
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.06em] ${
                  isLive ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-primary text-black' : 'bg-text/8 text-text/50'
                }`}
              >
                Page {page}
              </span>
              <span className={`flex-1 text-[11px] ${isLive || isCurrent ? 'text-text font-medium' : 'text-text/60'}`}>
                {selectedPdf.filename} — Page {page} / {totalPages}
              </span>
              {isLive && (
                <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-primary">
                  <span className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
                  Live
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="theme-scope absolute inset-0 z-40 flex flex-col border-t border-text/10 bg-background font-sans text-text">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex min-h-16 flex-wrap items-center gap-3 border-b border-text/10 bg-surface px-4 py-3">
        <div className="flex min-w-[280px] flex-1 flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setActiveView('songs')}
            className="control-button flex h-9 items-center gap-2 px-3 text-xs font-bold uppercase tracking-[0.12em]"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.22em] text-text/62">
            <Presentation size={16} />
            PDF Presenter
          </div>

          <div className="flex min-w-[190px] max-w-sm flex-1 items-center rounded-xl border border-text/10 bg-text/[0.03] px-3 transition-colors duration-150 focus-within:border-primary/45">
            <Search size={14} className="text-text/30" />
            <input
              className="w-full border-none bg-transparent px-3 py-3 text-sm text-text placeholder:text-text/30 focus:outline-none"
              placeholder="Search PDF decks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <button
            onClick={refreshData}
            disabled={isLoading}
            className="control-button flex h-9 items-center gap-2 px-3 text-xs font-medium uppercase tracking-[0.16em] disabled:opacity-50"
            title="Refresh deck list"
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>

        {selectedPdf && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage <= 1}
              className="control-button flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
              title="First Page"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="control-button flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
              title="Previous Page"
            >
              <ChevronLeft size={14} />
            </button>

            <div className="flex items-center gap-1 rounded-xl border border-text/10 bg-text/[0.04] px-2.5 py-1.5">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (!isNaN(v)) goToPage(v);
                }}
                className="w-10 bg-transparent text-center text-[12px] font-mono font-semibold text-text outline-none"
              />
              <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-text/30">/ {totalPages}</span>
            </div>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="control-button flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
              title="Next Page"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage >= totalPages}
              className="control-button flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
              title="Last Page"
            >
              <ChevronsRight size={14} />
            </button>

            <button
              onClick={pushToLive}
              className={`flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold uppercase tracking-[0.14em] transition-all duration-150 ${
                isCurrentPageLive
                  ? 'bg-primary text-black shadow-[0_6px_20px_rgba(245,158,11,0.35)]'
                  : 'control-button-primary'
              }`}
              title="Send current page to live"
            >
              {isCurrentPageLive ? <Monitor size={14} /> : <Send size={14} />}
              {isCurrentPageLive ? 'On Live' : 'Go Live'}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={toggleClear}
            className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
              isClear ? 'border-error bg-error text-white' : 'border-text/10 bg-text/[0.03] text-text/58 hover:bg-text/[0.06] hover:text-text'
            }`}
            title="Clear output"
          >
            <CircleOff size={14} />
            Clear
          </button>

          <button
            onClick={() => setLogo(!isLogo)}
            disabled={!logoOutput.mediaId}
            className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
              isLogo ? 'border-primary bg-primary text-black' : 'border-text/10 bg-text/[0.03] text-text/58 hover:bg-text/[0.06] hover:text-text'
            }`}
            title={logoOutput.mediaId ? 'Show Logo on second screen' : 'Configure Logo in Settings first'}
          >
            <ImageIcon size={14} />
            Logo
          </button>

          <button
            onClick={toggleBlack}
            className={`flex h-9 items-center gap-2 rounded-xl border px-3 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
              isBlack ? 'border-error bg-error text-white' : 'border-text/10 bg-text/[0.03] text-text/58 hover:bg-text/[0.06] hover:text-text'
            }`}
            title="Black output"
          >
            <PanelTopClose size={14} />
            Black
          </button>

          {window.api && (
            <>
              <button
                onClick={openOutput}
                className="control-button flex h-9 items-center gap-2 px-3 text-[11px] font-medium uppercase tracking-[0.12em]"
                title={outputState.isOpen ? 'Focus configured local outputs' : 'Open configured local outputs'}
              >
                <Tv size={14} />
                {outputState.isOpen ? 'Outputs' : 'Open'}
              </button>
              <button
                onClick={toggleOutputFullscreen}
                className="control-button flex h-9 w-9 items-center justify-center"
                title={outputState.isFullscreen ? 'Exit output fullscreen' : 'Fullscreen output'}
              >
                <Maximize2 size={14} />
              </button>
            </>
          )}

          <div
            className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${
              currentSlide
                ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500'
                : 'border-text/10 bg-text/[0.03] text-text/45'
            }`}
            title={currentSlide ? 'Output is currently showing live content' : 'No slide is live yet'}
          >
            <span className="relative flex h-2 w-2">
              {currentSlide && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              )}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${currentSlide ? 'bg-emerald-500' : 'bg-text/30'}`} />
            </span>
            On Air
          </div>
        </div>
      </div>

      {/* ── Body: 2-column split ─────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* ━━ Left: PDF Deck List ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex w-80 shrink-0 flex-col border-r border-text/10 bg-surface">
          <div className="flex items-center justify-between border-b border-text/10 px-4 py-3">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-text/48">
              PDF Decks
            </div>
            <button
              onClick={() => void importPdf()}
              className="inline-flex h-8 items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 text-xs font-bold text-primary hover:bg-primary/16"
            >
              <Upload size={14} />
              Import PDF
            </button>
          </div>
          <div className="flex-1 h-0 overflow-y-auto py-2">
            {filteredPdfs.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-text/25">
                <FileText size={28} />
                <span className="text-[10px] uppercase tracking-widest">
                  {pdfList.length === 0 ? 'No PDFs imported' : 'No results'}
                </span>
              </div>
            )}
            {filteredPdfs.map((pdf) => {
              const settings = getPdfPlaybackSettings(pdf);
              const isSelected = selectedPdf?.id === pdf.id;
              const thumbSrc = getThumbSrc(pdf);
              return (
                <button
                  key={pdf.id}
                  onClick={() => selectPdf(pdf)}
                  className={`group flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-150 ${
                    isSelected
                      ? 'mx-3 rounded-xl border border-primary/40 bg-primary/10 text-primary'
                      : 'mx-3 rounded-xl border border-transparent text-text/70 hover:border-text/10 hover:bg-text/[0.04] hover:text-text'
                  }`}
                >
                  {/* Thumbnail or icon */}
                  <div className="relative h-11 w-12 shrink-0 overflow-hidden rounded-lg border border-text/10 bg-text/[0.04]">
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={pdf.filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <FileText
                          size={16}
                          className={isSelected ? 'text-primary' : 'text-text/30'}
                        />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold leading-tight">{pdf.filename}</div>
                    <div
                      className={`mt-0.5 text-[9px] uppercase tracking-[0.1em] ${
                        isSelected ? 'text-primary/60' : 'text-text/35'
                      }`}
                    >
                      {settings.pageCount} pages
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-text/10 p-4">
            <div className="rounded-xl border border-text/10 bg-text/[0.03] p-4">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-text/45">Deck Information</div>
              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/35">File Name</div>
                  <div className="mt-1 truncate font-semibold text-text/76">{selectedPdf?.filename || '-'}</div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/35">Total Pages</div>
                    <div className="mt-1 font-semibold text-text/76">{totalPages || '-'}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/35">Imported</div>
                    <div className="mt-1 font-semibold text-text/76">{selectedPdf?.createdAt ? new Date(selectedPdf.createdAt).toLocaleDateString() : '-'}</div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => void removeSelectedDeck()}
                disabled={!selectedPdf}
                className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-error/20 bg-error/5 text-sm font-bold text-error transition hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={15} />
                Remove Deck
              </button>
            </div>
          </div>
        </div>

        {/* ━━ Right: Presenter Area ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {selectedPdf ? (
            <>
              {/* ── Presenter Header ────────────────────────────────────────── */}
              <div className="flex items-center gap-3 border-b border-text/10 bg-surface px-5 py-4">
                {/* Deck name */}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-extrabold text-text">{selectedPdf.filename}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-text/42">
                    Page {currentPage} of {totalPages} · PDF Deck
                  </div>
                </div>

                {/* View mode toggle */}
                <div className="flex items-center rounded-lg border border-text/10 bg-text/[0.04] p-0.5">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`flex h-7 items-center justify-center rounded-md px-2 transition-all duration-150 ${
                      viewMode === 'grid' ? 'bg-info/20 text-info' : 'text-text/45 hover:text-text'
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`flex h-7 items-center justify-center rounded-md px-2 transition-all duration-150 ${
                      viewMode === 'list' ? 'bg-info/20 text-info' : 'text-text/45 hover:text-text'
                    }`}
                    title="List View"
                  >
                    <List size={13} />
                  </button>
                </div>

                <div className="rounded-full border border-text/10 bg-text/[0.03] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-text/42">
                  {activeTool === 'browse' ? 'Browse Mode' : activeTool === 'laser' ? 'Pointer Active' : `${activeTool} Tool`}
                </div>
              </div>

              {/* ── Browser + Live Preview ───────────────────────────────────── */}
              <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* Slide browser */}
                <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-text/10 bg-background">
                  <div className="flex items-center justify-between border-b border-text/10 px-5 py-4">
                    <div>
                      <div className="text-[12px] font-extrabold uppercase tracking-[0.18em] text-primary">Slide Browser</div>
                      <div className="mt-1 text-xs text-text/58">Klik sekali untuk kirim slide ke live</div>
                    </div>
                    <div className="flex items-center gap-3">
                      {viewMode === 'grid' && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-text/40">Columns</span>
                          <div className="flex items-center rounded-lg border border-text/10 bg-text/[0.04] p-0.5">
                            {[2, 3, 4, 6, 8].map((n) => (
                              <button
                                key={n}
                                onClick={() => setColumnCount(n)}
                                className={`flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold transition-all duration-150 ${
                                  columnCount === n
                                    ? 'bg-info/20 text-info'
                                    : 'text-text/45 hover:text-text'
                                }`}
                              >
                                {n}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="rounded-full border border-text/10 bg-text/[0.03] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-text/40">
                        {totalPages} slides
                      </div>
                    </div>
                  </div>
                  <div className="flex-1 h-0 overflow-y-auto">
                    {viewMode === 'grid' ? renderPageGrid() : renderPageList()}
                  </div>
                </div>

                {/* Live preview */}
                <div className="flex w-[42%] min-w-[420px] flex-col bg-surface">
                  <div className="flex items-center justify-between border-b border-text/10 px-4 py-3">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45">On Air Preview</div>
                      <div className="mt-1 text-xs text-text/58">Halaman aktif untuk operator dan output</div>
                    </div>
                    <div
                      className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] ${
                        isCurrentPageLive
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
                          : 'border-text/10 bg-text/[0.03] text-text/38'
                      }`}
                    >
                      <span className="relative flex h-2 w-2">
                        {isCurrentPageLive && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                        )}
                        <span className={`relative inline-flex h-2 w-2 rounded-full ${isCurrentPageLive ? 'bg-emerald-500' : 'bg-text/30'}`} />
                      </span>
                      {isCurrentPageLive ? 'On Air' : 'Standby'}
                    </div>
                  </div>
                  <div
                    className={`relative flex items-center justify-center overflow-hidden bg-surface p-4 ${
                      pointer.enabled ? 'cursor-none' : activeTool !== 'browse' ? 'cursor-crosshair' : ''
                    }`}
                  >
                    {isCurrentPageLive && (
                      <div className="pointer-events-none absolute inset-0 z-10 border-l border-primary/35 shadow-[inset_0_0_60px_rgba(245,158,11,0.1)]" />
                    )}
                    <div className="absolute inset-x-8 top-5 h-10 rounded-full bg-primary/8 blur-2xl" />
                    <div
                      className="relative w-full max-w-full overflow-hidden rounded-xl border border-text/10 bg-black shadow-[0_18px_48px_rgba(var(--color-shadow-rgb),0.22)]"
                      style={{ aspectRatio: pdfSettings?.aspectRatio ?? 4 / 3 }}
                    >
                      {pdfPageUrls[currentPage - 1] ? (
                        <img
                          src={toRenderableMediaUrl(pdfPageUrls[currentPage - 1])}
                          className="h-full w-full object-contain"
                          style={{ transform: `scale(${previewZoom})`, transformOrigin: 'center center' }}
                          alt={`Page ${currentPage}`}
                        />
                      ) : (
                        <span className="text-xs font-medium text-white/20">Page {currentPage}</span>
                      )}

                      <PresentationAnnotationOverlay
                        annotations={draftAnnotation ? [...currentPageAnnotations, draftAnnotation] : currentPageAnnotations}
                      />

                      <div
                        className={`absolute inset-0 z-30 ${activeTool === 'browse' ? 'pointer-events-none' : 'pointer-events-auto'} ${
                          activeTool === 'laser' ? 'cursor-none' : activeTool !== 'browse' ? 'cursor-crosshair' : ''
                        }`}
                        onMouseDown={handleCanvasMouseDown}
                        onMouseMove={handleCanvasMouseMove}
                        onMouseUp={handleCanvasMouseUp}
                        onMouseLeave={handleCanvasMouseLeave}
                        onMouseEnter={(event) => {
                          if (activeTool === 'laser') {
                            handlePointerMove(event);
                          }
                        }}
                      />

                      {pointer.enabled && pointer.visible && (
                        <div
                          className="pointer-events-none absolute z-20"
                          style={{
                            left: `${pointer.x * 100}%`,
                            top: `${pointer.y * 100}%`,
                            transform: 'translate(-50%, -50%)',
                          }}
                        >
                          <div className="relative flex items-center justify-center">
                            <div className="absolute h-10 w-10 rounded-full bg-red-500/18 blur-md" />
                            <div className="absolute h-5 w-5 rounded-full border border-red-300/45 bg-red-500/10" />
                            <div className="h-3.5 w-3.5 rounded-full border border-red-100/85 bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.85)]" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-text/10 bg-surface px-4 py-2.5">
                    <span className="text-[10px] font-mono text-text/30">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.14em]">
                      <span className="text-text/34">Zoom {Math.round(previewZoom * 100)}%</span>
                      <span className={`${pointer.enabled ? 'text-info' : 'text-text/28'}`}>
                        {pointer.enabled ? 'Laser Ready' : 'Laser Off'}
                      </span>
                      <span className={`${isCurrentPageLive ? 'text-emerald-500' : 'text-text/25'}`}>
                        {isCurrentPageLive ? '● Live Output' : '○ Preview Only'}
                      </span>
                    </div>
                  </div>
                  <div className="border-t border-text/10 bg-surface px-4 py-3">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text/45">Presenter Tools</div>
                        <div className="mt-1 text-xs text-text/55">Marking, text, transisi, dan auto-slide untuk halaman aktif</div>
                      </div>
                      <div className="rounded-full border border-text/10 bg-text/[0.03] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-text/40">
                        {activeTool === 'browse'
                          ? 'Browse Mode'
                          : activeTool === 'laser'
                          ? 'Laser Active'
                          : `${activeTool} Tool`}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 rounded-xl border border-text/10 bg-text/[0.03] px-2 py-1">
                        <button
                          onClick={() => setPreviewZoom((zoom) => Math.max(1, Number((zoom - 0.1).toFixed(2))))}
                          className="control-button flex h-8 w-8 items-center justify-center"
                          title="Zoom out preview"
                        >
                          <ZoomOut size={14} />
                        </button>
                        <button
                          onClick={() => setPreviewZoom((zoom) => Math.min(2.5, Number((zoom + 0.1).toFixed(2))))}
                          className="control-button flex h-8 w-8 items-center justify-center"
                          title="Zoom in preview"
                        >
                          <ZoomIn size={14} />
                        </button>
                        <button
                          onClick={() => setPreviewZoom(1)}
                          className="control-button flex h-8 items-center px-2 text-[10px] font-medium uppercase tracking-[0.12em]"
                          title="Reset zoom"
                        >
                          100%
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'laser', icon: MousePointer2, label: 'Pointer' },
                          { id: 'pen', icon: PenTool, label: 'Pen' },
                          { id: 'highlighter', icon: Highlighter, label: 'Highlighter' },
                          { id: 'text', icon: Type, label: 'Text' },
                          { id: 'line', icon: PencilLine, label: 'Shapes' },
                        ].map((tool) => {
                          const Icon = tool.icon;
                          const isActive = activeTool === tool.id;
                          return (
                            <button
                              key={`${tool.id}-${tool.label}`}
                              onClick={() => selectTool(tool.id as PresenterTool)}
                              className={`flex h-14 min-w-[84px] flex-col items-center justify-center gap-1 rounded-lg border px-2 text-[11px] font-semibold transition-colors ${
                                isActive
                                  ? 'border-primary/45 bg-primary/12 text-primary'
                                  : 'border-text/10 bg-text/[0.03] text-text/58 hover:bg-text/[0.06] hover:text-text'
                              }`}
                              title={tool.label}
                            >
                              <Icon size={14} />
                              <span>{tool.label}</span>
                            </button>
                          );
                        })}
                        <button
                          onClick={() => currentPreviewSlideId && clearAnnotations(currentPreviewSlideId)}
                          disabled={!currentPageAnnotations.length}
                          className="flex h-14 min-w-[84px] flex-col items-center justify-center gap-1 rounded-lg border border-text/10 bg-text/[0.03] px-2 text-[11px] font-semibold text-text/58 transition hover:bg-text/[0.06] hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          <Sparkles size={14} />
                          Eraser
                        </button>
                      </div>

                      <button
                        onClick={() => selectTool('browse')}
                        disabled={activeTool === 'browse'}
                        className="flex h-14 min-w-[84px] flex-col items-center justify-center gap-1 rounded-lg border border-text/10 bg-text/[0.03] px-2 text-[11px] font-semibold text-text/58 transition hover:bg-text/[0.06] hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
                        title="Cancel active tool and return to browse mode"
                      >
                        <CircleOff size={14} />
                        Cancel
                      </button>

                      <div className="flex items-center gap-2 rounded-xl border border-text/10 bg-text/[0.03] px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/40">Color</span>
                        {COLOR_SWATCHES.map((color) => (
                          <button
                            key={color}
                            onClick={() => setToolColor(color)}
                            className={`h-5 w-5 rounded-md border transition ${
                              toolColor === color ? 'border-primary ring-2 ring-primary/25' : 'border-text/10'
                            }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-text/10 bg-text/[0.03] px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/40">Size</span>
                        {(['sm', 'md', 'lg', 'xl'] as ToolSize[]).map((size) => (
                          <button
                            key={size}
                            onClick={() => setToolSize(size)}
                            className={`grid h-6 w-6 place-items-center rounded-full border text-[10px] font-bold uppercase ${
                              toolSize === size
                                ? 'border-primary bg-primary/14 text-primary'
                                : 'border-text/10 bg-text/[0.04] text-text/52 hover:text-text'
                            }`}
                            title={`Tool size ${size}`}
                          >
                            {size[0]}
                          </button>
                        ))}
                      </div>

                      <button
                        onClick={() => currentPreviewSlideId && undoAnnotation(currentPreviewSlideId)}
                        disabled={!currentPageAnnotations.length}
                        className="control-button flex h-9 w-9 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
                        title="Undo last annotation"
                      >
                        <Undo2 size={14} />
                      </button>

                      <button
                        onClick={() => currentPreviewSlideId && clearAnnotations(currentPreviewSlideId)}
                        disabled={!currentPageAnnotations.length}
                        className="control-button flex h-9 items-center gap-2 px-3 text-[11px] font-medium uppercase tracking-[0.12em] disabled:cursor-not-allowed disabled:opacity-30"
                        title="Clear annotations"
                      >
                        <Sparkles size={14} />
                        Markings
                      </button>

                      <div className="flex items-center gap-2 rounded-xl border border-text/10 bg-text/[0.03] px-3 py-1.5">
                        <Sparkles size={14} className="text-text/42" />
                        <select
                          value={transitionMode}
                          onChange={(e) => setTransitionMode(e.target.value as TransitionMode)}
                          className="bg-transparent text-[11px] font-medium uppercase tracking-[0.12em] text-text outline-none"
                          title="Transition mode"
                        >
                          <option value="fade">Fade</option>
                          <option value="slide">Slide</option>
                          <option value="zoom">Zoom</option>
                          <option value="none">None</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-2 rounded-xl border border-text/10 bg-text/[0.03] px-2 py-1.5">
                        <button
                          onClick={() => setIsAutoSlideRunning((state) => !state)}
                          disabled={!selectedPdf || totalPages <= 1}
                          className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                            isAutoSlideRunning ? 'bg-primary text-black' : 'bg-text/[0.04] text-text/72 hover:text-text'
                          }`}
                          title="Toggle auto slide"
                        >
                          {isAutoSlideRunning ? <Pause size={14} /> : <Play size={14} />}
                          Auto
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={autoSlideSeconds}
                          onChange={(e) => setAutoSlideSeconds(Math.max(1, Number(e.target.value) || 1))}
                          className="w-12 bg-transparent text-center text-[12px] font-mono font-semibold text-text outline-none"
                          title="Auto slide interval in seconds"
                        />
                        <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-text/35">sec</span>
                        <button
                          onClick={() => {
                            setAutoSlideSeconds(5);
                            setIsAutoSlideRunning(false);
                          }}
                          className="control-button flex h-8 w-8 items-center justify-center"
                          title="Reset auto slide"
                        >
                          <TimerReset size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 border-t border-text/10 p-4">
                    <button
                      onClick={() => void addSelectedDeckToRundown()}
                      disabled={!selectedPdf}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-text/10 bg-text/[0.03] text-sm font-semibold text-text/76 hover:bg-text/[0.06] disabled:opacity-40"
                    >
                      <Send size={15} />
                      Add to Rundown
                    </button>
                    <button
                      onClick={() => void duplicateSelectedDeck()}
                      disabled={!selectedPdf}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-text/10 bg-text/[0.03] text-sm font-semibold text-text/76 hover:bg-text/[0.06] disabled:opacity-40"
                    >
                      <Copy size={15} />
                      Duplicate Deck
                    </button>
                    <button
                      onClick={() => void removeSelectedDeck()}
                      disabled={!selectedPdf}
                      className="flex h-10 items-center justify-center gap-2 rounded-lg border border-error/20 bg-error/5 text-sm font-semibold text-error hover:bg-error/10 disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                      Remove Deck
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* No PDF selected state */
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-text/25">
              <div className="relative">
                <div className="absolute -inset-6 rounded-full bg-text/[0.04] blur-xl" />
                <Presentation size={52} className="relative" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold tracking-[0.04em]">No Deck Selected</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-text/20">
                  Choose a PDF from the left panel
                </div>
              </div>
              {pdfList.length === 0 && (
                <div className="mt-2 rounded-xl border border-text/10 bg-text/[0.03] px-5 py-3 text-center text-[11px] text-text/35">
                  Import PDFs via the{' '}
                  <span className="font-semibold text-text/55">Media panel</span>
                  {' → '}
                  <span className="font-semibold text-text/55">Import PDF</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
