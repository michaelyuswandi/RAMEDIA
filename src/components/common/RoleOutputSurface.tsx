import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getScreenProfileDefinition, type ScreenProfileId } from '../../core/screens/screenProfiles';
import type { LiveCaptureState, MediaPlaybackState, OutputAlertMessage, PointerState, Slide, SlideAnnotation, TransitionMode } from '../../core/models/types';
import type { LogoOutputSettings, OutputChannel } from '../../core/models/outputSettings';
import { LiveOutputSurface } from './LiveOutputSurface';
import { CustomOutputLayoutSurface } from './CustomOutputLayoutSurface';
import { applyOutputSlideOverrides } from '../../core/utils/outputSlideOverrides';
import { AnimatePresence, motion } from 'framer-motion';
import { getOutputTransitionMotion } from '../../core/utils/outputTransitions';
import { SlideLabelBadge } from './SlideLabelBadge';
import { LogoOutputSurface } from './LogoOutputSurface';
import { BroadcastLyricsSurface } from './BroadcastLyricsSurface';
import { buildLayersFromContentThemeData } from '../../core/songEditor/songPresets';

interface RoleOutputSurfaceProps {
  role: ScreenProfileId;
  outputConfig?: OutputChannel | null;
  currentSlide: Slide | null;
  previousSlide?: Slide | null;
  nextSlide?: Slide | null;
  isBlack: boolean;
  isClear: boolean;
  isLogo?: boolean;
  logoOutput?: LogoOutputSettings;
  pointer?: PointerState;
  annotations?: Record<string, SlideAnnotation[]>;
  transitionMode?: TransitionMode;
  liveCapture?: LiveCaptureState;
  mediaPlayback?: MediaPlaybackState | null;
  manualAlert?: OutputAlertMessage | null;
  outputName?: string;
  onCaptureError?: (message: string) => void;
  transparentBackground?: boolean;
  canvasWidth?: number;
  canvasHeight?: number;
}

function formatSectionLabel(slide: Slide | null) {
  if (!slide) return 'Ready';
  return [slide.sectionType, (slide as any).sectionNumber].filter(Boolean).join(' ').trim() || slide.label || 'Live';
}

