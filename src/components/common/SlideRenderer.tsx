import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { SlideLayer } from '../../electron/database/schema';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { DEFAULT_OUTPUT_SETTINGS } from '../../core/models/outputSettings';
import type { MediaPlaybackState } from '../../core/models/types';
import { getVideoPlaybackIdForLayer, normalizeVideoPlaybackTime } from '../../core/utils/videoLayers';
import YouTubeLayer from './YouTubeLayer';


// Define a flexible interface that covers both DB Slide and Store Slide
interface RenderableSlide {
  id: string;
  content?: string | null;
  layers?: SlideLayer[];
  style?: Record<string, any>;
  [key: string]: any; // Allow other properties
}

interface SlideRendererProps {
  slide?: RenderableSlide | null;
  layers?: SlideLayer[];
  width?: number; // Optional reference width for scaling if needed
  height?: number;
  renderMode?: 'output' | 'preview' | 'thumbnail';
  
  // Editor Props
  isEditor?: boolean;
  selectedLayerId?: string | null;
  forceMuted?: boolean;
  mediaPlayback?: MediaPlaybackState | null;
  hideText?: boolean;
  transparentBackground?: boolean;
  onLayerSelect?: (id: string) => void;
}

function resolveMediaSource(layer: SlideLayer, styleObj: Record<string, any>) {
  const source = styleObj.source || layer.content || '';
  if (typeof source !== 'string') return '';

  const isBrowserOutputHttpRuntime =
    typeof window !== 'undefined'
    && !window.api
    && (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    && window.location.pathname.startsWith('/browser-output');
  if (isBrowserOutputHttpRuntime && layer.mediaId && styleObj.mediaType !== 'pdf' && styleObj.mediaType !== 'youtube') {
    return `/api/media/${encodeURIComponent(layer.mediaId)}/stream`;
  }

  return toRenderableMediaUrl(source);
}

function requestVideoPlayback(el: HTMLVideoElement) {
  const play = () => {
    void el.play().catch(() => undefined);
  };

  if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    play();
    return;
  }

  el.oncanplay = play;
}

interface VideoLayerProps {
  source: string;
  objectFit: string;
  renderMode: 'output' | 'preview' | 'thumbnail';
  forceMuted: boolean;
  startTime: number;
  endTime: number;
  volume: number;
  speed: number;
  baseBehavior: string;
  controlledPlayback: MediaPlaybackState | null;
}

