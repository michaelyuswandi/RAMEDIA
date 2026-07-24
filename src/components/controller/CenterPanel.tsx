import { useState } from 'react';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Plus,
  Send,
  Image,
  AlignLeft,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useElementSize } from '../../hooks/useElementSize';
import { SlideRenderer } from '../common/SlideRenderer';
import { buildMediaVirtualSlides } from '../../core/utils/mediaSlides';
import { buildBibleVirtualSlides } from '../../core/utils/bibleSlides';
import { isQueueMedia } from '../../core/utils/pdf';
import MediaQueuePreview from './MediaQueuePreview';
import { SlideLabelBadge } from '../common/SlideLabelBadge';
import { useI18n } from '../../i18n';

type DisplayMode = 'thumbnail' | 'text';
type LayoutMode = 'grid' | 'list';
type ColumnCount = 2 | 3 | 4 | 5 | 6 | 7 | 8;

const LS_DISPLAY = 'cp_displayMode';
const LS_LAYOUT = 'cp_layoutMode';
const LS_COLS = 'cp_columnCount';

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

interface CenterPanelProps {
  onHide?: () => void;
}

export default function CenterPanel({ onHide }: CenterPanelProps) {
  const { t } = useI18n();
  const { currentSlide, previewSlide, goLive, setPreviewSlide } = usePresentationStore();
  const { outputWidth, outputHeight } = useSettingsStore();
  const { currentSchedule, selectedItemId, libraryPreviewSong, libraryPreviewMedia } = useScheduleStore();
  const { ref: containerRef, width: containerW, height: containerH } = useElementSize<HTMLDivElement>();
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);
  const [mediaPreviewTime, setMediaPreviewTime] = useState(0);

  // ── Display Controls ──────────────────────────────────────────────────────
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(() =>
    readLS<DisplayMode>(LS_DISPLAY, 'text')
  );
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() =>
    readLS<LayoutMode>(LS_LAYOUT, 'grid')
  );
  const [columnCount, setColumnCountState] = useState<ColumnCount>(() =>
    readLS<ColumnCount>(LS_COLS, 3)
  );

  const setDisplayMode = (m: DisplayMode) => {
    setDisplayModeState(m);
    localStorage.setItem(LS_DISPLAY, JSON.stringify(m));
  };
  const setLayoutMode = (m: LayoutMode) => {
    setLayoutModeState(m);
    localStorage.setItem(LS_LAYOUT, JSON.stringify(m));
  };
  const setColumnCount = (c: ColumnCount) => {
    setColumnCountState(c);
    localStorage.setItem(LS_COLS, JSON.stringify(c));
  };

  // ── Aspect ratio for preview box ─────────────────────────────────────────
  const targetAspect = outputWidth / outputHeight;
  const containerAspect = containerW / containerH;
  const isConstrainedByHeight = containerAspect > targetAspect;
  const boxStyle = isConstrainedByHeight
    ? { height: '100%', aspectRatio: targetAspect }
    : { width: '100%', aspectRatio: targetAspect };

  // ── Active slides ─────────────────────────────────────────────────────────
  const selectedItem = currentSchedule?.items.find((i) => i.id === selectedItemId);
  const previewMedia = selectedItem?.itemType === 'media' ? selectedItem.mediaData : libraryPreviewMedia;
  const isMediaQueue = isQueueMedia(previewMedia);
  const bibleSlides = selectedItem?.itemType === 'bible' ? buildBibleVirtualSlides(selectedItem as any) : [];

  let activeSlides = (selectedItem?.songData as any)?.slides || (libraryPreviewSong as any)?.slides || [];

  if (previewMedia) {
    activeSlides = buildMediaVirtualSlides(previewMedia);
  } else if (bibleSlides.length > 0) {
    activeSlides = bibleSlides as any;
  }

  // ── Media live slide ──────────────────────────────────────────────────────
  const mediaLiveSlide = previewMedia
    ? (() => {
        const baseSlide = buildMediaVirtualSlides(previewMedia)[0];
        if (!baseSlide) return null;
        const mediaStartTime = Math.max(0, mediaPreviewTime || 0);
        const liveToken = `${previewMedia.id}-${Math.round(mediaStartTime * 1000)}`;

        let parsedSettings: Record<string, unknown> = {};
        try {
          parsedSettings = previewMedia.playbackSettings ? JSON.parse(previewMedia.playbackSettings) : {};
        } catch {
          parsedSettings = {};
        }

        const normalizedSettings =
          parsedSettings.playback && typeof parsedSettings.playback === 'object'
            ? (parsedSettings.playback as Record<string, unknown>)
            : parsedSettings;

        const nextPlayback = { ...normalizedSettings, startTime: mediaStartTime };

        return {
          ...baseSlide,
          id: `virtual-media-live-${liveToken}`,
          layers: baseSlide.layers.map((layer) => ({
            ...layer,
            id: `${layer.id}-live-${liveToken}`,
            slideId: `virtual-media-live-${liveToken}`,
            style: JSON.stringify({ playbackSettings: nextPlayback }),
          })),
        };
      })()
    : null;

  // ── Column class ──────────────────────────────────────────────────────────
  const colClass =
    columnCount === 2
      ? 'grid-cols-2'
      : columnCount === 3
      ? 'grid-cols-3'
      : columnCount === 4
      ? 'grid-cols-4'
      : columnCount === 5
      ? 'grid-cols-5'
      : columnCount === 6
      ? 'grid-cols-6'
      : columnCount === 7
      ? 'grid-cols-7'
      : 'grid-cols-8';

  // ── Render single song slide card ─────────────────────────────────────────
  function renderSongCard(slide: any) {
    const isLive = currentSlide?.id === slide.id;
    const isPreview = previewSlide?.id === slide.id;

    const borderClass = isLive
      ? 'border-primary/45 bg-primary/10 shadow-[0_14px_30px_rgba(245,158,11,0.22)]'
      : isPreview
      ? 'border-info/40 bg-info/10 shadow-[0_12px_28px_rgba(88,213,247,0.18)]'
      : 'border-white/8 bg-white/[0.03] hover:border-white/18 hover:bg-white/[0.05]';

    // ── THUMBNAIL MODE ────────────────────────────────────────────────────
    if (displayMode === 'thumbnail') {
      return (
        <div
          key={slide.id}
          onClick={() => setPreviewSlide(slide)}
          onDoubleClick={() => goLive(slide)}
          className={`group relative cursor-pointer rounded-2xl border transition-all duration-150 overflow-hidden ${borderClass}`}
          style={{ aspectRatio: targetAspect }}
        >
          {/* Content */}
          <div className="absolute inset-0">
            {slide.type === 'media' ? (
              <SlideRenderer slide={slide} forceMuted={true} renderMode="thumbnail" />
            ) : slide.layers?.length > 0 ? (
              <SlideRenderer slide={slide} forceMuted={true} renderMode="thumbnail" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-black p-3 text-center">
                <p className={`line-clamp-4 text-[11px] font-medium leading-snug ${isLive || isPreview ? 'text-text' : 'text-text/72'}`}>
                  {slide.content}
                </p>
              </div>
            )}
          </div>

          {/* Section badge */}
          <SlideLabelBadge slide={slide} className="absolute left-2 top-2 z-10 px-2 py-0.5 text-[9px] tracking-[0.05em] shadow-sm" />

          {/* Live pulsing dot */}
          {isLive && (
            <div className="absolute right-2 top-2 z-10 flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
            </div>
          )}
        </div>
      );
    }

    // ── TEXT MODE ─────────────────────────────────────────────────────────
    return (
      <div
        key={slide.id}
        onClick={() => setPreviewSlide(slide)}
        onDoubleClick={() => goLive(slide)}
        className={`group relative cursor-pointer rounded-xl border px-3 py-2.5 transition-all duration-150 ${borderClass}`}
      >
        {/* Top row */}
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <SlideLabelBadge slide={slide} className="px-2 py-0.5 text-[9px] tracking-[0.05em]" />
          {isLive && (
            <div className="flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </div>
          )}
        </div>

        {/* Lyric text */}
        <p className={`line-clamp-5 text-[12px] leading-snug ${isLive || isPreview ? 'text-text font-medium' : 'text-text/72'}`}>
          {slide.content || '(empty)'}
        </p>
      </div>
    );
  }

  // ── Render list row ───────────────────────────────────────────────────────
  function renderSongRow(slide: any) {
    const isLive = currentSlide?.id === slide.id;
    const isPreview = previewSlide?.id === slide.id;

    const borderClass = isLive
      ? 'border-primary/45 bg-primary/10 shadow-[0_6px_16px_rgba(245,158,11,0.14)]'
      : isPreview
      ? 'border-info/40 bg-info/10 shadow-[0_6px_16px_rgba(88,213,247,0.12)]'
      : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]';

    return (
      <div
        key={slide.id}
        onClick={() => setPreviewSlide(slide)}
        onDoubleClick={() => goLive(slide)}
        className={`group flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-2.5 transition-all duration-150 ${borderClass}`}
      >
        {/* Badge */}
        <SlideLabelBadge slide={slide} className="mt-0.5 shrink-0 px-2 py-0.5 text-[9px] tracking-[0.05em]" />

        {/* Text */}
        <p className={`flex-1 line-clamp-2 text-[12px] leading-snug ${isLive || isPreview ? 'text-text font-medium' : 'text-text/70'}`}>
          {slide.content || '(empty)'}
        </p>

        {/* Live indicator */}
        {isLive && (
          <div className="mt-1 flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="panel-shell relative flex h-full flex-1 flex-col overflow-hidden">
      {/* ── Main Header ────────────────────────────────────────────────────── */}
      <div className="flex h-14 items-center justify-between border-b border-white/5 bg-black/10 px-4">
        <div />
        <div className="flex items-center gap-2">
          {!isMediaQueue && previewSlide && (
            <button
              onClick={() => goLive(previewSlide)}
              className="control-button-primary flex h-9 items-center gap-2 px-3 text-[11px] font-medium tracking-[0.01em]"
              title={t('center.pushToLive')}
            >
              <Send size={14} />
            </button>
          )}
          {!isMediaQueue && (
            <button
              onClick={() => setIsPreviewExpanded((c) => !c)}
              className={`flex h-9 items-center gap-2 px-3 text-[11px] font-medium tracking-[0.01em] ${
                isPreviewExpanded ? 'control-button-primary' : 'control-button'
              }`}
              title={t('center.togglePreview')}
            >
              <Eye size={14} />
              {isPreviewExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          {onHide && (
            <button
              onClick={onHide}
              className="control-button flex h-9 items-center gap-2 px-3 text-[11px] font-medium tracking-[0.01em]"
              title={t('center.hidePanel')}
            >
              <EyeOff size={14} />
            </button>
          )}
        </div>
      </div>

      {/* ── Live Preview Box ────────────────────────────────────────────────── */}
      {isPreviewExpanded && (
        <div className="border-b border-white/5 bg-black/25 px-4 py-4">
          <div
            ref={containerRef}
            className="surface-grid relative flex h-[240px] items-center justify-center overflow-hidden rounded-[22px] border border-white/6 bg-black/35 p-4"
          >
            <div
              className="relative flex items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-[0_18px_50px_rgba(0,0,0,0.32)] transition-all duration-150"
              style={boxStyle}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,213,247,0.14),transparent_30%),linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" />
              {previewSlide ? (
                <SlideRenderer slide={previewSlide as any} layers={(previewSlide as any).layers} renderMode="preview" />
              ) : (
                <div className="text-sm font-medium tracking-[0.08em] text-white/20">{t('center.noPreview')}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Content Area ────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white/[0.02]">
        {/* Song view sub-toolbar */}
        {!isMediaQueue && (
          <div className="flex items-center gap-2.5 border-b border-white/5 bg-black/15 px-3.5 py-2">
            {/* Label */}
            <div className="mr-3 text-[10px] font-bold uppercase tracking-[0.2em] text-text/60">{t('center.liveSlides')}</div>

            {/* Display Mode: Thumbnail / Text */}
            <div className="flex items-center rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
              <button
                onClick={() => setDisplayMode('thumbnail')}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium tracking-[0.03em] transition-all duration-150 ${
                  displayMode === 'thumbnail'
                    ? 'bg-primary text-black shadow-[0_4px_12px_rgba(245,158,11,0.25)]'
                    : 'text-text/50 hover:text-text'
                }`}
                title={t('center.thumbnailMode')}
              >
                <Image size={11} />
                {t('center.thumbnail')}
              </button>
              <button
                onClick={() => setDisplayMode('text')}
                className={`flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[10px] font-medium tracking-[0.03em] transition-all duration-150 ${
                  displayMode === 'text'
                    ? 'bg-primary text-black shadow-[0_4px_12px_rgba(245,158,11,0.25)]'
                    : 'text-text/50 hover:text-text'
                }`}
                title={t('center.textMode')}
              >
                <AlignLeft size={11} />
                {t('center.text')}
              </button>
            </div>

            {/* Layout Mode: Grid / List */}
            <div className="flex items-center rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
              <button
                onClick={() => setLayoutMode('grid')}
                className={`flex h-7 items-center justify-center rounded-md px-2 transition-all duration-150 ${
                  layoutMode === 'grid'
                    ? 'bg-info/20 text-info'
                    : 'text-text/45 hover:text-text'
                }`}
                title={t('center.gridLayout')}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                onClick={() => setLayoutMode('list')}
                className={`flex h-7 items-center justify-center rounded-md px-2 transition-all duration-150 ${
                  layoutMode === 'list'
                    ? 'bg-info/20 text-info'
                    : 'text-text/45 hover:text-text'
                }`}
                title={t('center.listLayout')}
              >
                <List size={13} />
              </button>
            </div>

            {/* Column Count: visible only in grid mode */}
            {layoutMode === 'grid' && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-text/30">{t('center.cols')}</span>
                <div className="flex items-center rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
                  {([2, 3, 4, 6, 8] as ColumnCount[]).map((n) => (
                    <button
                      key={n}
                      onClick={() => setColumnCount(n)}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold transition-all duration-150 ${
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

            {/* Drag bar label placeholder */}
            <div className="mx-auto hidden text-[9px] font-medium uppercase tracking-[0.2em] text-text/20 xl:block">
              {t('center.dragBarToResize')}
            </div>

            {/* Slide count */}
            <div className="ml-auto flex items-center gap-2 text-[10px] font-mono tracking-[0.06em] text-text/40">
              <span className="font-bold text-text/80">{activeSlides.length}</span>
              <span className="uppercase text-[9px] tracking-widest text-text/25">{t('center.slidesCount')}</span>
            </div>
          </div>
        )}

        {/* Scrollable grid/list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3.5">
          {isMediaQueue ? (
            <div className="mx-auto max-w-4xl">
              <MediaQueuePreview media={previewMedia} onPreviewTimeChange={setMediaPreviewTime} />
              {mediaLiveSlide && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => goLive(mediaLiveSlide as any)}
                    className="control-button-primary flex h-10 items-center gap-2 px-4 text-[11px] font-medium tracking-[0.01em]"
                    title={t('center.sendToLive')}
                  >
                    <Send size={14} />
                    {t('center.sendToLive')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              {activeSlides.length === 0 && (
                <div className="py-10 text-center text-text/30 text-xs">
                  {selectedItem
                    ? t('center.noSlidesAvailable')
                    : t('center.selectItemPrompt')}
                </div>
              )}

              {/* LIST mode */}
              {layoutMode === 'list' ? (
                <div className="flex flex-col gap-1.5">
                  {activeSlides.map((slide: any) => renderSongRow(slide))}
                </div>
              ) : (
                /* GRID mode */
                <div className={`grid ${colClass} gap-2.5 content-start`}>
                  {activeSlides.map((slide: any) => renderSongCard(slide))}

                  <button
                    className={`flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 bg-white/[0.02] text-text/28 transition-colors duration-150 hover:border-info/30 hover:bg-white/[0.05] hover:text-text/72 ${
                      displayMode === 'thumbnail' ? '' : 'min-h-[72px]'
                    }`}
                    style={displayMode === 'thumbnail' ? { aspectRatio: targetAspect } : {}}
                  >
                    <Plus size={20} />
                    <span className="text-[11px] font-medium tracking-[0.05em]">{t('center.newSlide')}</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
