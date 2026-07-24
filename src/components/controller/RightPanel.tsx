import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { useEffect, useRef, useState } from 'react';
import { Eye, Play, SkipBack, SkipForward, Monitor, Image, AlignLeft, LayoutGrid, List } from 'lucide-react';
import { useElementSize } from '../../hooks/useElementSize';
import { LiveOutputSurface } from '../common/LiveOutputSurface';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import { buildMediaVirtualSlides } from '../../core/utils/mediaSlides';
import { buildBibleVirtualSlides } from '../../core/utils/bibleSlides';
import { isQueueMedia, parseMediaPlaybackSettings } from '../../core/utils/pdf';
import MediaQueuePreview from './MediaQueuePreview';
import { SlideLabelBadge } from '../common/SlideLabelBadge';
import type { Media } from '../../electron/database/schema';
import { SlideRenderer } from '../common/SlideRenderer';
import { LogoOutputSurface } from '../common/LogoOutputSurface';
import { useI18n } from '../../i18n';

interface RightPanelProps {
  onShowWorkspace?: () => void;
  isWorkspaceHidden?: boolean;
}

const INITIAL_OUTPUT_STATE = {
  isOpen: false,
  isFullscreen: false,
  openCount: 0,
  totalLocalOutputs: 0,
};

type DisplayMode = 'thumbnail' | 'text';
type LayoutMode = 'grid' | 'list';
type ColumnCount = 2 | 3 | 4 | 5 | 6 | 7 | 8;

const LS_DISPLAY = 'rightpanel_displayMode';
const LS_LAYOUT = 'rightpanel_layoutMode';
const LS_COLS = 'rightpanel_columnCount';