function VideoLayer({
  source,
  objectFit,
  renderMode,
  forceMuted,
  startTime,
  endTime,
  volume,
  speed,
  baseBehavior,
  controlledPlayback,
}: VideoLayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const initializedSourceRef = useRef<string | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const commandId = controlledPlayback?.commandId || null;
  const behavior = controlledPlayback?.behavior || baseBehavior;
  const shouldAutoplay = renderMode === 'output' && !controlledPlayback;
  const effectiveMuted = forceMuted || renderMode !== 'output' || (controlledPlayback ? controlledPlayback.volume === 0 : volume === 0);

  const applyPendingSeek = () => {
    const node = videoRef.current;
    const pendingSeek = pendingSeekRef.current;
    if (!node || pendingSeek === null || node.readyState < HTMLMediaElement.HAVE_METADATA) return;

    const mediaDuration = Number(node.duration);
    const maxTime = endTime > 0
      ? endTime
      : Number.isFinite(mediaDuration) && mediaDuration > 0
        ? mediaDuration
        : 0;
    const targetTime = normalizeVideoPlaybackTime(pendingSeek, startTime, maxTime, behavior);

    try {
      node.currentTime = targetTime;
      pendingSeekRef.current = null;
    } catch {
      pendingSeekRef.current = targetTime;
    }
  };

  const queueSeek = (targetTime: number) => {
    const node = videoRef.current;
    if (!node || !Number.isFinite(targetTime)) return;

    pendingSeekRef.current = targetTime;
    if (node.readyState >= HTMLMediaElement.HAVE_METADATA) {
      applyPendingSeek();
    } else {
      node.load();
    }
  };

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;

    if (initializedSourceRef.current !== source) {
      initializedSourceRef.current = source;
      queueSeek(startTime);
      node.volume = Math.max(0, Math.min(1, volume));
      node.playbackRate = speed || 1;
      node.style.opacity = '1';
      if (renderMode !== 'output') node.pause();
    }
  }, [renderMode, source, speed, startTime, volume]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node || !controlledPlayback) return;

    const elapsed = controlledPlayback.status === 'playing'
      ? ((Date.now() - controlledPlayback.updatedAt) / 1000) * (controlledPlayback.playbackRate || 1)
      : 0;
    const targetTime = controlledPlayback.status === 'stopped'
      ? startTime
      : Math.max(0, controlledPlayback.currentTime + elapsed);

    queueSeek(targetTime);

    node.style.opacity = '1';
    node.volume = Math.max(0, Math.min(1, controlledPlayback.volume / 100));
    node.muted = effectiveMuted;
    node.playbackRate = controlledPlayback.playbackRate || speed || 1;

    if (controlledPlayback.status === 'playing') {
      requestVideoPlayback(node);
      return;
    }

    node.oncanplay = null;
    node.pause();
  }, [
    commandId,
    controlledPlayback?.currentTime,
    controlledPlayback?.playbackRate,
    controlledPlayback?.status,
    controlledPlayback?.updatedAt,
    controlledPlayback?.volume,
    effectiveMuted,
    speed,
    startTime,
  ]);

  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    node.muted = effectiveMuted;
  }, [effectiveMuted]);

  const handleTimeUpdate = () => {
    const node = videoRef.current;
    if (!node) return;

    if (endTime > 0 && node.currentTime >= endTime) {
      if (behavior === 'loop') {
        node.currentTime = startTime;
        void node.play().catch(() => undefined);
      } else if (behavior === 'stop') {
        node.pause();
        node.style.opacity = '0';
      } else if (behavior === 'hold') {
        node.pause();
        node.currentTime = endTime;
      }
    } else if (endTime === 0 && node.duration && node.currentTime >= node.duration && behavior === 'loop') {
      node.currentTime = startTime;
      void node.play().catch(() => undefined);
    }
  };

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full transition-opacity duration-300"
      style={{ objectFit: objectFit as any }}
      src={source}
      autoPlay={shouldAutoplay}
      muted={effectiveMuted}
      playsInline
      preload="auto"
      onLoadedMetadata={applyPendingSeek}
      onCanPlay={applyPendingSeek}
      onTimeUpdate={handleTimeUpdate}
    />
  );
}

