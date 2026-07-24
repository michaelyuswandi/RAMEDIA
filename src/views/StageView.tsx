import { useEffect } from 'react';
import { usePresentationStore } from '../core/stores/usePresentationStore';
import { sync } from '../core/sync';
import { useSettingsStore } from '../core/stores/useSettingsStore';
import { RoleOutputSurface } from '../components/common/RoleOutputSurface';
import { createDefaultOutputChannel, DEFAULT_OUTPUT_WIDGET_LAYOUTS, DEFAULT_OUTPUT_WIDGET_STYLES, resolveEffectiveOutputChannel, type OutputChannel } from '../core/models/outputSettings';

const DEFAULT_STAGE_OUTPUT_CHANNEL: OutputChannel = createDefaultOutputChannel({
  id: 'stage-view-default',
  name: 'Stage Display',
  role: 'confidence',
  targetType: 'browser-client',
  renderMode: 'custom-layout',
  layoutType: 'singer-confidence',
  enabled: true,
  browserClientId: 'stage',
  widgets: ['currentLyrics', 'nextLyrics', 'clock', 'timer', 'videoCountdown', 'showName', 'progress'],
  widgetLayouts: {
    ...DEFAULT_OUTPUT_WIDGET_LAYOUTS,
    currentLyrics: { x: 3, y: 12, width: 62, height: 53 },
    nextLyrics: { x: 3, y: 70, width: 46, height: 26 },
    previousLyrics: { x: 66, y: 50, width: 29, height: 20 },
    notes: { x: 66, y: 73, width: 29, height: 15 },
    sectionLabel: { x: 3, y: 2, width: 24, height: 8 },
    clock: { x: 68, y: 3, width: 29, height: 18 },
    timer: { x: 68, y: 24, width: 29, height: 26 },
    videoCountdown: { x: 68, y: 53, width: 29, height: 14 },
    showName: { x: 51, y: 70, width: 26, height: 26 },
    progress: { x: 79, y: 70, width: 18, height: 26 },
  },
  widgetStyles: {
    ...DEFAULT_OUTPUT_WIDGET_STYLES,
    currentLyrics: { label: 'Current slide text', fontFamily: 'Manrope, Inter, sans-serif', scale: 1, color: '#ffffff', shadow: true, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.25, borderVisible: true },
    nextLyrics: { label: 'Next slide text', fontFamily: 'Manrope, Inter, sans-serif', scale: 0.8, color: '#94a3b8', shadow: true, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.2, borderVisible: true },
    previousLyrics: { label: 'Previous slide text', fontFamily: 'Manrope, Inter, sans-serif', scale: 0.65, color: '#64748b', shadow: false, textAlign: 'left', backgroundColor: '#000000', backgroundOpacity: 0.14, borderVisible: true },
    notes: { label: 'Notes', fontFamily: 'Manrope, Inter, sans-serif', scale: 0.72, color: '#fef3c7', shadow: false, textAlign: 'left', backgroundColor: '#000000', backgroundOpacity: 0.18, borderVisible: true },
    sectionLabel: { label: 'Section', fontFamily: 'Manrope, Inter, sans-serif', scale: 0.72, color: '#ffffff', shadow: false, textAlign: 'left', backgroundColor: '#000000', backgroundOpacity: 0.12, borderVisible: true },
    clock: { label: 'Clock', fontFamily: 'monospace', scale: 0.9, color: '#ffffff', shadow: false, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.2, borderVisible: true },
    timer: { label: 'Timer', fontFamily: 'monospace', scale: 0.9, color: '#ffffff', shadow: false, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.2, borderVisible: true },
    videoCountdown: { label: 'Video countdown', fontFamily: 'monospace', scale: 0.8, color: '#f59e0b', shadow: false, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.2, borderVisible: true },
    showName: { label: 'Show name', fontFamily: 'Manrope, Inter, sans-serif', scale: 0.85, color: '#ffffff', shadow: false, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.2, borderVisible: true },
    progress: { label: 'Progress', fontFamily: 'monospace', scale: 0.95, color: '#ec4899', shadow: false, textAlign: 'center', backgroundColor: '#000000', backgroundOpacity: 0.2, borderVisible: true },
  },
});

export default function StageView() {
  const { currentSlide, previousSlide, nextSlide, isBlack, isClear, isLogo, liveCapture, mediaPlayback, manualAlert, receiveUpdate } = usePresentationStore();
  const logoOutput = useSettingsStore((state) => state.logoOutput);
  const settings = useSettingsStore();
  const configuredStageOutput = settings.outputs.find((output) => output.enabled && output.role !== 'audience') || null;
  const stageOutput = resolveEffectiveOutputChannel(settings, configuredStageOutput) || DEFAULT_STAGE_OUTPUT_CHANNEL;

  // Listen for sync events
  useEffect(() => {
    const unsub = sync.subscribe('STATE_UPDATE', (msg) => {
      receiveUpdate(msg.type, msg.payload);
    });
    return () => unsub();
  }, []);

  return (
    <div className="h-[100dvh] w-screen bg-black text-white font-sans overflow-hidden">
      <RoleOutputSurface
        role={stageOutput.role}
        outputConfig={stageOutput}
        currentSlide={currentSlide}
        previousSlide={previousSlide}
        nextSlide={nextSlide}
        isBlack={isBlack}
        isClear={isClear}
        isLogo={isLogo}
        logoOutput={logoOutput}
        liveCapture={liveCapture}
        mediaPlayback={mediaPlayback}
        manualAlert={manualAlert}
      />
    </div>
  );
}
