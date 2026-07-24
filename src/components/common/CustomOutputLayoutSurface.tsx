import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { LiveCaptureState, MediaPlaybackState, Slide } from '../../core/models/types';
import type { LogoOutputSettings, OutputChannel, OutputTransitionSettings, OutputWidgetId, OutputWidgetStyle } from '../../core/models/outputSettings';
import { getScreenProfileDefinition } from '../../core/screens/screenProfiles';
import { getOutputTransitionMotion } from '../../core/utils/outputTransitions';
import { SlideLabelBadge } from './SlideLabelBadge';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { SlideRenderer } from './SlideRenderer';
import { LogoOutputSurface } from './LogoOutputSurface';

interface CustomOutputLayoutSurfaceProps {
  output: OutputChannel;
  currentSlide: Slide | null;
  previousSlide?: Slide | null;
  nextSlide?: Slide | null;
  isBlack: boolean;
  isClear: boolean;
  liveCapture?: LiveCaptureState;
  mediaPlayback?: MediaPlaybackState | null;
  fallbackTransition?: OutputTransitionSettings;
  logoOutput?: LogoOutputSettings;
}

function parseStyle(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, any>;
  if (typeof raw !== 'string') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getTextLines(slide: Slide | null | undefined) {
  return String(slide?.content || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function getSectionLabel(slide: Slide | null | undefined) {
  if (!slide) return 'Ready';
  return [slide.sectionType, (slide as any).sectionNumber].filter(Boolean).join(' ').trim() || slide.label || 'Live';
}

function getPrimaryTextStyle(slide: Slide | null | undefined) {
  const layers = Array.isArray((slide as any)?.layers) ? (slide as any).layers : [];
  const textLayer = layers.find((layer: any) => {
    if (layer?.layerType !== 'text') return false;
    const style = parseStyle(layer.style);
    return style.textRole === 'lyrics-main' || style.textRole == null;
  }) || layers.find((layer: any) => layer?.layerType === 'text');
  return parseStyle(textLayer?.style);
}

function applySongDisplayOverrides(output: OutputChannel, baseStyle: Record<string, any>) {
  const settings = output.songDisplaySettings;
  return {
    fontFamily: settings.fontFamily.mode === 'override' ? settings.fontFamily.value : baseStyle.fontFamily || 'Manrope, Inter, sans-serif',
    scale: settings.scale.mode === 'override' ? settings.scale.value : Number(baseStyle.scale) || 1,
    color: settings.color.mode === 'override' ? settings.color.value : baseStyle.color || '#ffffff',
    shadow: settings.shadow.mode === 'override' ? settings.shadow.value : baseStyle.shadow ?? true,
  };
}

function WidgetPanel({
  title,
  children,
  muted = false,
  style,
  widgetStyle,
}: {
  title: string;
  children: ReactNode;
  muted?: boolean;
  style?: CSSProperties;
  widgetStyle?: OutputWidgetStyle;
}) {
  const backgroundColor = widgetStyle?.backgroundColor || '#000000';
  const backgroundOpacity = widgetStyle?.backgroundOpacity ?? 0.18;
  return (
    <section
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-lg p-[1.4cqw] ${widgetStyle?.borderVisible === false ? '' : 'border border-white/10'}`}
      style={{
        ...style,
        backgroundColor: hexToRgba(backgroundColor, backgroundOpacity),
      }}
    >
      {widgetStyle?.showLabel !== false && <div className="mb-[1cqh] text-[clamp(0.3rem,0.9cqw,0.85rem)] font-bold uppercase tracking-[0.22em] text-white/34">{widgetStyle?.label || title}</div>}
      <div className={`min-h-0 flex-1 ${muted ? 'text-white/42' : 'text-white/82'} ${widgetStyle?.showLabel === false ? 'flex items-center' : ''}`}>{children}</div>
    </section>
  );
}

function hexToRgba(hex: string, opacity: number) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return `rgba(0,0,0,${opacity})`;
  return `rgba(${parseInt(match[1], 16)},${parseInt(match[2], 16)},${parseInt(match[3], 16)},${opacity})`;
}

function LyricsBlock({
  lines,
  label,
  style,
  variant = 'primary',
  widgetStyle,
}: {
  lines: string[];
  label: string;
  style: ReturnType<typeof applySongDisplayOverrides>;
  variant?: 'primary' | 'secondary';
  widgetStyle?: OutputWidgetStyle;
}) {
  const isPrimary = variant === 'primary';
  const scale = widgetStyle?.scale ?? style.scale;
  const fontSize = widgetStyle?.sizingMode === 'fixed'
    ? `${widgetStyle.fontSizePx || 64}px`
    : isPrimary
      ? `clamp(0.45rem, ${4.8 * scale}cqw, ${5.4 * scale}rem)`
      : `clamp(0.3rem, ${2.1 * scale}cqw, ${2.5 * scale}rem)`;
  const maxLines = Math.max(1, widgetStyle?.maxLines || lines.length || 1);
  const visibleLines = lines.slice(0, maxLines);
  if (widgetStyle?.overflow === 'ellipsis' && lines.length > maxLines && visibleLines.length) {
    visibleLines[visibleLines.length - 1] = `${visibleLines[visibleLines.length - 1].replace(/[.…]+$/, '')}…`;
  }
  return (
    <WidgetPanel title={label} muted={!lines.length} widgetStyle={widgetStyle}>
      {lines.length ? (
        <div
          className={`${isPrimary ? 'space-y-[0.8cqh]' : 'space-y-[0.5cqh]'} w-full overflow-hidden`}
          style={{
            color: widgetStyle?.color || style.color,
            fontFamily: widgetStyle?.fontFamily || style.fontFamily,
            textAlign: widgetStyle?.textAlign || 'left',
            textShadow: (widgetStyle?.shadow ?? style.shadow) ? '0 4px 22px rgba(0,0,0,0.85)' : 'none',
          }}
        >
          {visibleLines.map((line, index) => (
            <div key={`${line}-${index}`} className="font-semibold leading-[1.08]" style={{ fontSize }}>
              {line}
            </div>
          ))}
        </div>
      ) : (
        widgetStyle?.showLabel === false ? null : <div className="text-[clamp(0.35rem,1.8cqw,1.7rem)] font-semibold">No lyric data</div>
      )}
    </WidgetPanel>
  );
}

function hasWidget(widgets: OutputWidgetId[], widget: OutputWidgetId) {
  return widgets.includes(widget);
}

function getWidgetStyle(output: OutputChannel, widget: OutputWidgetId): CSSProperties {
  const layout = output.widgetLayouts?.[widget];
  if (!layout) return {};
  return {
    position: 'absolute',
    left: `${layout.x}%`,
    top: `${layout.y}%`,
    width: `${layout.width}%`,
    height: `${layout.height}%`,
  };
}

function getWidgetTextStyle(widgetStyle?: OutputWidgetStyle): CSSProperties {
  return {
    color: widgetStyle?.color,
    fontFamily: widgetStyle?.fontFamily,
    textAlign: widgetStyle?.textAlign,
    textShadow: widgetStyle?.shadow ? '0 4px 22px rgba(0,0,0,0.85)' : 'none',
    transform: widgetStyle?.scale ? `scale(${widgetStyle.scale})` : undefined,
    transformOrigin: widgetStyle?.textAlign === 'right' ? 'right center' : widgetStyle?.textAlign === 'center' ? 'center' : 'left center',
  };
}

export function CustomOutputLayoutSurface({
  output,
  currentSlide,
  previousSlide = null,
  nextSlide = null,
  isBlack,
  isClear,
  liveCapture,
  mediaPlayback,
  fallbackTransition,
  logoOutput,
}: CustomOutputLayoutSurfaceProps) {
  const [now, setNow] = useState(() => new Date());
  const [slideStartedAt, setSlideStartedAt] = useState(() => Date.now());
  
  const showNameStore = usePresentationStore((state) => state.showName);
  const slideIndexStore = usePresentationStore((state) => state.slideIndex);
  const totalSlidesStore = usePresentationStore((state) => state.totalSlides);
  const mediaPlaybackStore = usePresentationStore((state) => state.mediaPlayback);
  const effectiveMediaPlayback = mediaPlayback === undefined ? mediaPlaybackStore : mediaPlayback;

  const widgets = output.widgets || [];
  const profile = getScreenProfileDefinition(output.role);
  const currentLines = getTextLines(currentSlide);
  const previousLines = getTextLines(previousSlide);
  const nextLines = getTextLines(nextSlide);
  const textStyle = applySongDisplayOverrides(output, getPrimaryTextStyle(currentSlide));
  const motionProps = getOutputTransitionMotion(output.transitionSettings || fallbackTransition);
  const isTransparentCanvas = output.canvasBackground === 'transparent';

  const videoCountdownLabel = useMemo(() => {
    if (!effectiveMediaPlayback || effectiveMediaPlayback.status === 'stopped') {
      return '{video_countdown}';
    }
    const duration = effectiveMediaPlayback.duration || 0;
    const currentTime = effectiveMediaPlayback.currentTime || 0;
    const remaining = Math.max(0, Math.floor(duration - currentTime));
    const mins = Math.floor(remaining / 60).toString().padStart(2, '0');
    const secs = (remaining % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }, [effectiveMediaPlayback, now]);

  const renderWidget = (widget: OutputWidgetId) => {
    if (!hasWidget(widgets, widget)) return null;
    const widgetStyle = output.widgetStyles?.[widget];
    if (widget === 'slideCanvas') {
      return currentSlide ? (
        <div key={widget} className="h-full w-full overflow-hidden">
          <SlideRenderer
            slide={currentSlide}
            layers={(currentSlide as any).layers}
            renderMode="output"
            forceMuted={output.role !== 'audience'}
            mediaPlayback={effectiveMediaPlayback}
          />
        </div>
      ) : <div key={widget} className="h-full w-full bg-[#05070a]" />;
    }
    if (widget === 'currentLyrics') {
      const rendersVisualContent = currentSlide
        && (currentSlide.type === 'media' || currentSlide.type === 'image' || currentSlide.type === 'video' || currentSlide.type === 'custom');
      if (rendersVisualContent) {
        return (
          <WidgetPanel key={widget} title="Current" widgetStyle={widgetStyle}>
            <div className="h-full w-full overflow-hidden rounded-md bg-black">
              <SlideRenderer
                slide={currentSlide}
                layers={(currentSlide as any).layers}
                renderMode="output"
                forceMuted
                mediaPlayback={effectiveMediaPlayback}
              />
            </div>
          </WidgetPanel>
        );
      }
      const lines = widgetStyle?.contentScope === 'song' && currentSlide?.type !== 'lyrics' ? [] : currentLines;
      return <LyricsBlock key={widget} lines={lines} label="Current slide text" style={textStyle} widgetStyle={widgetStyle} />;
    }
    if (widget === 'nextLyrics') {
      return <LyricsBlock key={widget} lines={nextLines} label="Next slide text" style={textStyle} variant="secondary" widgetStyle={widgetStyle} />;
    }
    if (widget === 'previousLyrics') {
      return <LyricsBlock key={widget} lines={previousLines} label="Previous slide text" style={textStyle} variant="secondary" widgetStyle={widgetStyle} />;
    }
    if (widget === 'sectionLabel') {
      return (
        <WidgetPanel key={widget} title="Section" widgetStyle={widgetStyle}>
          {currentSlide ? (
            <SlideLabelBadge
              slide={currentSlide}
              fallback={getSectionLabel(currentSlide)}
              className="px-[0.7cqw] py-[0.45cqh] text-[clamp(0.35rem,1.8cqw,1.7rem)]"
              style={{ fontFamily: widgetStyle?.fontFamily, transform: getWidgetTextStyle(widgetStyle).transform, transformOrigin: getWidgetTextStyle(widgetStyle).transformOrigin }}
            />
          ) : (
            <div className="text-[clamp(0.35rem,1.8cqw,1.7rem)] font-semibold" style={getWidgetTextStyle(widgetStyle)}>Ready</div>
          )}
        </WidgetPanel>
      );
    }
    if (widget === 'timer') {
      return (
        <WidgetPanel key={widget} title="Timer" widgetStyle={widgetStyle}>
          <div className="font-mono text-[clamp(0.45rem,3.2cqw,3.5rem)] font-bold text-center leading-none" style={getWidgetTextStyle(widgetStyle)}>{elapsedLabel}</div>
        </WidgetPanel>
      );
    }
    if (widget === 'clock') {
      return (
        <WidgetPanel key={widget} title="Clock" widgetStyle={widgetStyle}>
          <div className="font-mono text-[clamp(0.45rem,3.2cqw,3.5rem)] font-bold text-center leading-none" style={getWidgetTextStyle(widgetStyle)}>
            {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
        </WidgetPanel>
      );
    }
    if (widget === 'videoCountdown') {
      return (
        <WidgetPanel key={widget} title="Video countdown" widgetStyle={widgetStyle}>
          <div className="font-mono text-[clamp(0.4rem,2.4cqw,2.5rem)] font-semibold text-center leading-none" style={getWidgetTextStyle(widgetStyle)}>
            {videoCountdownLabel}
          </div>
        </WidgetPanel>
      );
    }
    if (widget === 'showName') {
      return (
        <WidgetPanel key={widget} title="Show name" widgetStyle={widgetStyle}>
          <div className="text-[clamp(0.4rem,2cqw,2.2rem)] font-semibold text-center truncate leading-snug" style={getWidgetTextStyle(widgetStyle)}>
            {showNameStore || '{show_name}'}
          </div>
        </WidgetPanel>
      );
    }
    if (widget === 'progress') {
      const currentNum = currentSlide ? slideIndexStore + 1 : 0;
      const totalNum = totalSlidesStore || 0;
      return (
        <WidgetPanel key={widget} title="Progress" widgetStyle={widgetStyle}>
          <div className="font-mono text-[clamp(0.45rem,3.2cqw,3.5rem)] font-bold text-center leading-none" style={getWidgetTextStyle(widgetStyle)}>
            <span className="text-[#ec4899]">{currentNum > 0 ? currentNum : '0'}</span>
            <span className="text-white/60">/{totalNum > 0 ? totalNum : '0'}</span>
          </div>
        </WidgetPanel>
      );
    }
    if (widget === 'logo') {
      return logoOutput?.source
        ? <div key={widget} className="h-full w-full overflow-hidden"><LogoOutputSurface settings={logoOutput} /></div>
        : <WidgetPanel key={widget} title="Logo" widgetStyle={widgetStyle}><div className="text-center text-[clamp(0.35rem,1.4cqw,1.4rem)] font-bold tracking-[0.16em]" style={getWidgetTextStyle(widgetStyle)}>RAMEDIA</div></WidgetPanel>;
    }
    if (widget === 'alert') {
      return <WidgetPanel key={widget} title="Alert" muted={!currentSlide?.notes} widgetStyle={widgetStyle}><div className="text-[clamp(0.35rem,1.6cqw,1.6rem)] font-semibold leading-snug" style={getWidgetTextStyle(widgetStyle)}>{currentSlide?.notes || 'No active alert'}</div></WidgetPanel>;
    }
    return (
      <WidgetPanel key={widget} title="Notes" muted={!currentSlide?.notes} widgetStyle={widgetStyle}>
        <div className="text-[clamp(0.35rem,1.6cqw,1.5rem)] leading-snug" style={getWidgetTextStyle(widgetStyle)}>
          {currentSlide?.notes || currentSlide?.label || 'No note attached'}
        </div>
      </WidgetPanel>
    );
  };

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSlideStartedAt(Date.now());
  }, [currentSlide?.id]);

  const elapsedLabel = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor((Date.now() - slideStartedAt) / 1000));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [now, slideStartedAt]);

  if (isBlack) return <div className="h-full w-full bg-black" />;

  if (isClear) {
    return isTransparentCanvas ? <div className="h-full w-full bg-transparent" /> : (
      <div className="flex h-full w-full items-center justify-center bg-black text-white/34">
        <div className="text-[clamp(0.6rem,4cqw,4.5rem)] font-semibold">Cleared</div>
      </div>
    );
  }

  if (liveCapture?.active) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-[clamp(0.6rem,4cqw,4.5rem)] font-semibold">{liveCapture.sourceName || 'Live capture'}</div>
          <div className="mt-3 text-[clamp(0.3rem,0.9cqw,0.9rem)] uppercase tracking-[0.22em] text-white/36">Capture source active</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-full w-full overflow-hidden text-white ${isTransparentCanvas ? 'bg-transparent' : 'bg-[#05070A]'}`} style={{ containerType: 'size' }}>
      <div className={`grid h-full ${hasWidget(widgets, 'slideCanvas') || isTransparentCanvas ? 'grid-rows-[1fr]' : 'grid-rows-[auto_1fr] gap-[2cqh] px-[3cqw] py-[2.8cqh]'}`}>
        {!hasWidget(widgets, 'slideCanvas') && !isTransparentCanvas && <header className="flex items-start justify-between border-b border-white/10 pb-[1.8cqh]">
          <div>
            <div className="text-[clamp(0.3rem,1cqw,0.9rem)] font-bold uppercase tracking-[0.26em]" style={{ color: profile.accent }}>
              {profile.label}
            </div>
            <div className="mt-2 text-[clamp(0.32rem,1.2cqw,1.05rem)] font-medium text-white/54">{output.name}</div>
          </div>
        </header>}

        <AnimatePresence mode="sync">
          <motion.main
            key={currentSlide?.id || 'empty'}
            initial={motionProps.initial}
            animate={motionProps.animate}
            exit={motionProps.exit}
            transition={motionProps.transition}
            style={motionProps.style}
            className="relative min-h-0 overflow-hidden"
          >
            {(Object.keys(output.widgetLayouts || {}) as OutputWidgetId[])
              .filter((widget) => hasWidget(widgets, widget))
              .map((widget) => (
                <div key={widget} style={getWidgetStyle(output, widget)}>
                  {renderWidget(widget)}
                </div>
              ))}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  );
}