export function SlideRenderer({ 
  slide, 
  layers, 
  isEditor = false, 
  selectedLayerId,
  onLayerSelect,
  forceMuted = false,
  mediaPlayback = null,
  hideText = false,
  transparentBackground = false,
  renderMode = 'output'
}: SlideRendererProps) {
  
  const defaultSongStyle = useSettingsStore(state => state.defaultSongStyle) || DEFAULT_OUTPUT_SETTINGS.defaultSongStyle!;
  
  // If no layers provided, try to use slide.layers or fallback to simple content
  let renderLayers: SlideLayer[] = layers || (slide && slide.layers) || [];
  
  // Fallback: If no layers exist but we have content, create a virtual text layer
  if (renderLayers.length === 0 && slide?.content) {
    const slideStyle = slide.style || {};
    // Give priority to defaultSongStyle, but allow override from slideStyle if provided
    const horizontalAlign = slideStyle.textAlign || defaultSongStyle.textAlign;
    const x = slideStyle.x ?? defaultSongStyle.x;
    const y = slideStyle.y ?? defaultSongStyle.y;
    const scale = slideStyle.scale ?? defaultSongStyle.scale;

    renderLayers = [
      {
        id: 'virtual-base',
        slideId: slide.id,
        layerType: 'base',
        layerOrder: 1,
        content: slideStyle.background || defaultSongStyle.backgroundColor,
        visible: true,
        opacity: 1,
        mediaId: defaultSongStyle.backgroundMode === 'media' ? defaultSongStyle.backgroundMediaId : null,
        style: JSON.stringify({
           backgroundType: defaultSongStyle.backgroundMode,
           backgroundValue: slideStyle.background || defaultSongStyle.backgroundColor,
           mediaType: defaultSongStyle.backgroundMode === 'media' && defaultSongStyle.backgroundMediaId ? 'image' : null
        }),
        transition: null
      },
      {
        id: 'virtual-text',
        slideId: slide.id,
        layerType: 'text',
        layerOrder: 2,
        content: slide.content,
        visible: true,
        opacity: 1,
        mediaId: null,
        style: JSON.stringify({
          x,
          y,
          rotation: slideStyle.rotation || 0,
          sizingMode: slideStyle.sizingMode || 'auto',
          boxWidth: slideStyle.boxWidth ?? defaultSongStyle.boxWidth,
          boxHeight: slideStyle.boxHeight ?? defaultSongStyle.boxHeight,
          allowWrap: slideStyle.allowWrap ?? defaultSongStyle.allowWrap,
          scale: Number.isFinite(scale) && scale > 0 ? scale : 1,
          color: slideStyle.color || defaultSongStyle.color,
          textAlign: horizontalAlign,
          fontFamily: slideStyle.fontFamily || defaultSongStyle.fontFamily,
          fontWeight: slideStyle.fontWeight || defaultSongStyle.fontWeight,
          fontStyle: slideStyle.fontStyle || defaultSongStyle.fontStyle,
          textDecoration: slideStyle.textDecoration || defaultSongStyle.textDecoration,
          shadow: slideStyle.shadow ?? defaultSongStyle.shadow
        }),
        transition: null
      }
    ];
  }

  // Sort layers: Base(1) -> Text(5)
  const sortedLayers = [...renderLayers].sort((a, b) => a.layerOrder - b.layerOrder);

  if (!slide && renderLayers.length === 0) {
     return <div className="text-[3cqw] font-medium tracking-[0.32em] text-white/20">NO SIGNAL</div>;
  }

  return (
    <div className="w-full h-full relative overflow-hidden" style={{ containerType: 'size' }}>
        {sortedLayers.map(layer => {
          if (layer.visible === false) return null;
          if (hideText && layer.layerType === 'text') return null;
          if (transparentBackground && (layer.layerType === 'base' || layer.layerType === 'background')) return null;

          // Safe style/transition parsing
          const styleObj = typeof layer.style === 'string' ? (tryParse(layer.style) || {}) : (layer.style || {});
          const transitionObj = typeof layer.transition === 'string' ? (tryParse(layer.transition) || {}) : (layer.transition || {});
          const layerSource = styleObj.source || layer.content || '';
          const layerMediaType = styleObj.mediaType || (/\.(mp4|mov|webm|m4v)$/i.test(String(layerSource)) ? 'video' : (/(youtube\.com|youtu\.be)/i.test(String(layerSource)) ? 'youtube' : null));
          const layerRenderKey = layerMediaType === 'video' || layerMediaType === 'youtube'
            ? `media-${layerMediaType}-${layer.layerType}-${layer.mediaId || encodeURIComponent(layerSource)}`
            : layer.id;

          // Animation Logic
          const entrance = transitionObj.entrance || 'none';
          const duration = transitionObj.duration ?? 0.4;
          const delay = transitionObj.delay ?? 0;

          const variants = {
            none: { opacity: 1, scale: 1, x: 0, y: 0 },
            fade: { opacity: [0, 1] },
            slideUp: { opacity: [0, 1], y: [20, 0] },
            slideDown: { opacity: [0, 1], y: [-20, 0] },
            zoomIn: { opacity: [0, 1], scale: [0.95, 1] },
          };

          const activeVariant = variants[entrance as keyof typeof variants] || variants.none;

          return (
            <motion.div 
              key={layerRenderKey}
              initial={entrance !== 'none' ? { opacity: 0 } : false}
              animate={activeVariant}
              transition={{ duration, delay, ease: 'easeOut' }}
              className={`absolute inset-0 ${isEditor ? 'cursor-pointer hover:bg-white/5' : ''}`}
              style={{ 
                opacity: layer.opacity ?? 1,
                pointerEvents: isEditor ? (layer.layerType === 'text' ? 'none' : (selectedLayerId === layer.id ? 'auto' : 'none')) : 'auto'
              }}
            >

               {/* TYPE: BASE */}
               {layer.layerType === 'base' && (
                 <div className="absolute inset-0" style={{ backgroundColor: layer.content || '#000' }} />
               )}

               {layer.layerType === 'overlay' && (() => {
                 const background = styleObj.background || layer.content || 'rgba(0, 0, 0, 0.35)';
                 const hasBounds = ['x', 'y', 'width', 'height'].some((key) => Number.isFinite(Number(styleObj[key])));
                 return (
                   <div
                     className={hasBounds ? 'absolute' : 'absolute inset-0'}
                     style={hasBounds ? {
                       background,
                       left: `${Number(styleObj.x) || 0}%`,
                       top: `${Number(styleObj.y) || 0}%`,
                       width: `${Number(styleObj.width) || 100}%`,
                       height: `${Number(styleObj.height) || 100}%`,
                     } : { background }}
                   />
                 );
               })()}

               {(layer.layerType === 'background' || layer.layerType === 'media') && (() => {
                 const source = resolveMediaSource(layer, styleObj);
                 if (!source) return null;

                 const mediaType = styleObj.mediaType || (/\.(mp4|mov|webm|m4v)$/i.test(source) ? 'video' : (/(youtube\.com|youtu\.be)/i.test(source) ? 'youtube' : 'image'));
                 const objectFit = styleObj.objectFit || (layer.layerType === 'background' ? 'cover' : 'contain');

                 if (mediaType === 'youtube') {
                   const layerPlaybackId = getVideoPlaybackIdForLayer(layer, styleObj.source || layer.content || '');
                   const controlledPlayback = mediaPlayback?.mediaId && mediaPlayback.mediaId === layerPlaybackId
                     ? mediaPlayback
                     : null;

                   return (
                     <YouTubeLayer
                       source={source}
                       objectFit={objectFit}
                       renderMode={renderMode}
                       forceMuted={forceMuted}
                       controlledPlayback={controlledPlayback}
                     />
                   );
                 }

                 if (mediaType === 'pdf') {
                   const pdfSettings = styleObj.pdf || {};
                   const pageNumber = Number(pdfSettings.pageNumber) || 1;
                   const pageUrls = pdfSettings.pageUrls || [];
                   const pageSrc = pageUrls[pageNumber - 1];

                   return (
                     <div className="absolute inset-0 flex items-center justify-center">
                       {pageSrc ? (
                         <img src={toRenderableMediaUrl(pageSrc)} className="w-full h-full" style={{ objectFit }} alt={`Page ${pageNumber}`} />
                       ) : (
                         <div className="text-white/20">Missing Cache for Page {pageNumber}</div>
                       )}
                     </div>
                   );
                 }

                 if (mediaType === 'video') {
                   const pb = styleObj.playbackSettings || {};
                   const startTime = pb.startTime || 0;
                   const endTime = pb.endTime || 0;
                   const baseBehavior = pb.behavior || 'loop';
                   const volume = pb.volume !== undefined ? pb.volume / 100 : 0;
                   const speed = pb.speed || 1.0;
                   const layerPlaybackId = getVideoPlaybackIdForLayer(layer, styleObj.source || layer.content || '');
                   const controlledPlayback = mediaPlayback?.mediaId && mediaPlayback.mediaId === layerPlaybackId
                     ? mediaPlayback
                     : null;

                   return (
                     <VideoLayer
                       source={source}
                       objectFit={objectFit}
                       renderMode={renderMode}
                       forceMuted={forceMuted}
                       startTime={startTime}
                       endTime={endTime}
                       volume={volume}
                       speed={speed}
                       baseBehavior={baseBehavior}
                       controlledPlayback={controlledPlayback}
                     />
                   );
                 }

                 return (
                   <img
                     className="absolute inset-0 h-full w-full"
                     style={{ objectFit }}
                     src={source}
                     alt=""
                   />
                 );
               })()}


               {/* TYPE: TEXT - Dual Mode: Auto-Size vs Fixed Box */}
               {layer.layerType === 'text' && (() => {
                  const sizingMode = styleObj.sizingMode || 'auto';
                  const isFixedBox = sizingMode === 'fixed';
                  const boxWidth = styleObj.boxWidth ?? 80; // % of container
                  const boxHeight = styleObj.boxHeight ?? 40;
                  const allowWrap = styleObj.allowWrap ?? true;
                  
                  // Use viewport-relative units for output browsers. Some remote browsers
                  // fail to paint container-query font sizes reliably on nested routes.
                  const scale = Number(styleObj.scale);
                  const textScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
                  const fontUnit = 'cqmin';
                  
                  // For perfect WYSIWYG scaling and line wrapping across all container sizes,
                  // we avoid clamping the minimum font size for output and preview modes.
                  // Only thumbnail mode retains a small clamp so it doesn't disappear completely.
                  const minFontSize = renderMode === 'thumbnail' ? 4 : 0;
                  const computedFontSize = `clamp(${minFontSize}px, ${5.4 * textScale}${fontUnit}, ${104 * textScale}px)`;
                  const textShadow = styleObj.shadow ? '0 5px 28px rgba(0,0,0,0.86)' : 'none';
                  const resizeHandles = isFixedBox
                    ? [
                        { id: 'resize-nw', cursor: 'nw-resize', pos: '-top-1.5 -left-1.5' },
                        { id: 'resize-n', cursor: 'n-resize', pos: '-top-1.5 left-1/2 -translate-x-1/2' },
                        { id: 'resize-ne', cursor: 'ne-resize', pos: '-top-1.5 -right-1.5' },
                        { id: 'resize-w', cursor: 'w-resize', pos: 'top-1/2 -left-1.5 -translate-y-1/2' },
                        { id: 'resize-e', cursor: 'e-resize', pos: 'top-1/2 -right-1.5 -translate-y-1/2' },
                        { id: 'resize-sw', cursor: 'sw-resize', pos: '-bottom-1.5 -left-1.5' },
                        { id: 'resize-s', cursor: 's-resize', pos: '-bottom-1.5 left-1/2 -translate-x-1/2' },
                        { id: 'resize-se', cursor: 'se-resize', pos: '-bottom-1.5 -right-1.5' },
                      ]
                    : [
                        { id: 'resize-w', cursor: 'w-resize', pos: 'top-1/2 -left-1.5 -translate-y-1/2' },
                        { id: 'resize-e', cursor: 'e-resize', pos: 'top-1/2 -right-1.5 -translate-y-1/2' },
                      ];

                  return (
                     <div 
                       className="absolute group/text"
                         style={{
                         left: `${styleObj.x ?? 50}%`,
                         top: `${styleObj.y ?? 50}%`,
                         transform: `translate(-50%, -50%) rotate(${styleObj.rotation || 0}deg)`,
                         transformOrigin: 'center center',
                         // Width is now respected in BOTH modes (allowing wrap)
                         width: `${boxWidth}%`,
                         // Height is only fixed in Fixed Mode. Auto mode grows.
                         height: isFixedBox ? `${boxHeight}%` : 'auto',
                         pointerEvents: isEditor ? 'auto' : 'none',
                       }}
                       onMouseDown={(e) => {
                         if (isEditor && onLayerSelect) {
                           e.stopPropagation();
                           onLayerSelect(layer.id);
                         }
                       }}
                     >
                        <div 
                           className={`relative ${isFixedBox ? 'flex h-full w-full items-center overflow-hidden' : allowWrap ? 'w-full' : 'inline-block'} ${isEditor && selectedLayerId === layer.id ? 'z-10' : ''}`}
                           style={{ textAlign: styleObj.textAlign || 'center' }}
                        >
                           <h1 
                             className={`font-bold text-white leading-tight select-none ${allowWrap ? 'whitespace-pre-wrap' : 'whitespace-nowrap'}`}
                             style={{ 
                               fontSize: computedFontSize,
                               color: styleObj.color || '#ffffff',
                               fontFamily: styleObj.fontFamily || 'Manrope, Inter, sans-serif',
                               fontWeight: styleObj.fontWeight || 600,
                               fontStyle: styleObj.fontStyle || 'normal',
                               textDecoration: styleObj.textDecoration || 'none',
                               lineHeight: styleObj.lineHeight || 1.15,
                               textShadow,
                               // Fixed mode: limit size to container
                               ...(isFixedBox && {
                                 width: '100%',
                                 maxWidth: '100%',
                                 maxHeight: '100%',
                                 overflow: 'hidden',
                               }),
                             }}
                           >
                              {layer.content || 'Text Layer'}
                           </h1>

                           {/* INTERNAL GIZMO HANDLES (Only in Editor Mode + Selected + Text) */}
                           {isEditor && selectedLayerId === layer.id && onLayerSelect && (
                           <>
                              {/* Selection Border */}
                              <div className="absolute -inset-2 border-2 border-primary/50 border-dashed pointer-events-none rounded-sm"></div>

                              {/* Interactive Move Zone (Invisible but captures drag) */}
                              <div 
                                 className="absolute -inset-2 cursor-move pointer-events-auto"
                                 onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onLayerSelect(layer.id);
                                    const event = new CustomEvent('editor-interact', { 
                                       detail: { type: 'move', clientX: e.clientX, clientY: e.clientY, layerId: layer.id } 
                                    });
                                    window.dispatchEvent(event);
                                 }}
                              ></div>

                              {/* Rotate Handle */}
                              <div 
                                 className="absolute -top-8 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border border-primary rounded-full cursor-grab active:cursor-grabbing hover:scale-125 transition-transform z-50 pointer-events-auto"
                                 onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onLayerSelect(layer.id);
                                    const event = new CustomEvent('editor-interact', { 
                                       detail: { type: 'rotate', clientX: e.clientX, clientY: e.clientY, layerId: layer.id } 
                                    });
                                    window.dispatchEvent(event);
                                 }}
                              />
                              
                              {/* 8-Point Resize Handles */}
                              {resizeHandles.map((handle) => (
                                 <div 
                                    key={handle.id}
                                    className={`absolute w-3 h-3 bg-white border border-primary z-50 pointer-events-auto rounded-sm hover:scale-125 transition-transform ${handle.pos}`}
                                    style={{ cursor: handle.cursor }}
                                    onMouseDown={(e) => {
                                       e.stopPropagation();
                                       onLayerSelect(layer.id);
                                       const event = new CustomEvent('editor-interact', { 
                                          detail: { type: handle.id, clientX: e.clientX, clientY: e.clientY, layerId: layer.id } 
                                       });
                                       window.dispatchEvent(event);
                                    }}
                                 />
                              ))}
                           </>
                        )}
                        </div>
                     </div>
                  );
               })()}            </motion.div>
          );
       })}
    </div>
  );
}

// Helper
function tryParse(str: string) {
  try { return JSON.parse(str); } catch { return null; }
}