function splitLines(text: string | null | undefined) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function SupportShell({
  role,
  outputName,
  sectionLabel,
  sectionSlide,
  statusLabel,
  children,
  footer,
}: {
  role: ScreenProfileId;
  outputName?: string;
  sectionLabel: string;
  sectionSlide?: Slide | null;
  statusLabel: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const profile = getScreenProfileDefinition(role);
  const timeLabel = useMemo(
    () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
    [role, sectionLabel, statusLabel],
  );

  const backgrounds: Record<ScreenProfileId, string> = {
    audience: 'linear-gradient(180deg,#080B10 0%,#090E13 100%)',
    singer: 'linear-gradient(180deg,#041018 0%,#071720 50%,#040A10 100%)',
    'worship-leader': 'linear-gradient(180deg,#07150E 0%,#0A1811 50%,#050A07 100%)',
    confidence: 'linear-gradient(180deg,#0B0915 0%,#111122 50%,#06050C 100%)',
  };

  return (
    <div className="h-full w-full overflow-hidden text-white" style={{ background: backgrounds[role], containerType: 'size' }}>
      <div className="grid h-full grid-rows-[auto_1fr_auto] px-[3.2cqw] py-[2.8cqh]">
        <div className="flex items-start justify-between border-b border-white/10 pb-[2cqh]">
          <div>
            <div className="text-[clamp(0.28rem,0.78cqw,0.78rem)] font-semibold uppercase tracking-[0.28em]" style={{ color: profile.accent }}>
              {profile.label}
            </div>
            <div className="mt-2 text-[clamp(0.3rem,0.92cqw,0.92rem)] uppercase tracking-[0.18em] text-white/42">
              {outputName || 'Support Output'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[clamp(0.5rem,2.15cqw,2.15rem)] font-semibold leading-none text-white/94">{timeLabel}</div>
            {sectionSlide ? (
              <SlideLabelBadge slide={sectionSlide} fallback={sectionLabel} className="mt-2 px-[0.7cqw] py-[0.4cqh] text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.12em]" />
            ) : (
              <div className="mt-2 text-[clamp(0.28rem,0.8cqw,0.8rem)] uppercase tracking-[0.16em] text-white/38">{sectionLabel}</div>
            )}
          </div>
        </div>

        <div className="min-h-0 py-[3cqh]">{children}</div>

        <div className="flex items-end justify-between gap-8 border-t border-white/8 pt-[2cqh]">
          <div>
            <div className="text-[clamp(0.26rem,0.74cqw,0.74rem)] uppercase tracking-[0.22em] text-white/30">Status</div>
            <div className="mt-2 text-[clamp(0.3rem,0.95cqw,0.95rem)] text-white/70">{statusLabel}</div>
          </div>
          {footer ? <div className="max-w-[46%] text-right">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="text-[clamp(0.55rem,3cqw,3rem)] font-semibold text-white/34">{title}</div>
        <div className="mt-3 text-[clamp(0.3rem,0.9cqw,0.9rem)] uppercase tracking-[0.22em] text-white/22">{description}</div>
      </div>
    </div>
  );
}

function SingerSurface({
  currentSlide,
  isClear,
  liveCapture,
  outputName,
}: Pick<RoleOutputSurfaceProps, 'currentSlide' | 'isClear' | 'liveCapture' | 'outputName'>) {
  const lines = splitLines(currentSlide?.content);
  const sectionLabel = formatSectionLabel(currentSlide);

  return (
    <SupportShell
      role="singer"
      outputName={outputName}
      sectionLabel={sectionLabel}
      sectionSlide={currentSlide}
      statusLabel={isClear ? 'Clear active' : liveCapture?.active ? 'Capture source active' : currentSlide ? 'Lyrics ready for stage reading' : 'Idle'}
      footer={<div className="text-[clamp(0.3rem,0.95cqw,0.95rem)] text-white/60">High-contrast stage reading with minimal distractions.</div>}
    >
      {isClear ? (
        <EmptyState title="Cleared" description="Output intentionally blank" />
      ) : liveCapture?.active ? (
        <EmptyState title={liveCapture.sourceName || 'Live capture'} description="Capture source is active" />
      ) : currentSlide ? (
        <div className="mx-auto flex h-full max-w-[90%] flex-col justify-center gap-[1.8cqh] text-center">
          {lines.map((line, index) => (
            <div key={`${currentSlide.id}-${index}`} className="text-[clamp(0.65rem,5.6cqw,5.8rem)] font-semibold leading-[1.04]">
              {line}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="Ready" description="Waiting for live lyric feed" />
      )}
    </SupportShell>
  );
}

function WorshipLeaderSurface({
  currentSlide,
  isClear,
  liveCapture,
  outputName,
}: Pick<RoleOutputSurfaceProps, 'currentSlide' | 'isClear' | 'liveCapture' | 'outputName'>) {
  const lines = splitLines(currentSlide?.content);
  const sectionLabel = formatSectionLabel(currentSlide);

  return (
    <SupportShell
      role="worship-leader"
      outputName={outputName}
      sectionLabel={sectionLabel}
      sectionSlide={currentSlide}
      statusLabel={isClear ? 'Clear active' : liveCapture?.active ? 'Capture source active' : currentSlide ? 'Leadership cue view live' : 'Idle'}
      footer={
        <div>
          <div className="text-[clamp(0.26rem,0.74cqw,0.74rem)] uppercase tracking-[0.22em] text-white/30">Cue Focus</div>
          <div className="mt-2 text-[clamp(0.3rem,0.95cqw,0.95rem)] text-white/68">{currentSlide?.notes || currentSlide?.label || 'Section cue ready'}</div>
        </div>
      }
    >
      {isClear ? (
        <EmptyState title="Cleared" description="Output intentionally blank" />
      ) : liveCapture?.active ? (
        <EmptyState title={liveCapture.sourceName || 'Live capture'} description="Capture source is active" />
      ) : currentSlide ? (
        <div className="grid h-full grid-cols-[minmax(0,1.4fr)_minmax(0,0.7fr)] gap-[2cqw]">
          <div className="flex min-h-0 flex-col justify-center gap-[1.4cqh] rounded-[24px] border border-white/10 bg-white/[0.035] px-[2.4cqw] py-[3cqh]">
            {lines.map((line, index) => (
              <div key={`${currentSlide.id}-${index}`} className="text-[clamp(0.6rem,4.8cqw,4.9rem)] font-semibold leading-[1.06]">
                {line}
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-[1.5cqh] rounded-[24px] border border-white/10 bg-black/18 p-[2cqw]">
            <div>
              <div className="text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.22em] text-white/34">Section</div>
              <SlideLabelBadge slide={currentSlide} fallback={sectionLabel} className="mt-2 px-[0.8cqw] py-[0.5cqh] text-[clamp(0.35rem,1.3cqw,1.3rem)]" />
            </div>
            <div>
              <div className="text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.22em] text-white/34">Slide Type</div>
              <div className="mt-2 text-[clamp(0.32rem,1cqw,1rem)] text-white/72">{currentSlide.type}</div>
            </div>
            <div className="min-h-0 flex-1">
              <div className="text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.22em] text-white/34">Notes</div>
              <div className="mt-2 text-[clamp(0.32rem,1cqw,1rem)] leading-relaxed text-white/72">
                {currentSlide.notes || 'No note attached to this slide.'}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <EmptyState title="Ready" description="Waiting for leadership feed" />
      )}
    </SupportShell>
  );
}

function ConfidenceSurface({
  currentSlide,
  isClear,
  liveCapture,
  outputName,
}: Pick<RoleOutputSurfaceProps, 'currentSlide' | 'isClear' | 'liveCapture' | 'outputName'>) {
  const lines = splitLines(currentSlide?.content);
  const sectionLabel = formatSectionLabel(currentSlide);

  return (
    <SupportShell
      role="confidence"
      outputName={outputName}
      sectionLabel={sectionLabel}
      sectionSlide={currentSlide}
      statusLabel={isClear ? 'Clear active' : liveCapture?.active ? 'Capture source active' : currentSlide ? 'Confidence monitor active' : 'Idle'}
      footer={
        <div>
          <div className="text-[clamp(0.26rem,0.74cqw,0.74rem)] uppercase tracking-[0.22em] text-white/30">Live Feed</div>
          <div className="mt-2 text-[clamp(0.3rem,0.95cqw,0.95rem)] text-white/68">
            {liveCapture?.active ? liveCapture.sourceName || 'Capture source' : currentSlide ? `${lines.length} lines on current slide` : 'No active source'}
          </div>
        </div>
      }
    >
      <div className="grid h-full grid-cols-[minmax(0,0.86fr)_minmax(0,1.3fr)] gap-[2cqw]">
        <div className="flex flex-col gap-[1.5cqh] rounded-[24px] border border-white/10 bg-white/[0.04] p-[2cqw]">
          <div>
            <div className="text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.22em] text-white/34">Section</div>
            {currentSlide ? <SlideLabelBadge slide={currentSlide} fallback={sectionLabel} className="mt-2 px-[0.8cqw] py-[0.5cqh] text-[clamp(0.35rem,1.3cqw,1.3rem)]" /> : <div className="mt-2 text-[clamp(0.4rem,1.65cqw,1.65rem)] font-semibold text-white/92">{sectionLabel}</div>}
          </div>
          <div>
            <div className="text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.22em] text-white/34">Type</div>
            <div className="mt-2 text-[clamp(0.32rem,1cqw,1rem)] text-white/72">{currentSlide?.type || 'none'}</div>
          </div>
          <div>
            <div className="text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.22em] text-white/34">Lines</div>
            <div className="mt-2 text-[clamp(0.32rem,1cqw,1rem)] text-white/72">{lines.length || 0}</div>
          </div>
          <div className="min-h-0 flex-1">
            <div className="text-[clamp(0.26rem,0.72cqw,0.72rem)] uppercase tracking-[0.22em] text-white/34">Notes</div>
            <div className="mt-2 text-[clamp(0.32rem,1cqw,1rem)] leading-relaxed text-white/72">
              {currentSlide?.notes || 'No note attached to this slide.'}
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col justify-center rounded-[28px] border border-white/10 bg-black/14 px-[2.4cqw] py-[3cqh]">
          {isClear ? (
            <EmptyState title="Cleared" description="Output intentionally blank" />
          ) : liveCapture?.active ? (
            <EmptyState title={liveCapture.sourceName || 'Live capture'} description="Capture source is active" />
          ) : currentSlide ? (
            <div className="flex flex-col gap-[1.4cqh] text-left">
              {lines.map((line, index) => (
                <div key={`${currentSlide.id}-${index}`} className="text-[clamp(0.55rem,4.2cqw,4.4rem)] font-semibold leading-[1.08]">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Ready" description="Waiting for confidence feed" />
          )}
        </div>
      </div>
    </SupportShell>
  );
}

function SupportOutputSurface(props: RoleOutputSurfaceProps) {
  if (props.isBlack) return <div className="h-full w-full bg-black" />;

  if (props.role === 'singer') {
    return <SingerSurface {...props} />;
  }

  if (props.role === 'worship-leader') {
    return <WorshipLeaderSurface {...props} />;
  }

  return <ConfidenceSurface {...props} />;
}

export function RoleOutputSurface(props: RoleOutputSurfaceProps) {
  const themeResolvedCurrentSlide = useMemo(() => {
    const slide = props.currentSlide;
    if (!slide || !props.outputConfig?.contentRules) return slide;
    const contentType = slide.type === 'lyrics'
      ? 'song'
      : slide.type === 'bible'
        ? 'scripture'
        : slide.type === 'media' || slide.type === 'image' || slide.type === 'video'
          ? 'media'
          : 'presentation';
    const rule = props.outputConfig.contentRules[contentType];
    const hasLayers = Array.isArray((slide as any).layers) && (slide as any).layers.length > 0;
    const hasSourceTheme = contentType === 'scripture'
      ? Boolean((slide as any).contentThemeId)
      : hasLayers;
    if (!rule?.themeLayersData || rule.policy === 'follow' || (rule.policy === 'fallback' && hasSourceTheme)) return slide;
    const themedLayers = buildLayersFromContentThemeData(slide.id, slide.content || '', rule.themeLayersData, {
      songTitle: (slide as any).title || props.outputName || 'Content',
      sectionLabel: slide.label || slide.sectionType || null,
      scriptureText: (slide as any).scriptureText || slide.content || null,
      scriptureReference: (slide as any).scriptureReference || (slide as any).reference || slide.label || null,
      scriptureVersion: (slide as any).version || (slide as any).versionCode || null,
      presentationTitle: (slide as any).title || slide.label || null,
      presentationBody: slide.content || null,
      mediaCaption: (slide as any).caption || slide.label || null,
    });
    if (!themedLayers.length) return slide;
    if (contentType === 'media' && hasLayers) {
      const mediaLayers = (slide as any).layers.filter((layer: any) => layer.layerType === 'media' || layer.layerType === 'background');
      return { ...slide, layers: [...mediaLayers, ...themedLayers] } as Slide;
    }
    return { ...slide, layers: themedLayers } as Slide;
  }, [props.currentSlide, props.outputConfig, props.outputName]);
  const currentSlide = useMemo(
    () => applyOutputSlideOverrides(themeResolvedCurrentSlide, props.outputConfig),
    [themeResolvedCurrentSlide, props.outputConfig],
  );
  const previousSlide = useMemo(
    () => applyOutputSlideOverrides(props.previousSlide, props.outputConfig),
    [props.previousSlide, props.outputConfig],
  );
  const nextSlide = useMemo(
    () => applyOutputSlideOverrides(props.nextSlide, props.outputConfig),
    [props.nextSlide, props.outputConfig],
  );
  const alertText = props.outputConfig?.alertSettings?.enabled ? String(props.currentSlide?.notes || '').trim() : '';
  const [alertVisible, setAlertVisible] = useState(false);
  const [manualAlertVisible, setManualAlertVisible] = useState(false);
  const targetedManualAlert = props.manualAlert
    && props.outputConfig?.id
    && props.manualAlert.targetOutputIds.includes(props.outputConfig.id)
      ? props.manualAlert
      : null;

  useEffect(() => {
    if (!alertText) {
      setAlertVisible(false);
      return;
    }
    setAlertVisible(true);
    const timer = window.setTimeout(
      () => setAlertVisible(false),
      props.outputConfig?.alertSettings?.durationMs || 5000,
    );
    return () => window.clearTimeout(timer);
  }, [alertText, props.currentSlide?.id, props.outputConfig?.alertSettings?.durationMs]);

  useEffect(() => {
    if (!targetedManualAlert) {
      setManualAlertVisible(false);
      return;
    }

    const remainingMs = targetedManualAlert.expiresAt === null
      ? null
      : targetedManualAlert.expiresAt - Date.now();
    if (remainingMs !== null && remainingMs <= 0) {
      setManualAlertVisible(false);
      return;
    }

    setManualAlertVisible(true);
    if (remainingMs === null) return;
    const timer = window.setTimeout(() => setManualAlertVisible(false), remainingMs);
    return () => window.clearTimeout(timer);
  }, [targetedManualAlert]);

  const effectiveProps = { ...props, currentSlide, previousSlide, nextSlide };
  let surface: ReactNode;
  const isBroadcastLyrics = props.outputConfig?.targetType === 'ndi'
    && props.outputConfig.ndiConfig.contentMode === 'broadcast-lyrics';
  if (isBroadcastLyrics) {
    surface = (
      <BroadcastLyricsSurface
        slide={currentSlide}
        settings={props.outputConfig!.ndiConfig.lyricsOverlay}
        hidden={props.isBlack || props.isClear || !!props.isLogo || !!props.liveCapture?.active}
      />
    );
  } else if (props.isLogo && props.logoOutput) {
    surface = <LogoOutputSurface settings={props.logoOutput} />;
  } else if (props.outputConfig?.renderMode === 'custom-layout') {
    surface = (
      <CustomOutputLayoutSurface
        output={props.outputConfig}
        currentSlide={currentSlide}
        previousSlide={previousSlide}
        nextSlide={nextSlide}
        isBlack={props.isBlack}
        isClear={props.isClear}
        liveCapture={props.liveCapture}
        mediaPlayback={props.mediaPlayback}
        fallbackTransition={props.outputConfig.transitionSettings}
        logoOutput={props.logoOutput}
      />
    );
  } else if (props.outputConfig?.renderMode === 'follow-slide' || props.role === 'audience') {
    surface = (
      <LiveOutputSurface
        currentSlide={currentSlide}
        isBlack={props.isBlack}
        isClear={props.isClear}
        pointer={props.pointer}
        annotations={props.outputConfig?.presentationSettings?.showAnnotations === false ? {} : props.annotations}
        transitionMode={props.transitionMode}
        transitionSettings={props.outputConfig?.transitionSettings}
        liveCapture={props.liveCapture}
        mediaPlayback={props.mediaPlayback}
        mode="output"
        onCaptureError={props.onCaptureError}
        transparentBackground={props.transparentBackground}
        canvasWidth={props.canvasWidth}
        canvasHeight={props.canvasHeight}
      />
    );
  } else {
    surface = <SupportOutputSurface {...effectiveProps} />;
  }

  const alertSettings = props.outputConfig?.alertSettings;
  const displayedManualAlert = manualAlertVisible ? targetedManualAlert : null;
  const displayedAlertText = displayedManualAlert?.text || (alertVisible ? alertText : '');
  const displayedAlertPosition = displayedManualAlert?.position || alertSettings?.position || 'top';
  const manualAlertTone = displayedManualAlert?.tone || 'info';
  const manualAlertToneConfig = {
    info: { label: 'INFO', accent: '#f59e0b' },
    warning: { label: 'PENTING', accent: '#d97706' },
    emergency: { label: 'DARURAT', accent: '#dc2626' },
    neutral: { label: 'PESAN', accent: '#64748b' },
  }[manualAlertTone];
  const outputState = props.isBlack ? 'black' : props.isLogo ? 'logo' : props.isClear ? 'clear' : 'slide';
  const stateTransition = props.isBlack
    ? props.outputConfig?.stateTransitionSettings?.black
    : props.isLogo
      ? props.outputConfig?.stateTransitionSettings?.black
      : props.isClear
      ? props.outputConfig?.stateTransitionSettings?.clear
      : props.outputConfig?.transitionSettings;
  const stateMotion = getOutputTransitionMotion(stateTransition);
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ containerType: 'size' }}>
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={outputState}
          className="absolute inset-0"
          initial={stateMotion.initial}
          animate={stateMotion.animate}
          exit={stateMotion.exit}
          transition={stateMotion.transition}
          style={stateMotion.style}
        >
          {surface}
        </motion.div>
      </AnimatePresence>
      <AnimatePresence>
        {displayedAlertText && !isBroadcastLyrics && !props.isBlack && !props.isLogo && (
          <motion.div
            key={displayedManualAlert?.id || `slide-note-${props.currentSlide?.id || 'none'}`}
            className={`pointer-events-none absolute inset-x-[4%] z-40 flex ${displayedAlertPosition === 'bottom' ? 'bottom-[5%]' : 'top-[5%]'}`}
            initial={{ opacity: 0, y: displayedAlertPosition === 'bottom' ? 18 : -18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: displayedAlertPosition === 'bottom' ? 12 : -12, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 260, damping: 25 }}
          >
            {displayedManualAlert ? (
              <div className="mx-auto flex max-w-[86%] items-stretch overflow-hidden rounded-xl border border-white/15 bg-[#17191d]/95 text-white shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
                <div
                  className="flex shrink-0 items-center px-[1.35cqw] text-[clamp(0.3rem,1.15cqw,1.2rem)] font-black tracking-[0.12em]"
                  style={{ backgroundColor: manualAlertToneConfig.accent }}
                >
                  {manualAlertToneConfig.label}
                </div>
                <div className="px-[1.8cqw] py-[1.35cqh] text-left text-[clamp(0.35rem,1.8cqw,2rem)] font-semibold leading-snug">
                  {displayedAlertText}
                </div>
              </div>
            ) : alertSettings ? (
              <div
                className="mx-auto max-w-[86%] rounded-xl border border-white/15 px-[2cqw] py-[1.5cqh] text-center text-[clamp(0.35rem,2cqw,2.2rem)] font-semibold shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                style={{ backgroundColor: alertSettings.backgroundColor, color: alertSettings.textColor }}
              >
                {displayedAlertText}
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