function readLS<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export default function RightPanel({ onShowWorkspace, isWorkspaceHidden = false }: RightPanelProps) {
  const { t } = useI18n();
  const { currentSlide, previewSlide, isBlack, isClear, isLogo, pointer, transitionMode, annotations, liveCapture, setBlack, setClear, setLogo, goLive, setPreviewSlide } = usePresentationStore();
  const { outputWidth, outputHeight, logoOutput } = useSettingsStore();
  const { currentSchedule, selectedItemId, libraryPreviewSong, libraryPreviewMedia } = useScheduleStore();
  const { ref: containerRef, width: containerW, height: containerH } = useElementSize<HTMLDivElement>();
  const { ref: splitRef, height: splitHeight } = useElementSize<HTMLDivElement>();
  const [outputState, setOutputState] = useState(INITIAL_OUTPUT_STATE);
  const [previewPanelHeight, setPreviewPanelHeight] = useState(320);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const resizeStateRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const [displayMode, setDisplayModeState] = useState<DisplayMode>(() =>
    readLS<DisplayMode>(LS_DISPLAY, 'text')
  );
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>(() =>
    readLS<LayoutMode>(LS_LAYOUT, 'grid')
  );
  const [columnCount, setColumnCountState] = useState<ColumnCount>(() =>
    readLS<ColumnCount>(LS_COLS, 2)
  );

  const targetAspect = outputWidth / outputHeight;
  const hasBounds = containerW > 0 && containerH > 0;

  let monitorWidth = containerW;
  let monitorHeight = containerW / targetAspect;

  if (hasBounds && monitorHeight > containerH) {
    monitorHeight = containerH;
    monitorWidth = containerH * targetAspect;
  }

  const boxStyle = hasBounds
    ? { width: `${monitorWidth}px`, height: `${monitorHeight}px`, maxWidth: '100%', maxHeight: '100%' }
    : { width: '100%', aspectRatio: targetAspect };

  const setDisplayMode = (mode: DisplayMode) => {
    setDisplayModeState(mode);
    localStorage.setItem(LS_DISPLAY, JSON.stringify(mode));
  };

  const setLayoutMode = (mode: LayoutMode) => {
    setLayoutModeState(mode);
    localStorage.setItem(LS_LAYOUT, JSON.stringify(mode));
  };

  const setColumnCount = (count: ColumnCount) => {
    setColumnCountState(count);
    localStorage.setItem(LS_COLS, JSON.stringify(count));
  };

  useEffect(() => {
    if (!window.api) return;
    window.api.window.getOutputState().then(setOutputState).catch(() => undefined);
  }, []);

  const openOutput = async () => {
    if (!window.api) return;
    await window.api.window.openOutput();
    setOutputState(await window.api.window.getOutputState());
  };

  // Fetch active slides from the actual selected item
  const selectedItem = currentSchedule?.items.find(i => i.id === selectedItemId);
  const previewMedia = selectedItem?.itemType === 'media' ? selectedItem.mediaData : libraryPreviewMedia;
  const bibleSlides = selectedItem?.itemType === 'bible' ? buildBibleVirtualSlides(selectedItem as any) : [];
  const liveMediaLayer = (currentSlide as any)?.layers?.find((layer: any) => layer.layerType === 'media');
  const liveMediaLayerStyle =
    typeof liveMediaLayer?.style === 'string'
      ? parseMediaPlaybackSettings(liveMediaLayer.style)
      : (liveMediaLayer?.style || {});
  const liveMediaFromSchedule = liveMediaLayer?.mediaId
    ? currentSchedule?.items.find((item) => item.mediaData?.id === liveMediaLayer.mediaId)?.mediaData
    : null;
  const liveMedia: Media | null = liveMediaLayer?.content
    ? {
        id: liveMediaLayer.mediaId || `live-media-${currentSlide?.id || 'unknown'}`,
        filename: liveMediaFromSchedule?.filename || currentSlide?.content || 'Live Media',
        filepath: liveMediaLayer.content,
        mediaType:
          liveMediaFromSchedule?.mediaType ||
          liveMediaLayerStyle.mediaType ||
          ((currentSlide?.sectionType || currentSlide?.label || '').toLowerCase() === 'video' ? 'video' : 'image'),
        mimeType: liveMediaFromSchedule?.mimeType || null,
        fileSize: liveMediaFromSchedule?.fileSize || null,
        duration: liveMediaFromSchedule?.duration || null,
        width: liveMediaFromSchedule?.width || null,
        height: liveMediaFromSchedule?.height || null,
        thumbnail: liveMediaFromSchedule?.thumbnail || null,
        folderId: liveMediaFromSchedule?.folderId || null,
        tags: liveMediaFromSchedule?.tags || null,
        playbackSettings:
          typeof liveMediaLayer.style === 'string'
            ? liveMediaLayer.style
            : liveMediaFromSchedule?.playbackSettings || null,
        createdAt: liveMediaFromSchedule?.createdAt || new Date().toISOString(),
      }
    : null;
  const isMediaLive = isQueueMedia(liveMedia);
  
  // Virtual Slides for Media (Same logic as CenterPanel)
  let activeSlides = (selectedItem?.songData as any)?.slides || (libraryPreviewSong as any)?.slides || [];
  
  if (previewMedia) {
    activeSlides = buildMediaVirtualSlides(previewMedia);
  } else if (bibleSlides.length > 0) {
    activeSlides = bibleSlides as any;
  }

  const currentIndex = currentSlide ? activeSlides.findIndex((slide: any) => slide.id === currentSlide.id) : -1;
  const previousSlide = currentIndex > 0 ? activeSlides[currentIndex - 1] : null;
  const nextSlide = currentIndex >= 0 && currentIndex < activeSlides.length - 1 ? activeSlides[currentIndex + 1] : null;
  const liveTarget = previewSlide;
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

  const activateSlide = (slide: any) => {
    setPreviewSlide(slide);
    goLive(slide);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if (isTyping || activeSlides.length === 0) return;

      if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
        if (previousSlide) {
          event.preventDefault();
          goLive(previousSlide as any);
        }
      } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
        if (nextSlide) {
          event.preventDefault();
          goLive(nextSlide as any);
        }
      } else if (event.key === 'Home') {
        event.preventDefault();
        goLive(activeSlides[0] as any);
      } else if (event.key === 'End') {
        event.preventDefault();
        goLive(activeSlides[activeSlides.length - 1] as any);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeSlides, goLive, nextSlide, previousSlide]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const current = resizeStateRef.current;
      if (!current) return;

      const deltaY = event.clientY - current.startY;
      const maxHeight = splitHeight > 0 ? Math.max(200, splitHeight - 162) : 520;
      const nextHeight = Math.max(200, Math.min(maxHeight, current.startHeight + deltaY));
      setPreviewPanelHeight(nextHeight);
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      setIsDraggingSplitter(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [splitHeight]);

  useEffect(() => {
    if (splitHeight <= 0) return;
    const maxHeight = Math.max(200, splitHeight - 162);
    setPreviewPanelHeight((current) => Math.min(current, maxHeight));
  }, [splitHeight]);

  const startResize = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDraggingSplitter(true);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    resizeStateRef.current = {
      startY: event.clientY,
      startHeight: previewPanelHeight,
    };
  };

  function renderTextRow(slide: any) {
    const isLive = currentSlide?.id === slide.id;
    const isPreview = previewSlide?.id === slide.id;
    const isPrevious = previousSlide?.id === slide.id;
    const isNext = nextSlide?.id === slide.id;

    return (
      <button
        key={slide.id}
        onClick={() => activateSlide(slide)}
        className={`flex w-full items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition-all duration-150 ${
          isLive
            ? 'border-primary/30 bg-primary/10 shadow-[0_10px_24px_rgba(245,158,11,0.12)]'
            : isPreview
            ? 'border-info/35 bg-info/10 shadow-[0_8px_20px_rgba(88,213,247,0.10)]'
            : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
        }`}
      >
        <SlideLabelBadge slide={slide} className="mt-0.5 shrink-0 px-2 py-0.5 text-[9px] tracking-[0.06em]" />

        <p className={`flex-1 line-clamp-3 text-[12px] leading-snug ${
          isLive || isPreview ? 'text-text font-medium' : 'text-text/70'
        }`}>
          {slide.content || '(empty)'}
        </p>

        <span className={`shrink-0 text-[9px] font-semibold uppercase tracking-[0.1em] ${
          isLive ? 'text-primary' : isPrevious ? 'text-text/34' : isNext ? 'text-info' : isPreview ? 'text-info/90' : 'text-transparent'
        }`}>
          {isLive ? 'Live' : isPrevious ? 'Prev' : isNext ? 'Next' : isPreview ? 'Cue' : '.'}
        </span>
      </button>
    );
  }

  function renderGridCard(slide: any) {
    const isLive = currentSlide?.id === slide.id;
    const isPreview = previewSlide?.id === slide.id;
    const isPrevious = previousSlide?.id === slide.id;
    const isNext = nextSlide?.id === slide.id;

    return (
      <button
        key={slide.id}
        onClick={() => activateSlide(slide)}
        className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-150 ${
          isLive
            ? 'border-primary/35 bg-primary/10 shadow-[0_14px_30px_rgba(245,158,11,0.16)]'
            : isPreview
            ? 'border-info/35 bg-info/10 shadow-[0_12px_26px_rgba(88,213,247,0.12)]'
            : 'border-white/8 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]'
        }`}
      >
        {displayMode === 'thumbnail' ? (
          <>
            <div className="aspect-[16/7.8] bg-black p-1.5">
              <div className="relative h-full overflow-hidden rounded-[16px] border border-white/8 bg-black">
                {(slide.type === 'media' || slide.layers?.length > 0) ? (
                  <SlideRenderer slide={slide} forceMuted={true} renderMode="thumbnail" />
                ) : (
                  <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(88,213,247,0.12),transparent_35%),linear-gradient(180deg,#05070A,#000)] px-3 text-center">
                    <p className={`line-clamp-4 whitespace-pre-line text-[11px] font-semibold leading-snug ${
                      isLive || isPreview ? 'text-text' : 'text-text/78'
                    }`}>
                      {slide.content || '(empty)'}
                    </p>
                  </div>
                )}
                <SlideLabelBadge slide={slide} className="absolute left-1.5 top-1.5 px-1.5 py-0.5 text-[7px] tracking-[0.08em]" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/6 px-2.5 py-1.5">
              <span className={`text-[8px] font-semibold uppercase tracking-[0.08em] ${
                isLive ? 'text-primary' : isPreview ? 'text-info' : 'text-text/42'
              }`}>
                <SlideLabelBadge slide={slide} className="px-1.5 py-0.5 text-[8px] tracking-[0.08em]" />
              </span>
              <span className={`text-[8px] font-semibold uppercase tracking-[0.08em] ${
                isLive ? 'text-primary' : isPrevious ? 'text-text/34' : isNext ? 'text-info' : isPreview ? 'text-info/90' : 'text-transparent'
              }`}>
                {isLive ? 'Live' : isPrevious ? 'Prev' : isNext ? 'Next' : isPreview ? 'Cue' : '.'}
              </span>
            </div>
          </>
        ) : (
          <div className="p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <SlideLabelBadge slide={slide} className="px-2 py-0.5 text-[9px] tracking-[0.06em]" />
              <span className={`text-[9px] font-semibold uppercase tracking-[0.1em] ${
                isLive ? 'text-primary' : isPrevious ? 'text-text/34' : isNext ? 'text-info' : isPreview ? 'text-info/90' : 'text-transparent'
              }`}>
                {isLive ? 'Live' : isPrevious ? 'Prev' : isNext ? 'Next' : isPreview ? 'Cue' : '.'}
              </span>
            </div>
            <p className={`line-clamp-5 text-[12px] leading-snug ${
              isLive || isPreview ? 'text-text font-medium' : 'text-text/72'
            }`}>
              {slide.content || '(empty)'}
            </p>
          </div>
        )}
      </button>
    );
  }

  return (
    <div className="panel-shell z-20 flex h-full min-h-0 min-w-[250px] flex-1 flex-col overflow-hidden border-l border-text/5">
       {/* 1. Live Monitor Header */}
       <div className="flex items-center justify-between border-b border-text/5 bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center gap-2">
             {isWorkspaceHidden && onShowWorkspace && (
              <button
                onClick={onShowWorkspace}
                className="control-button flex items-center gap-2 px-3 py-2 text-[10px] font-medium tracking-[0.04em]"
              >
                <Eye size={14} />
                {t('rightPanel.showWorkspace')}
              </button>
            )}
            <span className="status-chip border-error/25 bg-error/10 text-error">
               <span className="flex h-1.5 w-1.5 relative">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75"></span>
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-error"></span>
               </span>
               {t('rightPanel.onAir')}
            </span>
            <button
              onClick={() => setClear(!isClear)}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors duration-150 ${
                isClear ? 'border-error bg-error text-white' : 'border-white/10 bg-white/[0.03] text-text/58 hover:text-text'
              }`}
            >
              {t('rightPanel.clear')}
            </button>
            <button
              onClick={() => setLogo(!isLogo)}
              disabled={!logoOutput.mediaId}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-35 ${
                isLogo ? 'border-primary bg-primary text-black' : 'border-white/10 bg-white/[0.03] text-text/58 hover:text-text'
              }`}
              title={logoOutput.mediaId ? t('rightPanel.showLogoHint') : t('rightPanel.configLogoHint')}
            >
              {t('rightPanel.logo')}
            </button>
            <button
              onClick={() => setBlack(!isBlack)}
              className={`rounded-lg border px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] transition-colors duration-150 ${
                isBlack ? 'border-error bg-error text-white' : 'border-white/10 bg-white/[0.03] text-text/58 hover:text-text'
              }`}
            >
              {t('rightPanel.black')}
            </button>
            <button
              onClick={() => liveTarget ? goLive(liveTarget) : null}
              className="control-button-primary flex h-8 items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-[0.12em]"
            >
              <Play fill="currentColor" className="text-black" size={13} />
              <span className="text-black">{t('rightPanel.goLive')}</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {window.api ? (
              <button
                onClick={openOutput}
                className="rounded-lg border border-text/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium tracking-[0.04em] text-text/60 transition-colors duration-150 hover:border-primary/25 hover:text-text"
              >
                {outputState.isOpen ? t('rightPanel.outputsOn') : t('rightPanel.openOutputs')}
              </button>
            ) : (
              <Monitor size={12} className="text-text/30" />
            )}
          </div>
       </div>

       {isMediaLive && liveMedia ? (
         <div className="min-h-0 flex-1 overflow-y-auto bg-white/[0.02] p-4">
           <div className="mx-auto max-w-4xl">
             <MediaQueuePreview media={liveMedia} variant="live" />
           </div>
         </div>
       ) : (
         <div
           ref={splitRef}
           className="min-h-0 flex-1 overflow-hidden"
           style={{ display: 'grid', gridTemplateRows: `${previewPanelHeight}px 12px minmax(150px, 1fr)` }}
         >
           <div ref={containerRef} className="surface-grid relative flex min-h-0 items-center justify-center overflow-hidden bg-black p-4">
           <div 
              className="relative flex items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-black transition-all duration-150"
              style={boxStyle} 
            >
              {isLogo ? (
                <LogoOutputSurface settings={logoOutput} showStatus />
              ) : (
                <LiveOutputSurface
                  currentSlide={currentSlide}
                  isBlack={isBlack}
                  isClear={isClear}
                  pointer={pointer}
                  annotations={annotations}
                  transitionMode={transitionMode}
                  liveCapture={liveCapture}
                  mode="preview"
                />
              )}
              </div>
           </div>

           <div
             onMouseDown={startResize}
             className={`flex cursor-row-resize select-none items-center justify-center border-y border-text/5 transition-colors duration-150 ${
               isDraggingSplitter ? 'bg-primary/25' : 'bg-black/35 hover:bg-primary/25'
             }`}
           >
             <div className="h-px w-16 rounded-full bg-white/15 hover:bg-white/40"></div>
           </div>

           <div className="flex min-h-0 min-h-[150px] flex-col overflow-hidden bg-white/[0.02]">
              <div className="flex items-center justify-between border-b border-text/5 bg-black/10 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-text/35">
                <span>{t('center.liveSlides')}</span>
                <span className="font-mono tracking-[0.04em] text-text/28">{t('center.dragBarToResize')}</span>
              </div>
              <div className="flex items-center gap-2.5 border-b border-white/5 bg-black/10 px-3 py-2">
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

                <div className="flex items-center rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
                  <button
                    onClick={() => setLayoutMode('grid')}
                    className={`flex h-7 items-center justify-center rounded-md px-2 transition-all duration-150 ${
                      layoutMode === 'grid' ? 'bg-info/20 text-info' : 'text-text/45 hover:text-text'
                    }`}
                    title={t('center.gridLayout')}
                  >
                    <LayoutGrid size={13} />
                  </button>
                  <button
                    onClick={() => setLayoutMode('list')}
                    className={`flex h-7 items-center justify-center rounded-md px-2 transition-all duration-150 ${
                      layoutMode === 'list' ? 'bg-info/20 text-info' : 'text-text/45 hover:text-text'
                    }`}
                    title={t('center.listLayout')}
                  >
                    <List size={13} />
                  </button>
                </div>

                {layoutMode === 'grid' && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-medium uppercase tracking-[0.12em] text-text/30">{t('center.cols')}</span>
                    <div className="flex items-center rounded-lg border border-white/8 bg-white/[0.04] p-0.5">
                      {([2, 3, 4, 6, 8] as ColumnCount[]).map((n) => (
                        <button
                          key={n}
                          onClick={() => setColumnCount(n)}
                          className={`flex h-7 w-7 items-center justify-center rounded-md text-[11px] font-semibold transition-all duration-150 ${
                            columnCount === n ? 'bg-info/20 text-info' : 'text-text/45 hover:text-text'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => previousSlide ? goLive(previousSlide as any) : null}
                    disabled={!previousSlide}
                    className="control-button flex h-7 w-7 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
                    title={t('rightPanel.previous')}
                  >
                    <SkipBack size={13} />
                  </button>
                  <button
                    onClick={() => nextSlide ? goLive(nextSlide as any) : null}
                    disabled={!nextSlide}
                    className="control-button flex h-7 w-7 items-center justify-center disabled:cursor-not-allowed disabled:opacity-30"
                    title={t('rightPanel.next')}
                  >
                    <SkipForward size={13} />
                  </button>
                </div>

                <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono tracking-[0.06em] text-text/40">
                  <span className="font-bold text-text/80">{activeSlides.length}</span>
                  <span className="uppercase text-[8px] tracking-widest text-text/25">{t('center.slidesCount')}</span>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
                {activeSlides.length === 0 && (
                  <div className="py-10 text-center text-text/20 text-[10px] uppercase tracking-widest">
                    {t('rightPanel.noContentSelected')}
                  </div>
                )}

                {activeSlides.length > 0 && layoutMode === 'list' && (
                  <div className="space-y-2">
                    {activeSlides.map((slide: any) => renderTextRow(slide))}
                  </div>
                )}

                {activeSlides.length > 0 && layoutMode === 'grid' && (
                  <div className={`grid ${colClass} gap-2.5 content-start`}>
                    {activeSlides.map((slide: any) => renderGridCard(slide))}
                  </div>
                )}
              </div>
           </div>
         </div>
       )}
    </div>
  );
}
