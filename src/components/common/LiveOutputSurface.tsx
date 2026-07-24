import { AnimatePresence, motion } from 'framer-motion';
import type { LiveCaptureState, MediaPlaybackState, PointerState, Slide, SlideAnnotation, TransitionMode } from '../../core/models/types';
import { SlideRenderer } from './SlideRenderer';
import { PresentationAnnotationOverlay } from './PresentationAnnotationOverlay';
import { CaptureVideoSurface } from './CaptureVideoSurface';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import type { OutputTransitionSettings } from '../../core/models/outputSettings';
import { getOutputTransitionMotion } from '../../core/utils/outputTransitions';
import { findPrimaryVideoLayer, getVideoPlaybackId } from '../../core/utils/videoLayers';

interface LiveOutputSurfaceProps {
  currentSlide: Slide | null;
  isBlack: boolean;
  isClear: boolean;
  pointer?: PointerState;
  annotations?: Record<string, SlideAnnotation[]>;
  transitionMode?: TransitionMode;
  transitionSettings?: OutputTransitionSettings;
  liveCapture?: LiveCaptureState;
  mediaPlayback?: MediaPlaybackState | null;
  mode?: 'output' | 'preview';
  showPreviewBadge?: boolean;
  onCaptureError?: (message: string) => void;
  transparentBackground?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

export function LiveOutputSurface({
  currentSlide,
  isBlack,
  isClear,
  pointer,
  annotations = {},
  transitionMode = 'fade',
  transitionSettings,
  liveCapture,
  mediaPlayback,
  mode = 'output',
  showPreviewBadge = true,
  onCaptureError,
  transparentBackground = false,
  canvasWidth,
  canvasHeight,
}: LiveOutputSurfaceProps) {
  const storedOutputWidth = useSettingsStore((state) => state.outputWidth);
  const storedOutputHeight = useSettingsStore((state) => state.outputHeight);
  const outputWidth = canvasWidth || storedOutputWidth;
  const outputHeight = canvasHeight || storedOutputHeight;
  const aspectRatio = outputWidth && outputHeight ? outputWidth / outputHeight : 16 / 9;

  if (isBlack) {
    return <div className="h-full w-full bg-black" />;
  }

  const isOutput = mode === 'output';
  const currentAnnotations = currentSlide ? annotations[currentSlide.id] || [] : [];
  const primaryVideoLayer = findPrimaryVideoLayer(currentSlide);
  const hasContinuousSongVideo = Boolean(primaryVideoLayer) && (
    primaryVideoLayer?.style.isSongBackground === true
    || (Boolean((currentSlide as any)?.songId) && (primaryVideoLayer?.layer.layerType === 'background' || primaryVideoLayer?.layer.layerType === 'media'))
  );
  const slideRenderKey = hasContinuousSongVideo && primaryVideoLayer
    ? `song-video-${getVideoPlaybackId(primaryVideoLayer)}`
    : currentSlide?.id;
  const motionProps = getOutputTransitionMotion(transitionSettings || {
    type: transitionMode,
    durationMs: transitionMode === 'none' ? 0 : 220,
    easing: 'easeOut',
    direction: 'left',
  });

  return (
    <div className={`relative flex h-full w-full items-center justify-center overflow-hidden ${transparentBackground ? 'bg-transparent' : 'bg-black'}`} style={{ containerType: 'size' }}>
      {!transparentBackground && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,213,247,0.16),transparent_32%),radial-gradient(circle_at_bottom,rgba(245,158,11,0.12),transparent_28%),linear-gradient(180deg,#03060A_0%,#080C12_45%,#020406_100%)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.18)_55%,rgba(0,0,0,0.55)_100%)]"></div>
        </div>
      )}

      {!isOutput && showPreviewBadge && (
        <div className="absolute left-3 top-3 z-10 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-white/70 backdrop-blur-sm">
          Live Preview
        </div>
      )}

      {/* Aspect Ratio Locked Inner Box */}
      <div
        style={{
          width: `min(100cqw, calc(100cqh * ${aspectRatio}))`,
          height: `min(100cqh, calc(100cqw / ${aspectRatio}))`,
          position: 'relative',
          overflow: 'hidden',
        }}
        className="flex items-center justify-center"
      >
        <AnimatePresence mode="sync">
          {liveCapture?.active && (
            <motion.div
              key={`capture-${liveCapture.sourceType || 'source'}-${liveCapture.sourceId || 'unknown'}`}
              initial={motionProps.initial}
              animate={motionProps.animate}
              exit={motionProps.exit}
              transition={motionProps.transition}
              style={motionProps.style}
              className="absolute inset-0"
            >
              <CaptureVideoSurface capture={liveCapture} mode={mode} onError={onCaptureError} />
            </motion.div>
          )}

          {!liveCapture?.active && currentSlide && (
            <motion.div
              key={slideRenderKey}
              initial={motionProps.initial}
              animate={motionProps.animate}
              exit={motionProps.exit}
              transition={motionProps.transition}
              style={motionProps.style}
              className="absolute inset-0"
            >
              <SlideRenderer
                slide={currentSlide as any}
                layers={(currentSlide as any).layers}
                mediaPlayback={mediaPlayback}
                renderMode={mode === 'preview' ? 'preview' : 'output'}
                hideText={isClear}
                transparentBackground={transparentBackground}
              />
              <PresentationAnnotationOverlay annotations={currentAnnotations} />
            </motion.div>
          )}
        </AnimatePresence>

        {!liveCapture?.active && !currentSlide && !isOutput && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              className="uppercase text-white/58"
              style={{
                fontSize: isOutput ? 'clamp(0.95rem, 1.35cqw, 1.15rem)' : '1rem',
                fontWeight: 500,
                letterSpacing: '0.3em',
              }}
            >
              Ready
            </div>
          </div>
        )}

        {pointer?.enabled && pointer.visible && !isBlack && (
          <div
            className="pointer-events-none absolute z-30"
            style={{
              left: `${pointer.x * 100}%`,
              top: `${pointer.y * 100}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute h-10 w-10 rounded-full bg-red-500/20 blur-md" />
              <div className="absolute h-5 w-5 rounded-full border border-red-300/40 bg-red-500/12" />
              <div className="h-3.5 w-3.5 rounded-full border border-red-100/85 bg-red-500 shadow-[0_0_18px_rgba(239,68,68,0.85)]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
