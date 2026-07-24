import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Maximize2,
  Minimize2,
  Plus,
  RefreshCcw,
  Shield,
  Star,
  Trash2,
} from 'lucide-react';
import {
  DEFAULT_BROADCAST_LYRICS_SETTINGS,
  DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT,
  applyScreenLayoutToOutput,
  createBrowserOutputClient,
  type BrowserOutputClient,
  type OutputChannel,
  type OutputDisplayInfo,
  type OutputLayoutType,
  type OutputPreset,
  type OutputWidgetId,
  type ContentThemeType,
} from '../../../core/models/outputSettings';
import type { Template } from '../../../electron/database/schema';
import {
  OUTPUT_CANVAS_PRESETS,
  getAspectRatioLabel,
  getBrowserClientUrls,
  getNdiRuntimeForOutput,
  getOutputTargetSummary,
  type BrowserRuntimeState,
  type NdiRuntimeState,
} from './outputShared';
import { useI18n } from '../../../i18n';
import { RoleOutputSurface } from '../../common/RoleOutputSurface';
import { usePresentationStore } from '../../../core/stores/usePresentationStore';
import type { Slide } from '../../../core/models/types';
import { buildLayersFromSongPreset } from '../../../core/songEditor/songPresets';
import { getScreenLayoutThumbnailSignature, renderScreenLayoutThumbnail } from '../../../core/presets/presetThumbnailRenderer';
import { ipcPresetPreviewService } from '../../../core/services/ipcPresetPreviewService';

interface OutputSettingsWorkspaceProps {
  outputChannels: OutputChannel[];
  selectedOutputId: string | null;
  browserTargets: BrowserOutputClient[];
  songPresets: Template[];
  screenLayouts: OutputPreset[];
  displays: OutputDisplayInfo[];
  browserRuntime: BrowserRuntimeState | null;
  ndiRuntime: NdiRuntimeState | null;
  outputState: {
    isOpen: boolean;
    isFullscreen: boolean;
    openCount: number;
    totalLocalOutputs: number;
  };
  width: number;
  height: number;
  isSafeAreaEnabled: boolean;
  safeArea: number;
  setSelectedOutputId: (id: string | null) => void;
  setScreenLayouts: (layouts: OutputPreset[]) => void;
  addOutput: () => void;
  updateOutput: (outputId: string, updater: (output: OutputChannel) => OutputChannel) => void;
  removeOutput: (outputId: string) => void;
  setPrimaryOutput: (outputId: string) => void;
  addBrowserTarget: (initialName?: string) => BrowserOutputClient;
  updateBrowserTarget: (clientId: string, updater: (client: BrowserOutputClient) => BrowserOutputClient) => void;
  removeBrowserTarget: (clientId: string) => void;
  refreshOutputState: () => Promise<void>;
  applyPreset: (w: number, h: number) => void;
  setWidth: (width: number) => void;
  setHeight: (height: number) => void;
  setIsSafeAreaEnabled: (enabled: boolean) => void;
  setSafeArea: (value: number) => void;
}

const OUTPUT_LAYOUT_OPTIONS: Array<{ id: OutputLayoutType; label: string }> = [
  { id: 'audience-default', label: 'Audience Default' },
  { id: 'worship-leader-foldback', label: 'Worship Leader Foldback' },
  { id: 'singer-confidence', label: 'Singer Confidence' },
  { id: 'minimal-lyrics', label: 'Minimal Lyrics' },
];

const OUTPUT_WIDGET_OPTIONS: Array<{ id: OutputWidgetId; label: string }> = [
  { id: 'slideCanvas', label: 'Slide canvas' },
  { id: 'currentLyrics', label: 'Current lyrics' },
  { id: 'nextLyrics', label: 'Next lyrics' },
  { id: 'previousLyrics', label: 'Previous lyrics' },
  { id: 'sectionLabel', label: 'Section label' },
  { id: 'notes', label: 'Notes' },
  { id: 'clock', label: 'Clock' },
  { id: 'timer', label: 'Timer' },
  { id: 'videoCountdown', label: 'Video countdown' },
  { id: 'showName', label: 'Show name' },
  { id: 'progress', label: 'Progress' },
  { id: 'logo', label: 'Logo' },
  { id: 'alert', label: 'Alert' },
];

const FONT_OPTIONS = [
  { value: 'Manrope, Inter, sans-serif', label: 'Manrope' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Outfit, sans-serif', label: 'Outfit' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
];

const OUTPUT_TRANSITION_OPTIONS: Array<{ id: OutputChannel['transitionSettings']['type']; label: string; description: string }> = [
  { id: 'blend', label: 'Blend', description: 'Smooth crossfade' },
  { id: 'cover', label: 'Cover', description: 'New frame covers old' },
  { id: 'cube', label: 'Cube', description: 'Perspective cube turn' },
  { id: 'drop', label: 'Drop', description: 'Drops into position' },
  { id: 'iris', label: 'Iris', description: 'Circular reveal' },
  { id: 'page-flip', label: 'Page Flip', description: '3D page rotation' },
  { id: 'push', label: 'Push', description: 'Pushes frame aside' },
  { id: 'reveal', label: 'Reveal', description: 'Directional wipe' },
  { id: 'zoom', label: 'Zoom', description: 'Scale and fade' },
  { id: 'none', label: 'None', description: 'Immediate change' },
];

const BROADCAST_LYRICS_PRESETS = [
  {
    id: 'youtube-lower-third',
    name: 'YouTube Lower Third',
    description: 'Area aman di bawah, cocok di atas kamera atau background OBS.',
    settings: { ...DEFAULT_BROADCAST_LYRICS_SETTINGS },
  },
  {
    id: 'wide-subtitle',
    name: 'Wide Subtitle',
    description: 'Dua sampai tiga baris besar di bagian bawah layar.',
    settings: { ...DEFAULT_BROADCAST_LYRICS_SETTINGS, x: 5, y: 73, width: 90, height: 20, maxLines: 3, maxFontSize: 82 },
  },
  {
    id: 'center-lyrics',
    name: 'Center Lyrics',
    description: 'Kotak tengah untuk program dengan ruang visual lebih longgar.',
    settings: { ...DEFAULT_BROADCAST_LYRICS_SETTINGS, x: 14, y: 35, width: 72, height: 32, maxLines: 5, maxFontSize: 88 },
  },
] as const;

export function OutputSettingsWorkspace(props: OutputSettingsWorkspaceProps) {
  const { t } = useI18n();
  const {
    outputChannels,
    selectedOutputId,
    browserTargets,
    songPresets,
    screenLayouts,
    displays,
    browserRuntime,
    ndiRuntime,
    outputState,
    width,
    height,
    isSafeAreaEnabled,
    safeArea,
    setSelectedOutputId,
    setScreenLayouts,
    addOutput,
    updateOutput: updateOutputChannel,
    removeOutput,
    setPrimaryOutput,
    addBrowserTarget,
    updateBrowserTarget,
    refreshOutputState,
    applyPreset,
    setWidth,
    setHeight,
    setIsSafeAreaEnabled,
    setSafeArea,
  } = props;

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'output' | 'browser' | 'canvas'>('output');

  useEffect(() => {
    let cancelled = false;
    const staleLayouts = screenLayouts.filter((layout) => (
      !layout.thumbnail || layout.thumbnailSignature !== getScreenLayoutThumbnailSignature(layout)
    ));
    if (!staleLayouts.length) return () => { cancelled = true; };

    void (async () => {
      let nextLayouts = screenLayouts;
      for (const layout of staleLayouts) {
        try {
          const dataUrl = await renderScreenLayoutThumbnail(layout);
          const thumbnail = await ipcPresetPreviewService.save(`screen-${layout.id}`, dataUrl, layout.thumbnail);
          const updated = { ...layout, thumbnail, thumbnailSignature: getScreenLayoutThumbnailSignature(layout) };
          nextLayouts = nextLayouts.map((item) => item.id === layout.id ? updated : item);
        } catch (previewError) {
          console.warn(`[Preset Preview] Unable to generate Screen Layout thumbnail for ${layout.name}.`, previewError);
        }
      }
      if (!cancelled && nextLayouts !== screenLayouts) setScreenLayouts(nextLayouts);
    })();

    return () => { cancelled = true; };
  }, [screenLayouts, setScreenLayouts]);

  const [activeOutputTab, setActiveOutputTab] = useState<'general' | 'song' | 'scripture' | 'presentations' | 'widgets' | 'transitions' | 'alerts'>('general');
  const [transitionTarget, setTransitionTarget] = useState<'slide' | 'black' | 'clear'>('slide');
  const [transitionPreviewState, setTransitionPreviewState] = useState<'slide' | 'black' | 'clear'>('slide');
  const [transitionPreviewNonce, setTransitionPreviewNonce] = useState(0);
  const [isChannelBarExpanded, setIsChannelBarExpanded] = useState(true);
  const [isPreviewCollapsed, setIsPreviewCollapsed] = useState(false);
  const [isPreviewMaximized, setIsPreviewMaximized] = useState(false);
  const [previewSource, setPreviewSource] = useState<'sample' | 'live'>('sample');
  const previewCanvasRef = useRef<HTMLDivElement | null>(null);
  const transitionPreviewTimerRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    widgetId: OutputWidgetId;
    mode: 'move' | 'resize';
    startX: number;
    startY: number;
    startLayout: OutputChannel['widgetLayouts'][OutputWidgetId];
  } | null>(null);
  const liveSlide = usePresentationStore((state) => state.currentSlide);
  const livePreviousSlide = usePresentationStore((state) => state.previousSlide);
  const liveNextSlide = usePresentationStore((state) => state.nextSlide);
  const liveMediaPlayback = usePresentationStore((state) => state.mediaPlayback);
  const songContentThemes = useMemo(() => songPresets.filter((theme) => (theme.contentType || 'song') === 'song'), [songPresets]);

  useEffect(() => {
    if (activeOutputTab !== 'general') setActiveOutputTab('general');
  }, [activeOutputTab]);

  // Sync state with selected output/browser targets
  const rawSelectedOutput = useMemo(
    () => outputChannels.find((output) => output.id === selectedOutputId) ?? outputChannels[0] ?? null,
    [outputChannels, selectedOutputId],
  );
  const selectedOutputPreset = useMemo(
    () => screenLayouts.find((layout) => layout.id === rawSelectedOutput?.outputPresetId)
      ?? screenLayouts.find((layout) => layout.role === rawSelectedOutput?.role)
      ?? screenLayouts[0]
      ?? null,
    [rawSelectedOutput, screenLayouts],
  );
  const selectedOutput = useMemo(
    () => rawSelectedOutput ? applyScreenLayoutToOutput(rawSelectedOutput, selectedOutputPreset) : null,
    [rawSelectedOutput, selectedOutputPreset],
  );
  const selectedSongTheme = useMemo(() => {
    const rule = selectedOutputPreset?.contentRules.song;
    if (!rule || rule.policy === 'follow' || !rule.themeId) return null;
    return songContentThemes.find((theme) => theme.id === rule.themeId) || null;
  }, [selectedOutputPreset, songContentThemes]);
  const selectedNdiRuntime = selectedOutput ? getNdiRuntimeForOutput(selectedOutput.id, ndiRuntime) : null;


  const activeTransitionSettings = selectedOutput
    ? transitionTarget === 'slide'
      ? selectedOutput.transitionSettings
      : selectedOutput.stateTransitionSettings[transitionTarget]
    : null;

  const updateActiveTransitionSettings = (
    updater: (settings: OutputChannel['transitionSettings']) => OutputChannel['transitionSettings'],
  ) => {
    if (!selectedOutput) return;
    updateOutput(selectedOutput.id, (output) => {
      if (transitionTarget === 'slide') return { ...output, transitionSettings: updater(output.transitionSettings) };
      return {
        ...output,
        stateTransitionSettings: {
          ...output.stateTransitionSettings,
          [transitionTarget]: updater(output.stateTransitionSettings[transitionTarget]),
        },
      };
    });
  };

  const updateOutputPreset = (_layoutId: string, updater: (preset: OutputPreset) => OutputPreset) => {
    if (!selectedOutputPreset) return;
    setScreenLayouts(screenLayouts.map((layout) => layout.id === selectedOutputPreset.id ? updater(layout) : layout));
  };

  // Output Settings owns routing only. Visual changes belong exclusively to
  // the assigned Screen Layout and must never be written back from this view.
  const updateOutput = (outputId: string, updater: (output: OutputChannel) => OutputChannel) => {
    updateOutputChannel(outputId, updater);
  };

  const renderContentThemeRule = (contentType: ContentThemeType, title: string) => {
    if (!selectedOutputPreset) return null;
    const rule = selectedOutputPreset.contentRules[contentType];
    const themes = songPresets.filter((theme) => (theme.contentType || 'song') === contentType);
    return (
      <div className="grid gap-3 border-b border-white/5 pb-4 md:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)] md:gap-6">
        <div><label className="text-xs font-semibold text-text/80">{title} theme policy</label><div className="mt-0.5 text-[11px] leading-relaxed text-text/40">Stored inside this Screen Layout. It affects rendered-slide and hybrid compositions.</div></div>
        <div className="space-y-3">
          <div className="grid grid-cols-3 rounded-lg border border-white/10 bg-black/10 p-1">
            {([{ id: 'follow', label: 'Follow Content' }, { id: 'fallback', label: 'Fallback Theme' }, { id: 'force', label: 'Force Theme' }] as const).map((option) => (
              <button key={option.id} type="button" onClick={() => updateOutputPreset(selectedOutputPreset.id, (layout) => ({ ...layout, contentRules: { ...layout.contentRules, [contentType]: { ...rule, policy: option.id } } }))} className={`h-8 rounded-md text-[10px] font-semibold transition active:scale-[0.98] ${rule.policy === option.id ? 'bg-primary text-white' : 'text-text/55 hover:bg-white/5 hover:text-text'}`}>{option.label}</button>
            ))}
          </div>
          {rule.policy !== 'follow' && <div className="space-y-1.5"><select value={rule.themeId || ''} onChange={(event) => { const theme = themes.find((item) => item.id === event.target.value) || null; updateOutputPreset(selectedOutputPreset.id, (layout) => ({ ...layout, contentRules: { ...layout.contentRules, [contentType]: { ...rule, themeId: theme?.id || null, themeName: theme?.name || null, themeLayersData: theme?.layersData || null } } })); }} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"><option value="">Select a {title} Theme</option>{themes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}</select>{themes.length === 0 && <p className="text-[10px] text-text/38">No {title.toLowerCase()} Content Themes exist yet.</p>}</div>}
        </div>
      </div>
    );
  };



  useEffect(() => {
    if (selectedOutput?.targetType === 'browser-client') {
      const existing = browserTargets.find((c) => c.id === selectedOutput.browserClientId);
      if (!existing) {
        const newClient = addBrowserTarget(selectedOutput.name);
        updateOutput(selectedOutput.id, (output) => ({ ...output, browserClientId: newClient.id }));
      }
    }
  }, [selectedOutput, browserTargets, addBrowserTarget, updateOutput]);

  const copyToClipboard = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1800);
    } catch {
      setCopiedKey(null);
    }
  };



  const toggleOutputWidget = (widgetId: OutputWidgetId, enabled: boolean) => {
    if (!selectedOutput) return;
    updateOutput(selectedOutput.id, (output) => {
      const current = new Set(output.widgets);
      if (enabled) current.add(widgetId);
      else current.delete(widgetId);
      const widgets = Array.from(current);
      return {
        ...output,
        widgets: widgets.length > 0 ? widgets : DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT[output.layoutType],
      };
    });
  };

  const updateWidgetLayout = (
    widgetId: OutputWidgetId,
    key: keyof OutputChannel['widgetLayouts'][OutputWidgetId],
    value: number,
  ) => {
    if (!selectedOutput) return;
    updateOutput(selectedOutput.id, (output) => ({
      ...output,
      outputPresetId: null,
      widgetLayouts: {
        ...output.widgetLayouts,
        [widgetId]: { ...output.widgetLayouts[widgetId], [key]: value },
      },
    }));
  };

  const updateWidgetStyle = <Key extends keyof OutputChannel['widgetStyles'][OutputWidgetId]>(
    widgetId: OutputWidgetId,
    key: Key,
    value: OutputChannel['widgetStyles'][OutputWidgetId][Key],
  ) => {
    if (!selectedOutput) return;
    updateOutput(selectedOutput.id, (output) => ({
      ...output,
      outputPresetId: null,
      widgetStyles: {
        ...output.widgetStyles,
        [widgetId]: { ...output.widgetStyles[widgetId], [key]: value },
      },
    }));
  };

  const fallbackPreviewSlide = useMemo<Slide>(() => {
    if (activeOutputTab === 'scripture') {
      return {
        id: 'output-settings-bible-preview',
        type: 'bible',
        content: 'Mazmur 23:1\n\n1 TUHAN adalah gembalaku, takkan kekurangan aku.',
        notes: 'Scripture output alert preview',
        layers: [
          { id: 'layer-bible-base-preview', layerType: 'base', layerOrder: 1, visible: true, opacity: 1, content: '#05070a', style: null },
          { id: 'layer-bible-reference-preview', layerType: 'text', layerOrder: 4, visible: true, opacity: 1, content: 'Mazmur 23:1', style: JSON.stringify({ x: 86, y: 90, boxWidth: 24, scale: 0.58, textAlign: 'right', color: '#facc15', fontWeight: 700 }) },
          { id: 'layer-bible-text-preview', layerType: 'text', layerOrder: 5, visible: true, opacity: 1, content: '1 TUHAN adalah gembalaku,\ntakkan kekurangan aku.', style: JSON.stringify({ x: 50, y: 54, boxWidth: 82, scale: 0.9, textAlign: 'center', color: '#ffffff', fontWeight: 600 }) },
          { id: 'layer-bible-version-preview', layerType: 'text', layerOrder: 6, visible: true, opacity: 1, content: 'TB', style: JSON.stringify({ x: 12, y: 90, boxWidth: 12, scale: 0.42, textAlign: 'left', color: '#cbd5e1', fontWeight: 700 }) },
        ],
      } as Slide;
    }
    if (activeOutputTab === 'presentations') {
      return {
        id: 'output-settings-presentation-preview',
        type: 'custom',
        content: 'Sunday Service\nWelcome to RAMEDIA',
        notes: 'Service begins in five minutes',
        layers: [
          { id: 'presentation-base-preview', layerType: 'base', layerOrder: 1, visible: true, opacity: 1, content: '#111318', style: null },
          { id: 'presentation-text-preview', layerType: 'text', layerOrder: 5, visible: true, opacity: 1, content: 'Sunday Service\nWelcome to RAMEDIA', style: JSON.stringify({ x: 50, y: 50, boxWidth: 76, scale: 0.9, textAlign: 'center', color: '#ffffff', fontWeight: 650 }) },
        ],
      } as Slide;
    }
    const slideId = 'output-settings-song-preview';
    const content = 'Besar setia-Mu\nKasih-Mu tak berkesudahan';
    return {
      id: slideId,
      type: 'lyrics',
      content,
      label: 'Chorus',
      sectionType: 'chorus',
      notes: 'Bridge after chorus',
      layers: buildLayersFromSongPreset(slideId, content, selectedSongTheme, undefined, { songTitle: 'Besar Setia-Mu', sectionLabel: 'Chorus' }),
    };
  }, [activeOutputTab, selectedSongTheme]);

  const sourcePreviewSlide = previewSource === 'live' && liveSlide && (
    activeOutputTab === 'general' ? true
      : activeOutputTab === 'scripture' ? liveSlide.type === 'bible'
      : activeOutputTab === 'presentations' ? ['custom', 'media', 'image', 'video'].includes(liveSlide.type)
        : liveSlide.type === 'lyrics'
  ) ? liveSlide : fallbackPreviewSlide;
  const previewSlide = useMemo(() => {
    if (sourcePreviewSlide.type !== 'lyrics' || !selectedSongTheme) return sourcePreviewSlide;
    const rule = selectedOutputPreset?.contentRules.song;
    if (previewSource === 'live' && rule?.policy !== 'force') return sourcePreviewSlide;
    return {
      ...sourcePreviewSlide,
      layers: buildLayersFromSongPreset(
        sourcePreviewSlide.id,
        sourcePreviewSlide.content || '',
        selectedSongTheme,
        undefined,
        { songTitle: 'Live Song', sectionLabel: sourcePreviewSlide.label || sourcePreviewSlide.sectionType || 'Lyrics' },
      ),
    } as Slide;
  }, [previewSource, selectedOutputPreset, selectedSongTheme, sourcePreviewSlide]);
  const previewPreviousSlide = previewSource === 'live' ? livePreviousSlide : {
    ...fallbackPreviewSlide,
    id: `${fallbackPreviewSlide.id}-previous`,
    content: 'Kau tetap Allah yang setia',
    label: 'Verse',
    sectionType: 'verse',
  } as Slide;
  const previewNextSlide = previewSource === 'live' ? liveNextSlide : {
    ...fallbackPreviewSlide,
    id: `${fallbackPreviewSlide.id}-next`,
    content: 'Sampai selama-lamanya',
    label: 'Bridge',
    sectionType: 'bridge',
  } as Slide;

  const handleWidgetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    const rect = previewCanvasRef.current?.getBoundingClientRect();
    if (!drag || !rect || !selectedOutput) return;
    const dx = ((event.clientX - drag.startX) / rect.width) * 100;
    const dy = ((event.clientY - drag.startY) / rect.height) * 100;
    if (drag.mode === 'move') {
      updateWidgetLayout(drag.widgetId, 'x', Math.max(0, Math.min(100 - drag.startLayout.width, drag.startLayout.x + dx)));
      updateWidgetLayout(drag.widgetId, 'y', Math.max(0, Math.min(100 - drag.startLayout.height, drag.startLayout.y + dy)));
    } else {
      updateWidgetLayout(drag.widgetId, 'width', Math.max(8, Math.min(100 - drag.startLayout.x, drag.startLayout.width + dx)));
      updateWidgetLayout(drag.widgetId, 'height', Math.max(6, Math.min(100 - drag.startLayout.y, drag.startLayout.height + dy)));
    }
  };

  const previewTransition = () => {
    if (transitionPreviewTimerRef.current != null) window.clearTimeout(transitionPreviewTimerRef.current);
    setTransitionPreviewState('slide');
    transitionPreviewTimerRef.current = window.setTimeout(() => {
      if (transitionTarget === 'slide') setTransitionPreviewNonce((current) => current + 1);
      else setTransitionPreviewState(transitionTarget);
    }, 40);
  };

  useEffect(() => () => {
    if (transitionPreviewTimerRef.current != null) window.clearTimeout(transitionPreviewTimerRef.current);
  }, []);

  useEffect(() => {
    if (!isPreviewMaximized) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsPreviewMaximized(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isPreviewMaximized]);

  return (
    <div className="flex min-h-[620px] flex-col gap-2 p-3 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Compact, collapsible output navigation */}
      <div className="flex w-full shrink-0 items-center gap-2 rounded-lg border border-white/8 bg-white/[0.02] p-1.5">
        <div className="shrink-0 px-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-text/45">{t('outputWorkspace.channels')}</div>
          <div className="mt-0.5 text-[9px] text-text/30">{outputChannels.length} channels</div>
        </div>

        <div className="h-8 w-px shrink-0 bg-white/8" />

        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
          {(isChannelBarExpanded ? outputChannels : selectedType === 'output' && selectedOutput ? [selectedOutput] : []).map((output) => {
            const isSelected = selectedType === 'output' && selectedOutput?.id === output.id;
            return (
              <button
                key={output.id}
                onClick={() => {
                  setSelectedType('output');
                  setSelectedOutputId(output.id);
                }}
                className={`flex h-9 min-w-[132px] max-w-[210px] items-center gap-2 rounded-lg border px-3 text-left text-xs transition-colors ${
                  isSelected
                    ? 'border-primary/35 bg-primary/10 text-text'
                    : 'border-white/8 bg-white/[0.025] text-text/60 hover:bg-white/[0.06] hover:text-text/85'
                }`}
              >
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${output.enabled ? 'bg-primary' : 'bg-text/20'}`} />
                <span className="min-w-0 flex-1 truncate font-semibold">{output.name}</span>
                {output.isPrimary && <span className="rounded border border-primary/30 bg-primary/15 px-1 py-0.5 text-[8px] font-extrabold text-primary">PRI</span>}
              </button>
            );
          })}

          {!isChannelBarExpanded && selectedType === 'canvas' && (
            <button type="button" onClick={() => setIsChannelBarExpanded(true)} className="flex h-9 min-w-[170px] items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-primary">
              <Shield size={13} /> Canvas & Safe Area
            </button>
          )}

          {isChannelBarExpanded && (
            <>
              <button onClick={addOutput} className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-primary hover:bg-primary/10">
                <Plus size={13} /> {t('outputWorkspace.add')}
              </button>
              <div className="mx-1 h-8 w-px shrink-0 bg-white/8" />
              <button
                onClick={() => setSelectedType('canvas')}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-xs font-semibold transition-colors ${selectedType === 'canvas' ? 'border-primary/30 bg-primary/10 text-primary' : 'border-white/8 bg-white/[0.025] text-text/60 hover:bg-white/[0.06] hover:text-text/85'}`}
              >
                <Shield size={13} /> Canvas & Safe Area
              </button>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsChannelBarExpanded((current) => !current)}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/8 bg-white/[0.025] text-text/55 hover:bg-white/[0.07] hover:text-text"
          aria-label={isChannelBarExpanded ? 'Collapse output channels' : 'Expand output channels'}
          title={isChannelBarExpanded ? 'Collapse output channels' : 'Expand output channels'}
        >
          {isChannelBarExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Full-width details config pane */}
      <div className="w-full flex-1 min-w-0 rounded-xl border border-white/8 bg-white/[0.02] p-3">
        {selectedType === 'output' && selectedOutput ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <h3 className="shrink-0 text-sm font-semibold text-text">{selectedOutput.name}</h3>
                <span className="truncate border-l border-white/8 pl-2.5 text-[11px] text-text/40">
                  {selectedOutput.targetType === 'electron-display' ? t('outputWorkspace.local') : selectedOutput.targetType === 'browser-client' ? t('outputWorkspace.browser') : t('outputWorkspace.ndi')} · {getOutputTargetSummary(selectedOutput, displays, browserTargets)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!selectedOutput.isPrimary && (
                  <button
                    onClick={() => setPrimaryOutput(selectedOutput.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-text/80 hover:bg-white/10"
                  >
                    <Star size={13} />
                    {t('outputWorkspace.active')}
                  </button>
                )}
                <button
                  onClick={() => removeOutput(selectedOutput.id)}
                  disabled={outputChannels.length <= 1}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={13} />
                  {t('outputWorkspace.remove')}
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3 border-b border-white/8 bg-white/[0.018] px-3 py-3">
              <Shield size={15} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <div className="text-xs font-semibold text-text/80">{t('outputWorkspace.routingAndScreenAssignment')}</div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text/40">
                  {t('outputWorkspace.routingAndScreenAssignmentDetails')}
                </p>
              </div>
            </div>

            <div className="output-settings-tab-grid">
              {(['general', 'song', 'scripture', 'presentations', 'widgets', 'transitions', 'alerts'] as const).includes(activeOutputTab as any) && (
                <div className="output-preview-pane min-w-0 rounded-xl border border-white/8 bg-white/[0.018] p-3">
                  <div className={isPreviewMaximized ? 'fixed inset-4 z-[120] flex min-h-0 flex-col rounded-2xl border border-white/10 bg-[#17181c] p-4 shadow-2xl' : 'min-w-0'}>
                    <div className="mb-2 flex min-h-8 items-center justify-between gap-3 text-[10px] text-text/40">
                      <div className="flex items-center gap-2">
                        <span className="font-bold tracking-wider">{t('outputWorkspace.outputPreview')}</span>
                        {isPreviewCollapsed && !isPreviewMaximized && <span className="normal-case text-text/30">Preview minimized</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex rounded-md border border-white/8 bg-black/10 p-0.5">
                          {(['sample', 'live'] as const).map((source) => (
                            <button
                              key={source}
                              type="button"
                              onClick={() => setPreviewSource(source)}
                              className={`rounded px-2 py-1 text-[9px] font-semibold capitalize transition ${previewSource === source ? 'bg-primary/18 text-primary' : 'text-text/35 hover:text-text/65'}`}
                            >
                              {source}
                            </button>
                          ))}
                        </div>
                        <span className="mr-1 font-mono">{width} × {height}</span>
                        {!isPreviewMaximized && (
                          <button
                            type="button"
                            onClick={() => setIsPreviewCollapsed((current) => !current)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.025] text-text/55 hover:bg-white/[0.07] hover:text-text"
                            aria-label={isPreviewCollapsed ? 'Show output preview' : 'Minimize output preview'}
                            title={isPreviewCollapsed ? 'Show output preview' : 'Minimize output preview'}
                          >
                            {isPreviewCollapsed ? <ChevronDown size={14} /> : <Minimize2 size={14} />}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setIsPreviewCollapsed(false);
                            setIsPreviewMaximized((current) => !current);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/8 bg-white/[0.025] text-text/55 hover:bg-white/[0.07] hover:text-text"
                          aria-label={isPreviewMaximized ? 'Exit full preview' : 'Maximize output preview'}
                          title={isPreviewMaximized ? 'Exit full preview (Esc)' : 'Maximize output preview'}
                        >
                          {isPreviewMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                        </button>
                      </div>
                    </div>

                    {(!isPreviewCollapsed || isPreviewMaximized) && (
                      <>
                        <div
                          ref={previewCanvasRef}
                          className="relative mx-auto w-full shrink-0 touch-none overflow-hidden rounded-xl border border-white/10 bg-black shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                          style={{
                            aspectRatio: `${Math.max(1, width)} / ${Math.max(1, height)}`,
                            maxWidth: isPreviewMaximized
                              ? `min(100%, calc((100vh - 150px) * ${Math.max(1, width)} / ${Math.max(1, height)}))`
                              : `min(100%, calc(56vh * ${Math.max(1, width)} / ${Math.max(1, height)}))`,
                            background: selectedOutput.targetType === 'ndi' && selectedOutput.ndiConfig.contentMode === 'broadcast-lyrics'
                              ? 'repeating-conic-gradient(#24272d 0 25%, #191c21 0 50%) 50% / 20px 20px'
                              : undefined,
                          }}
                          onPointerMove={handleWidgetPointerMove}
                          onPointerUp={() => { dragStateRef.current = null; }}
                          onPointerCancel={() => { dragStateRef.current = null; }}
                        >
                          <RoleOutputSurface
                            role={selectedOutput.role}
                            outputConfig={selectedOutput}
                            outputName={selectedOutput.name}
                            currentSlide={{ ...previewSlide, id: `${previewSlide.id}-${transitionPreviewNonce}` }}
                            previousSlide={previewPreviousSlide}
                            nextSlide={previewNextSlide}
                            isBlack={activeOutputTab === 'transitions' && transitionPreviewState === 'black'}
                            isClear={activeOutputTab === 'transitions' && transitionPreviewState === 'clear'}
                            mediaPlayback={previewSource === 'live' ? liveMediaPlayback : null}
                            transparentBackground={selectedOutput.targetType === 'ndi' && selectedOutput.ndiConfig.alphaEnabled}
                            canvasWidth={width}
                            canvasHeight={height}
                          />
                          {isSafeAreaEnabled && (
                            <div
                              className="pointer-events-none absolute z-40 border border-dashed border-white/20"
                              style={{ inset: `${safeArea}%` }}
                            />
                          )}
                          {selectedOutput.renderMode === 'custom-layout' && activeOutputTab === 'widgets' && selectedOutput.widgets.map((widgetId) => {
                            const layout = selectedOutput.widgetLayouts[widgetId];
                            return (
                              <div
                                key={widgetId}
                                className="absolute z-50 cursor-move border border-primary/70 bg-primary/5"
                                style={{ left: `${layout.x}%`, top: `${layout.y}%`, width: `${layout.width}%`, height: `${layout.height}%` }}
                                onPointerDown={(event) => {
                                  event.currentTarget.setPointerCapture(event.pointerId);
                                  dragStateRef.current = { widgetId, mode: 'move', startX: event.clientX, startY: event.clientY, startLayout: { ...layout } };
                                }}
                              >
                                <span className="pointer-events-none absolute left-1 top-1 rounded bg-black/65 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/80">
                                  {selectedOutput.widgetStyles[widgetId].label}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Resize ${widgetId}`}
                                  className="absolute -bottom-1 -right-1 h-3 w-3 cursor-nwse-resize rounded-sm border border-black/50 bg-primary"
                                  onPointerDown={(event) => {
                                    event.stopPropagation();
                                    event.currentTarget.setPointerCapture(event.pointerId);
                                    dragStateRef.current = { widgetId, mode: 'resize', startX: event.clientX, startY: event.clientY, startLayout: { ...layout } };
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <div className="mx-auto mt-2 flex w-full items-center justify-between gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2 text-[10px] text-text/40" style={{ maxWidth: isPreviewMaximized ? `min(100%, calc((100vh - 150px) * ${Math.max(1, width)} / ${Math.max(1, height)}))` : `min(100%, calc(56vh * ${Math.max(1, width)} / ${Math.max(1, height)}))` }}>
                          <span>Canvas {width} × {height} · {getAspectRatioLabel(width, height)}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setIsPreviewMaximized(false);
                              setActiveOutputTab(selectedOutput.renderMode === 'custom-layout' ? 'widgets' : 'general');
                            }}
                            className="font-semibold text-primary hover:text-primary/80"
                          >
                            {selectedOutput.renderMode === 'custom-layout' ? 'Configure output layout' : 'Configure screen target'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {activeOutputTab === 'song' && (
                <div className="space-y-4">
                  <div className="flex flex-col gap-2 border-b border-white/5 pb-4 md:flex-row md:gap-6">
                    <div className="md:w-1/3">
                      <label className="text-xs font-semibold text-text/80">Song theme policy</label>
                      <div className="mt-0.5 text-[11px] leading-relaxed text-text/40">This rule belongs to the selected Screen Layout and travels with it to every assigned output.</div>
                    </div>
                    <div className="min-w-0 max-w-xl flex-1 space-y-3">
                      <div className="grid grid-cols-3 rounded-lg border border-white/10 bg-black/10 p-1">
                        {[
                          { id: 'follow' as const, label: 'Follow Song' },
                          { id: 'fallback' as const, label: 'Fallback Theme' },
                          { id: 'force' as const, label: 'Force Theme' },
                        ].map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => selectedOutputPreset && updateOutputPreset(selectedOutputPreset.id, (layout) => ({
                              ...layout,
                              contentRules: {
                                ...layout.contentRules,
                                song: { ...layout.contentRules.song, policy: option.id },
                              },
                            }))}
                            className={`h-8 rounded-md text-xs font-semibold transition active:scale-[0.98] ${
                              selectedOutputPreset?.contentRules.song.policy === option.id ? 'bg-primary text-white' : 'text-text/55 hover:bg-white/5 hover:text-text'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>

                      {selectedOutputPreset?.contentRules.song.policy !== 'follow' ? (
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/40">Song Content Theme</label>
                          <select
                            value={selectedOutputPreset.contentRules.song.themeId || ''}
                            onChange={(event) => { const theme = songContentThemes.find((item) => item.id === event.target.value) || null; updateOutputPreset(selectedOutputPreset.id, (layout) => ({
                              ...layout,
                              contentRules: {
                                ...layout.contentRules,
                                song: { ...layout.contentRules.song, themeId: theme?.id || null, themeName: theme?.name || null, themeLayersData: theme?.layersData || null },
                              },
                            })); }}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                          >
                            <option value="">Select a Song Theme</option>
                            {songContentThemes.map((preset) => (
                              <option key={preset.id} value={preset.id}>{preset.name}</option>
                            ))}
                          </select>
                          {!selectedOutputPreset.contentRules.song.themeId && <p className="text-[10px] text-amber-300/75">Choose a Song Theme so this policy has a deterministic result.</p>}
                        </div>
                      ) : (
                        <p className="text-[11px] leading-relaxed text-text/40">Custom slide layers and the Song Theme attached to each song remain authoritative.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Output Name */}
              <div className={`${activeOutputTab === 'general' ? 'flex' : 'hidden'} flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4`}>
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">{t('outputWorkspace.outputName')}</label>
                  <div className="text-[11px] text-text/40 mt-0.5">{t('outputWorkspace.outputNameDesc')}</div>
                </div>
                <div className="flex-1 max-w-md">
                  <input
                    value={selectedOutput.name}
                    onChange={(e) => {
                      const newName = e.target.value || t('outputWorkspace.untitledOutput');
                      updateOutput(selectedOutput.id, (output) => ({ ...output, name: newName }));
                      if (selectedOutput.targetType === 'browser-client' && selectedOutput.browserClientId) {
                        updateBrowserTarget(selectedOutput.browserClientId, (client) => ({ ...client, name: newName }));
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Output Purpose */}
              <div className={`${activeOutputTab === 'general' ? 'grid' : 'hidden'} gap-3 border-b border-white/5 pb-4 md:grid-cols-[minmax(180px,1fr)_minmax(0,2fr)] md:gap-6`}>
                <div>
                  <label className="text-xs font-semibold text-text/80">Screen Layout</label>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-text/40">{t('outputWorkspace.screenLayoutDesc')}</div>
                </div>
                <div className="space-y-2">
                  <div>
                    <select
                      value={rawSelectedOutput?.outputPresetId || selectedOutputPreset?.id || ''}
                      onChange={(event) => {
                        const layout = screenLayouts.find((item) => item.id === event.target.value);
                        if (!rawSelectedOutput || !layout) return;
                        updateOutputChannel(rawSelectedOutput.id, (output) => ({
                          ...output,
                          outputPresetId: layout.id,
                          role: layout.role,
                          ndiConfig: output.targetType === 'ndi' && layout.canvasBackground === 'transparent'
                            ? { ...output.ndiConfig, alphaEnabled: true, contentMode: 'full-output' }
                            : output.ndiConfig,
                        }));
                      }}
                      className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                    >
                      {screenLayouts.map((layout) => <option key={layout.id} value={layout.id}>{layout.name} · {layout.purpose}</option>)}
                    </select>
                  </div>
                  {selectedOutputPreset && (
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-text/40">
                      <span className="rounded border border-white/8 bg-white/[0.03] px-2 py-1">{selectedOutputPreset.renderMode === 'custom-layout' ? t('outputWorkspace.widgetsCount', { count: selectedOutputPreset.widgets.length }) : 'Rendered slide'}</span>
                      <span className="rounded border border-white/8 bg-white/[0.03] px-2 py-1 capitalize">{selectedOutputPreset.purpose}</span>
                      <span>{t('outputWorkspace.screenLayoutChangesHint')}</span>
                    </div>
                  )}
                </div>
              </div>

              {activeOutputTab === 'scripture' && (
                <div className="space-y-5">
                  {renderContentThemeRule('scripture', 'Scripture')}
                  <div className="border-t border-white/5 pt-4 text-[11px] leading-5 text-text/45">
                    Typography, colors, reference and version visibility, background, and composition are defined in
                    <span className="font-semibold text-text/70"> Content Theme — Scripture</span>. This Screen Layout only decides whether the output follows the Bible item's theme, uses a fallback, or forces one theme.
                  </div>
                </div>
              )}

              {activeOutputTab === 'presentations' && (
                <div className="space-y-5">
                  {renderContentThemeRule('presentation', 'Presentation')}
                  {renderContentThemeRule('media', 'Media')}
                  <div className="grid gap-5 md:grid-cols-2">
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold text-text/80">Media fitting</span>
                    <span className="block text-[11px] text-text/40">How images, videos and presentation pages fit this output.</span>
                    <select value={selectedOutput.presentationSettings.mediaFit} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, presentationSettings: { ...output.presentationSettings, mediaFit: event.target.value as OutputChannel['presentationSettings']['mediaFit'] } }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none">
                      <option value="contain">Contain</option>
                      <option value="cover">Cover</option>
                      <option value="fill">Stretch</option>
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="flex justify-between text-xs font-semibold text-text/80"><span>Presentation text scale</span><span className="font-mono text-text/50">{selectedOutput.presentationSettings.textScale.toFixed(2)}x</span></span>
                    <span className="block text-[11px] text-text/40">Scales text layers without changing the source presentation.</span>
                    <input type="range" min="0.5" max="2" step="0.05" value={selectedOutput.presentationSettings.textScale} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, presentationSettings: { ...output.presentationSettings, textScale: Number(event.target.value) } }))} className="w-full accent-[var(--color-primary)]" />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-xs text-text/65">
                    Canvas background
                    <input type="color" value={selectedOutput.presentationSettings.backgroundColor} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, presentationSettings: { ...output.presentationSettings, backgroundColor: event.target.value } }))} className="h-8 w-12 rounded border border-white/10 bg-transparent p-1" />
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-xs text-text/65">
                    <input type="checkbox" checked={selectedOutput.presentationSettings.showAnnotations} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, presentationSettings: { ...output.presentationSettings, showAnnotations: event.target.checked } }))} className="h-4 w-4 accent-[var(--color-primary)]" />
                    Show drawn annotations
                  </label>
                  </div>
                </div>
              )}

              {activeOutputTab === 'alerts' && (
                <div className="space-y-5">
                  <label className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/[0.025] p-4">
                    <input type="checkbox" checked={selectedOutput.alertSettings.enabled} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, alertSettings: { ...output.alertSettings, enabled: event.target.checked } }))} className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]" />
                    <span><span className="block text-xs font-semibold text-text/80">Show slide notes as an output alert</span><span className="mt-1 block text-[11px] leading-relaxed text-text/40">When a new slide has notes, this output displays them temporarily as a banner.</span></span>
                  </label>
                  <div className={`grid gap-4 md:grid-cols-2 ${selectedOutput.alertSettings.enabled ? '' : 'pointer-events-none opacity-40'}`}>
                    <label className="space-y-1.5"><span className="block text-xs font-semibold text-text/70">Position</span><select value={selectedOutput.alertSettings.position} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, alertSettings: { ...output.alertSettings, position: event.target.value === 'bottom' ? 'bottom' : 'top' } }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"><option value="top">Top</option><option value="bottom">Bottom</option></select></label>
                    <label className="space-y-1.5"><span className="flex justify-between text-xs font-semibold text-text/70"><span>Duration</span><span className="font-mono text-text/45">{(selectedOutput.alertSettings.durationMs / 1000).toFixed(1)}s</span></span><input type="range" min="1000" max="30000" step="500" value={selectedOutput.alertSettings.durationMs} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, alertSettings: { ...output.alertSettings, durationMs: Number(event.target.value) } }))} className="w-full accent-[var(--color-primary)]" /></label>
                    <label className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-xs text-text/65">Background<input type="color" value={selectedOutput.alertSettings.backgroundColor} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, alertSettings: { ...output.alertSettings, backgroundColor: event.target.value } }))} className="h-8 w-12 rounded border border-white/10 bg-transparent p-1" /></label>
                    <label className="flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-xs text-text/65">Text color<input type="color" value={selectedOutput.alertSettings.textColor} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, alertSettings: { ...output.alertSettings, textColor: event.target.value } }))} className="h-8 w-12 rounded border border-white/10 bg-transparent p-1" /></label>
                  </div>
                </div>
              )}

              {selectedOutputPreset && activeOutputTab !== 'general' && (
              <>
              {/* Output composition */}
              <div className={`${activeOutputTab === 'widgets' ? 'flex' : 'hidden'} flex-col md:flex-row gap-2 md:gap-6 border-b border-white/5 pb-4`}>
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Output Composition</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Choose whether this entire channel renders slide canvases or a widget composition.</div>
                </div>
                <div className="flex-1 max-w-md space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'follow-slide', label: 'Slide Canvas' },
                      { id: 'custom-layout', label: 'Widget Composition' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => updateOutputPreset(selectedOutputPreset.id, (preset) => ({
                          ...preset,
                          renderMode: option.id as OutputPreset['renderMode'],
                          outputPresetId: null,
                        }))}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                          selectedOutputPreset.renderMode === option.id
                            ? 'border-primary/45 bg-primary/15 text-text'
                            : 'border-white/10 bg-white/5 text-text/60 hover:bg-white/10'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={selectedOutputPreset.layoutType}
                    onChange={(e) => {
                      const layoutType = e.target.value as OutputLayoutType;
                      updateOutputPreset(selectedOutputPreset.id, (preset) => ({
                        ...preset,
                        layoutType,
                        widgets: DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT[layoutType],
                      }));
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                  >
                    {OUTPUT_LAYOUT_OPTIONS.map((layout) => (
                      <option key={layout.id} value={layout.id}>
                        {layout.label}
                      </option>
                    ))}
                  </select>
                  <label className="block space-y-1.5">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-text/35">Layout purpose</span>
                    <select value={selectedOutputPreset.purpose} onChange={(event) => updateOutputPreset(selectedOutputPreset.id, (layout) => ({ ...layout, purpose: event.target.value as OutputPreset['purpose'] }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs capitalize text-text focus:border-primary focus:outline-none">
                      <option value="audience">Audience</option><option value="stage">Stage</option><option value="confidence">Confidence</option><option value="broadcast">Broadcast</option><option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="block space-y-1.5">
                    <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-text/35">Layout name</span>
                    <input value={selectedOutputPreset.name} onChange={(event) => updateOutputPreset(selectedOutputPreset.id, (layout) => ({ ...layout, name: event.target.value || 'Untitled Screen Layout' }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none" />
                  </label>
                  <div className="text-[10px] text-text/38">
                    Slide Canvas preserves each content type's renderer. Widget Composition controls the full output and uses the widgets below.
                  </div>
                </div>
              </div>



              {/* Widgets */}
              <div className={`${activeOutputTab === 'widgets' ? 'flex' : 'hidden'} flex-col md:flex-row gap-2 md:gap-6 border-b border-white/5 pb-4`}>
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Widgets</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Select data blocks for custom layout outputs.</div>
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  {selectedOutput.renderMode !== 'custom-layout' && (
                    <div className="rounded-lg border border-amber-400/15 bg-amber-400/8 px-3 py-2.5 text-[11px] leading-relaxed text-amber-200/75">
                      Widgets are inactive while this channel uses Slide Canvas. Select Widget Composition above to enable the complete output layout.
                    </div>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {OUTPUT_WIDGET_OPTIONS.map((widget) => (
                      <label key={widget.id} className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs text-text/70">
                        <input
                          type="checkbox"
                          checked={selectedOutput.widgets.includes(widget.id)}
                          onChange={(e) => toggleOutputWidget(widget.id, e.target.checked)}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        {widget.label}
                      </label>
                    ))}
                  </div>

                  <div className="divide-y divide-white/6 rounded-xl border border-white/8 bg-black/10">
                    {OUTPUT_WIDGET_OPTIONS.filter((widget) => selectedOutput.widgets.includes(widget.id)).map((widget) => {
                      const layout = selectedOutput.widgetLayouts[widget.id];
                      const style = selectedOutput.widgetStyles[widget.id];
                      return (
                        <div key={widget.id} className="space-y-3 p-3.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-xs font-semibold text-text/85">{widget.label}</div>
                            <label className="flex items-center gap-2 text-[10px] text-text/45">
                              <input
                                type="checkbox"
                                checked={style.borderVisible}
                                onChange={(event) => updateWidgetStyle(widget.id, 'borderVisible', event.target.checked)}
                                className="h-3.5 w-3.5 accent-[var(--color-primary)]"
                              />
                              Show frame
                            </label>
                          </div>
                          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            {([
                              ['x', 'Left'],
                              ['y', 'Top'],
                              ['width', 'Width'],
                              ['height', 'Height'],
                            ] as const).map(([key, label]) => (
                              <label key={key} className="space-y-1">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-text/35">{label} %</span>
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  value={layout[key]}
                                  onChange={(event) => updateWidgetLayout(widget.id, key, Number(event.target.value))}
                                  className="w-full rounded-md border border-white/8 bg-white/5 px-2 py-1.5 font-mono text-[11px] text-text focus:border-primary focus:outline-none"
                                />
                              </label>
                            ))}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px_100px]">
                            <label className="space-y-1">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-text/35">Alignment</span>
                              <select
                                value={style.textAlign}
                                onChange={(event) => updateWidgetStyle(widget.id, 'textAlign', event.target.value as typeof style.textAlign)}
                                className="w-full rounded-md border border-white/8 bg-white/5 px-2 py-1.5 text-[11px] text-text focus:border-primary focus:outline-none"
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-text/35">Text scale</span>
                              <input
                                type="number"
                                min={0.4}
                                max={3}
                                step={0.05}
                                value={style.scale}
                                onChange={(event) => updateWidgetStyle(widget.id, 'scale', Number(event.target.value))}
                                className="w-full rounded-md border border-white/8 bg-white/5 px-2 py-1.5 font-mono text-[11px] text-text focus:border-primary focus:outline-none"
                              />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-text/35">Text color</span>
                              <input
                                type="color"
                                value={style.color}
                                onChange={(event) => updateWidgetStyle(widget.id, 'color', event.target.value)}
                                className="h-[30px] w-full rounded-md border border-white/8 bg-white/5 p-1"
                              />
                            </label>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                            <label className="space-y-1">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-text/35">Label</span>
                              <input value={style.label} onChange={(event) => updateWidgetStyle(widget.id, 'label', event.target.value)} className="w-full rounded-md border border-white/8 bg-white/5 px-2 py-1.5 text-[11px] text-text focus:border-primary focus:outline-none" />
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-text/35">Font</span>
                              <select value={style.fontFamily} onChange={(event) => updateWidgetStyle(widget.id, 'fontFamily', event.target.value)} className="w-full rounded-md border border-white/8 bg-white/5 px-2 py-1.5 text-[11px] text-text focus:border-primary focus:outline-none">
                                {FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                              </select>
                            </label>
                            <label className="space-y-1">
                              <span className="block text-[9px] font-bold uppercase tracking-wider text-text/35">Background</span>
                              <input type="color" value={style.backgroundColor} onChange={(event) => updateWidgetStyle(widget.id, 'backgroundColor', event.target.value)} className="h-[30px] w-full rounded-md border border-white/8 bg-white/5 p-1" />
                            </label>
                            <label className="space-y-1">
                              <span className="flex justify-between text-[9px] font-bold uppercase tracking-wider text-text/35"><span>Opacity</span><span>{Math.round(style.backgroundOpacity * 100)}%</span></span>
                              <input type="range" min="0" max="1" step="0.05" value={style.backgroundOpacity} onChange={(event) => updateWidgetStyle(widget.id, 'backgroundOpacity', Number(event.target.value))} className="w-full accent-[var(--color-primary)]" />
                            </label>
                          </div>
                          <label className="flex items-center gap-2 text-[10px] text-text/50">
                            <input type="checkbox" checked={style.shadow} onChange={(event) => updateWidgetStyle(widget.id, 'shadow', event.target.checked)} className="h-3.5 w-3.5 accent-[var(--color-primary)]" />
                            Text shadow
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Transitions */}
              <div className={`${activeOutputTab === 'transitions' ? 'flex' : 'hidden'} flex-col md:flex-row gap-2 md:gap-6 border-b border-white/5 pb-4`}>
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Transitions</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Independent effects for slide changes and output states.</div>
                </div>
                <div className="min-w-0 flex-1 space-y-4">
                  <div className="grid grid-cols-3 rounded-lg border border-white/10 bg-black/10 p-1">
                    {([
                      { id: 'slide', label: 'Slide' },
                      { id: 'black', label: 'Black' },
                      { id: 'clear', label: 'Clear' },
                    ] as const).map((target) => (
                      <button key={target.id} type="button" onClick={() => { setTransitionTarget(target.id); setTransitionPreviewState('slide'); }} className={`h-9 rounded-md text-xs font-semibold transition active:scale-[0.98] ${transitionTarget === target.id ? 'bg-primary text-white' : 'text-text/55 hover:bg-white/5 hover:text-text'}`}>{target.label}</button>
                    ))}
                  </div>

                  {activeTransitionSettings && (
                    <>
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/40">Effect</span>
                          <button type="button" onClick={previewTransition} className="rounded-md border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold text-primary hover:bg-primary/15 active:scale-[0.98]">Preview transition</button>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {OUTPUT_TRANSITION_OPTIONS.map((effect) => (
                            <button
                              key={effect.id}
                              type="button"
                              onClick={() => updateActiveTransitionSettings((current) => ({ ...current, type: effect.id }))}
                              className={`rounded-lg border px-3 py-2.5 text-left transition active:scale-[0.98] ${activeTransitionSettings.type === effect.id ? 'border-primary/45 bg-primary/12 text-text' : 'border-white/8 bg-white/[0.025] text-text/55 hover:border-white/15 hover:bg-white/[0.045]'}`}
                            >
                              <span className="block text-xs font-semibold">{effect.label}</span>
                              <span className="mt-0.5 block text-[9px] text-text/35">{effect.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-text/40">Direction</span>
                          <select value={activeTransitionSettings.direction} disabled={['blend', 'iris', 'zoom', 'none'].includes(activeTransitionSettings.type)} onChange={(event) => updateActiveTransitionSettings((current) => ({ ...current, direction: event.target.value as OutputChannel['transitionSettings']['direction'] }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none disabled:opacity-35"><option value="left">From right</option><option value="right">From left</option><option value="up">From bottom</option><option value="down">From top</option></select>
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-text/40">Easing</span>
                          <select value={activeTransitionSettings.easing} onChange={(event) => updateActiveTransitionSettings((current) => ({ ...current, easing: event.target.value as OutputChannel['transitionSettings']['easing'] }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"><option value="easeOut">Ease out</option><option value="easeInOut">Ease in/out</option><option value="linear">Linear</option></select>
                        </label>
                      </div>

                      <div>
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text/40">Duration</span>
                          <div className="flex items-center gap-1"><input type="number" min="0" max="3000" step="25" value={activeTransitionSettings.durationMs} onChange={(event) => updateActiveTransitionSettings((current) => ({ ...current, durationMs: Number(event.target.value) }))} className="w-20 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-right font-mono text-[11px] text-text focus:border-primary focus:outline-none" /><span className="text-[10px] text-text/35">ms</span></div>
                        </div>
                        <input type="range" min="0" max="3000" step="25" value={activeTransitionSettings.durationMs} onChange={(event) => updateActiveTransitionSettings((current) => ({ ...current, durationMs: Number(event.target.value) }))} className="w-full accent-[var(--color-primary)]" />
                      </div>
                    </>
                  )}
                </div>
              </div>
              </>
              )}

              {/* Enable Output */}
              <div className={`${activeOutputTab === 'general' ? 'flex' : 'hidden'} flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4`}>
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">{t('outputWorkspace.enableOutput')}</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Temporarily enable or disable routing to this screen.</div>
                </div>
                <div className="flex-1">
                  <input
                    type="checkbox"
                    checked={selectedOutput.enabled}
                    onChange={(e) => updateOutput(selectedOutput.id, (output) => ({ ...output, enabled: e.target.checked }))}
                    className="h-4 w-4 accent-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Target Type */}
              <div className={`${activeOutputTab === 'general' ? 'flex' : 'hidden'} flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4`}>
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">{t('outputWorkspace.targetType')}</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Hardware technology used for routing.</div>
                </div>
                <div className="flex-1 max-w-md">
                  <select
                    value={selectedOutput.targetType}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'electron-display') {
                        updateOutput(selectedOutput.id, (output) => ({ ...output, targetType: 'electron-display', browserClientId: null }));
                      } else if (val === 'browser-client') {
                        let browserClientId = selectedOutput.browserClientId;
                        let targetClient = browserTargets.find((c) => c.id === browserClientId);
                        if (!targetClient) {
                          targetClient = addBrowserTarget(selectedOutput.name);
                          browserClientId = targetClient.id;
                        }
                        updateOutput(selectedOutput.id, (output) => ({ ...output, targetType: 'browser-client', targetDisplayId: null, browserClientId }));
                      } else if (val === 'ndi') {
                        updateOutput(selectedOutput.id, (output) => ({
                          ...output,
                          targetType: 'ndi',
                          targetDisplayId: null,
                          browserClientId: null,
                          ndiConfig: {
                            ...output.ndiConfig,
                            contentMode: 'full-output',
                            alphaEnabled: selectedOutputPreset?.canvasBackground === 'transparent' ? true : output.ndiConfig.alphaEnabled,
                          },
                        }));
                      }
                    }}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                  >
                    <option value="electron-display">{t('outputWorkspace.localScreen')}</option>
                    <option value="browser-client">{t('outputWorkspace.browserClient')}</option>
                    <option value="ndi">{t('outputWorkspace.ndiOutput')}</option>
                  </select>
                  <div className="mt-2 text-[10px] text-text/40">
                    {selectedOutput.targetType === 'electron-display'
                      ? t('outputWorkspace.localScreenDescription')
                      : selectedOutput.targetType === 'browser-client'
                        ? t('outputWorkspace.browserClientDescription')
                        : t('outputWorkspace.ndiOutputDescription')}
                  </div>
                </div>
              </div>

              {/* Local Screen specific configuration */}
              {activeOutputTab === 'general' && selectedOutput.targetType === 'electron-display' && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                    <div className="md:w-1/3">
                      <label className="text-xs font-semibold text-text/80">{t('outputWorkspace.targetScreen')}</label>
                      <div className="text-[11px] text-text/40 mt-0.5">Select monitor output display.</div>
                    </div>
                    <div className="flex-1 max-w-md">
                      <select
                        value={selectedOutput.targetDisplayId || ''}
                        onChange={(e) => updateOutput(selectedOutput.id, (output) => ({ ...output, targetDisplayId: e.target.value || null }))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                      >
                        <option value="">{t('outputWorkspace.primaryDisplayFallback')}</option>
                        {displays.map((display) => (
                          <option key={display.id} value={display.id}>
                            {display.label} {display.isPrimary ? t('outputWorkspace.primarySuffix') : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                    <div className="md:w-1/3">
                      <label className="text-xs font-semibold text-text/80">Window Options</label>
                      <div className="text-[11px] text-text/40 mt-0.5">Automatic window configurations.</div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="flex items-center gap-2 text-xs text-text/70">
                        <input
                          type="checkbox"
                          checked={selectedOutput.autoFullscreen}
                          onChange={(e) => updateOutput(selectedOutput.id, (output) => ({ ...output, autoFullscreen: e.target.checked }))}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        <span>{t('outputWorkspace.autoFullscreen')}</span>
                      </label>
                      <label className="flex items-center gap-2 text-xs text-text/70">
                        <input
                          type="checkbox"
                          checked={selectedOutput.autoOpenOnGoLive}
                          onChange={(e) => updateOutput(selectedOutput.id, (output) => ({ ...output, autoOpenOnGoLive: e.target.checked }))}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        <span>{t('outputWorkspace.autoOpenOnGoLive')}</span>
                      </label>
                    </div>
                  </div>
                </>
              )}

              {/* Browser Remote client embedded configuration */}
              {activeOutputTab === 'general' && selectedOutput.targetType === 'browser-client' && (() => {
                const targetClient = browserTargets.find((client) => client.id === selectedOutput.browserClientId) || null;
                if (!targetClient) return null;
                const urls = getBrowserClientUrls(targetClient, browserRuntime);
                const clientConnections = browserRuntime?.clients?.find((item) => item.pairingCode === targetClient.pairingCode)?.activeConnections ?? 0;

                return (
                  <>
                    {/* Pairing Code */}
                    <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                      <div className="md:w-1/3">
                        <label className="text-xs font-semibold text-text/80">Pairing Code</label>
                        <div className="text-[11px] text-text/40 mt-0.5">Code used to pair remote web screen.</div>
                      </div>
                      <div className="flex-1 max-w-md flex items-center gap-2">
                        <span className="font-mono text-sm bg-black/40 border border-white/10 px-3 py-1.5 rounded-lg text-info tracking-wider font-semibold">
                          {targetClient.pairingCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyToClipboard(targetClient.pairingCode, `${targetClient.id}:code`)}
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-white/10 bg-white/5 text-text/75 hover:bg-white/10 transition-colors"
                          title={t('outputWorkspace.copyPairingCode')}
                        >
                          {copiedKey === `${targetClient.id}:code` ? <CheckCircle2 size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBrowserTarget(targetClient.id, (current) => ({ ...current, pairingCode: createBrowserOutputClient().pairingCode }))}
                          className="inline-flex items-center justify-center p-2 rounded-lg border border-white/10 bg-white/5 text-text/75 hover:bg-white/10 transition-colors"
                          title={t('outputWorkspace.regeneratePairingCode')}
                        >
                          <RefreshCcw size={14} />
                        </button>
                        <span className={`ml-auto text-[10px] font-bold px-2 py-1 rounded border ${clientConnections > 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-white/5 border-white/10 text-text/40'}`}>
                          {clientConnections > 0 ? `${clientConnections} Connected` : 'Server Ready'}
                        </span>
                      </div>
                    </div>

                    {/* Browser Link URLs */}
                    <div className="flex flex-col md:flex-row gap-2 md:gap-6 border-b border-white/5 pb-4">
                      <div className="md:w-1/3">
                        <label className="text-xs font-semibold text-text/80">{t('outputWorkspace.browserLink')}</label>
                        <div className="text-[11px] text-text/40 mt-0.5">Open these URLs on remote smart TVs, tablets, or phones.</div>
                      </div>
                      <div className="flex-1 max-w-md space-y-2">
                        {urls.map((url, idx) => (
                          <div key={url} className="flex items-center gap-3 bg-black/20 border border-white/5 rounded-lg p-2.5">
                            <div className="flex-1 min-w-0">
                              <span className="text-[9px] uppercase tracking-wider text-text/30 font-bold block mb-0.5">
                                {idx === 0 ? 'Primary Link' : 'Alternate Link'}
                              </span>
                              <div className="text-[11px] font-mono text-text/70 truncate break-all">{url}</div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void copyToClipboard(url, `${targetClient.id}:link:${idx}`)}
                              className="inline-flex shrink-0 items-center justify-center p-1.5 rounded bg-white/5 hover:bg-white/10 text-text/60 transition-colors"
                            >
                              {copiedKey === `${targetClient.id}:link:${idx}` ? <CheckCircle2 size={13} className="text-emerald-400" /> : <Copy size={13} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Device Notes */}
                    <div className="flex flex-col md:flex-row gap-2 md:gap-6 border-b border-white/5 pb-4">
                      <div className="md:w-1/3">
                        <label className="text-xs font-semibold text-text/80">Device Notes</label>
                        <div className="text-[11px] text-text/40 mt-0.5">Add description or location info (e.g. "Main TV").</div>
                      </div>
                      <div className="flex-1 max-w-md">
                        <textarea
                          value={targetClient.notes || ''}
                          onChange={(e) => updateBrowserTarget(targetClient.id, (current) => ({ ...current, notes: e.target.value || null }))}
                          placeholder={t('outputWorkspace.notesPlaceholder')}
                          className="w-full min-h-[70px] resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text placeholder:text-text/30 focus:border-primary focus:outline-none"
                        />
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* NDI specific configuration */}
              {activeOutputTab === 'general' && selectedOutput.targetType === 'ndi' && (
                <>
                  <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-black/15 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-text/40">NDI Runtime</div>
                      <div className="mt-1 text-xs text-text/70">
                        {selectedNdiRuntime?.error || (ndiRuntime?.helperAvailable ? 'Renderer and NDI sender are available.' : 'NDI helper is unavailable on this system.')}
                      </div>
                    </div>
                    <div className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${
                      selectedNdiRuntime?.state === 'live'
                        ? 'bg-emerald-400/15 text-emerald-300'
                        : selectedNdiRuntime?.state === 'error' || selectedNdiRuntime?.state === 'unavailable'
                          ? 'bg-rose-400/15 text-rose-300'
                          : 'bg-amber-400/15 text-amber-300'
                    }`}>
                      {selectedNdiRuntime?.state || (ndiRuntime?.helperAvailable ? 'save to start' : 'unavailable')}
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 border-b border-white/5 pb-4 md:flex-row md:gap-6">
                    <div className="md:w-1/3">
                      <label className="text-xs font-semibold text-text/80">NDI Canvas</label>
                      <div className="mt-0.5 text-[11px] leading-relaxed text-text/40">The selected Screen Layout supplies the complete NDI composition.</div>
                    </div>
                    <div className="max-w-xl flex-1 space-y-3">
                      <label className="inline-flex items-center gap-2 text-xs text-text/70">
                        <input
                          type="checkbox"
                          checked={selectedOutput.ndiConfig.alphaEnabled}
                          onChange={(event) => updateOutput(selectedOutput.id, (output) => ({
                            ...output,
                            ndiConfig: { ...output.ndiConfig, alphaEnabled: event.target.checked },
                          }))}
                          className="h-4 w-4 accent-[var(--color-primary)]"
                        />
                        Transparent background (alpha)
                      </label>
                    </div>
                  </div>

                  {selectedOutput.ndiConfig.contentMode === 'broadcast-lyrics' && (
                    <div className="space-y-5 border-b border-white/5 pb-5">
                      <div>
                        <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text/40">Broadcast presets</div>
                        <div className="grid gap-2 md:grid-cols-3">
                          {BROADCAST_LYRICS_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => updateOutput(selectedOutput.id, (output) => ({
                                ...output,
                                ndiConfig: { ...output.ndiConfig, alphaEnabled: true, lyricsOverlay: { ...preset.settings } },
                              }))}
                              className="rounded-lg border border-white/10 bg-white/[0.025] px-3 py-3 text-left transition hover:border-primary/35 hover:bg-primary/[0.06] active:scale-[0.98]"
                            >
                              <span className="block text-xs font-semibold text-text/80">{preset.name}</span>
                              <span className="mt-1 block text-[10px] leading-relaxed text-text/38">{preset.description}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {([
                          ['x', 'Horizontal position', 0, 95, '%'],
                          ['y', 'Vertical position', 0, 95, '%'],
                          ['width', 'Box width', 5, 100, '%'],
                          ['height', 'Box height', 5, 100, '%'],
                          ['padding', 'Inner padding', 0, 12, '%'],
                          ['outlineSize', 'Outline size', 0, 12, 'px'],
                          ['minFontSize', 'Minimum font', 8, 120, 'px'],
                          ['maxFontSize', 'Maximum font', 16, 180, 'px'],
                        ] as const).map(([key, label, min, max, unit]) => (
                          <label key={key} className="space-y-1.5">
                            <span className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-text/40">
                              {label}<span className="font-mono text-text/65">{selectedOutput.ndiConfig.lyricsOverlay[key]}{unit}</span>
                            </span>
                            <input
                              type="range"
                              min={min}
                              max={max}
                              step="1"
                              value={selectedOutput.ndiConfig.lyricsOverlay[key]}
                              onChange={(event) => updateOutput(selectedOutput.id, (output) => ({
                                ...output,
                                ndiConfig: {
                                  ...output.ndiConfig,
                                  lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, [key]: Number(event.target.value) },
                                },
                              }))}
                              className="w-full accent-[var(--color-primary)]"
                            />
                          </label>
                        ))}
                      </div>

                      <div className="grid gap-3 md:grid-cols-5">
                        <label className="space-y-1.5 md:col-span-2">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-text/40">Font</span>
                          <select
                            value={selectedOutput.ndiConfig.lyricsOverlay.fontFamily}
                            onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, fontFamily: event.target.value } } }))}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                          >
                            {FONT_OPTIONS.filter((font) => font.value !== 'serif').map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                          </select>
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-text/40">Alignment</span>
                          <select value={selectedOutput.ndiConfig.lyricsOverlay.textAlign} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, textAlign: event.target.value as 'left' | 'center' | 'right' } } }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"><option value="left">Left</option><option value="center">Center</option><option value="right">Right</option></select>
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-text/40">Vertical</span>
                          <select value={selectedOutput.ndiConfig.lyricsOverlay.verticalAlign} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, verticalAlign: event.target.value as 'top' | 'middle' | 'bottom' } } }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"><option value="top">Top</option><option value="middle">Middle</option><option value="bottom">Bottom</option></select>
                        </label>
                        <label className="space-y-1.5">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-text/40">Max lines</span>
                          <input type="number" min="1" max="12" value={selectedOutput.ndiConfig.lyricsOverlay.maxLines} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, maxLines: Number(event.target.value) } } }))} className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none" />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center gap-5">
                        <label className="inline-flex items-center gap-2 text-xs text-text/70"><input type="checkbox" checked={selectedOutput.ndiConfig.lyricsOverlay.shadow} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, shadow: event.target.checked } } }))} className="h-4 w-4 accent-[var(--color-primary)]" />Text shadow</label>
                        <label className="inline-flex items-center gap-2 text-xs text-text/70"><input type="checkbox" checked={selectedOutput.ndiConfig.lyricsOverlay.showSectionLabel} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, showSectionLabel: event.target.checked } } }))} className="h-4 w-4 accent-[var(--color-primary)]" />Section label</label>
                        <label className="inline-flex items-center gap-2 text-xs text-text/70">Text <input type="color" value={selectedOutput.ndiConfig.lyricsOverlay.color} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, color: event.target.value } } }))} className="h-7 w-9 rounded border border-white/10 bg-transparent" /></label>
                        <label className="inline-flex items-center gap-2 text-xs text-text/70">Outline <input type="color" value={selectedOutput.ndiConfig.lyricsOverlay.outlineColor} onChange={(event) => updateOutput(selectedOutput.id, (output) => ({ ...output, ndiConfig: { ...output.ndiConfig, lyricsOverlay: { ...output.ndiConfig.lyricsOverlay, outlineColor: event.target.value } } }))} className="h-7 w-9 rounded border border-white/10 bg-transparent" /></label>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                    <div className="md:w-1/3">
                      <label className="text-xs font-semibold text-text/80">{t('outputWorkspace.ndiSourceName')}</label>
                      <div className="text-[11px] text-text/40 mt-0.5">Name published on the network.</div>
                    </div>
                    <div className="flex-1 max-w-md">
                      <input
                        value={selectedOutput.ndiConfig.sourceName}
                        onChange={(e) => updateOutput(selectedOutput.id, (output) => ({
                          ...output,
                          ndiConfig: { ...output.ndiConfig, sourceName: e.target.value || output.name },
                        }))}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                    <div className="md:w-1/3">
                      <label className="text-xs font-semibold text-text/80">NDI Streaming Format</label>
                      <div className="text-[11px] text-text/40 mt-0.5">Resolution and Frame Rate configuration.</div>
                    </div>
                    <div className="flex-1 max-w-md flex gap-4">
                      <div className="flex-1">
                        <span className="text-[10px] text-text/40 uppercase tracking-wider block mb-1">Resolution</span>
                        <select
                          value={selectedOutput.ndiConfig.resolution}
                          onChange={(e) => updateOutput(selectedOutput.id, (output) => ({
                            ...output,
                            ndiConfig: { ...output.ndiConfig, resolution: e.target.value === '720p' ? '720p' : '1080p' },
                          }))}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                        >
                          <option value="1080p">1080p</option>
                          <option value="720p">720p</option>
                        </select>
                      </div>
                      <div className="flex-1">
                        <span className="text-[10px] text-text/40 uppercase tracking-wider block mb-1">Frame Rate</span>
                        <select
                          value={String(selectedOutput.ndiConfig.fps)}
                          onChange={(e) => updateOutput(selectedOutput.id, (output) => ({
                            ...output,
                            ndiConfig: { ...output.ndiConfig, fps: e.target.value === '60' ? 60 : 30 },
                          }))}
                          className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-text focus:border-primary focus:outline-none"
                        >
                          <option value="30">30 fps</option>
                          <option value="60">60 fps</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                    <div className="md:w-1/3">
                      <label className="text-xs font-semibold text-text/80">{t('outputWorkspace.ndiIncludeAudio')}</label>
                      <div className="text-[11px] text-text/40 mt-0.5">Include audio stream with video feed.</div>
                    </div>
                    <div className="flex-1">
                      <input
                        type="checkbox"
                        checked={selectedOutput.ndiConfig.includeAudio}
                        disabled
                        onChange={(e) => updateOutput(selectedOutput.id, (output) => ({
                          ...output,
                          ndiConfig: { ...output.ndiConfig, includeAudio: e.target.checked },
                        }))}
                        className="h-4 w-4 accent-cyan-400"
                      />
                      <span className="ml-2 text-[11px] text-amber-300/80">Audio transport is not available in this video-output phase.</span>
                    </div>
                  </div>
                </>
              )}



              {/* Local Screen Runtime Controls */}
              {activeOutputTab === 'general' && selectedOutput.targetType === 'electron-display' && (
                <div className="flex flex-col md:flex-row gap-2 md:gap-6 pb-4">
                  <div className="md:w-1/3">
                    <label className="text-xs font-semibold text-text/80">Window Controls</label>
                    <div className="text-[11px] text-text/40 mt-0.5">Test and manage runtime projection screen.</div>
                  </div>
                  <div className="flex-1 max-w-md flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        await window.api?.window.openOutput();
                        await refreshOutputState();
                      }}
                      className="rounded-lg bg-primary hover:bg-primary/95 px-3 py-2 text-xs font-bold text-white transition-colors"
                    >
                      {outputState.isOpen ? t('outputWorkspace.focusAll') : t('outputWorkspace.openAll')}
                    </button>
                    <button
                      onClick={async () => {
                        await window.api?.window.toggleOutputFullscreen();
                        await refreshOutputState();
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 text-xs font-semibold text-text transition-colors"
                    >
                      {outputState.isFullscreen ? t('outputWorkspace.windowed') : t('outputWorkspace.fullscreen')}
                    </button>
                    <button
                      onClick={async () => {
                        await window.api?.window.closeOutput();
                        await refreshOutputState();
                      }}
                      className="rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-300 transition-colors"
                    >
                      {t('outputWorkspace.close')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : selectedType === 'canvas' ? (
          <div className="space-y-6">
            <div className="border-b border-white/5 pb-4">
              <h3 className="text-base font-semibold text-text">Canvas & Safe Area</h3>
              <p className="text-xs text-text/40 mt-1">
                Configure projection canvas aspect ratio, resolution and safe guide alignments.
              </p>
            </div>

            <div className="space-y-5">
              {/* Canvas Resolution */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Canvas Resolution</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Width and Height size dimensions.</div>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={width}
                        onChange={(e) => setWidth(parseInt(e.target.value, 10) || 0)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center font-mono text-xs text-text focus:border-primary focus:outline-none"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-text/30 font-bold">W</span>
                    </div>
                    <span className="text-text/30 font-bold">x</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={height}
                        onChange={(e) => setHeight(parseInt(e.target.value, 10) || 0)}
                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-center font-mono text-xs text-text focus:border-primary focus:outline-none"
                      />
                      <span className="absolute right-2 top-2 text-[10px] text-text/30 font-bold">H</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="flex flex-col md:flex-row gap-2 md:gap-6 border-b border-white/5 pb-4">
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Quick Presets</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Apply standard resolution sizes.</div>
                </div>
                <div className="flex-1 max-w-md">
                  <div className="grid grid-cols-2 gap-2">
                    {OUTPUT_CANVAS_PRESETS.map((preset) => (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset.w, preset.h)}
                        className={`rounded-lg border px-3 py-2 text-xs font-medium transition-all ${
                          width === preset.w && height === preset.h
                            ? 'border-primary bg-primary/20 text-white font-semibold'
                            : 'border-white/8 bg-white/5 text-text/70 hover:bg-white/10'
                        }`}
                      >
                        {preset.label} · {preset.w}x{preset.h}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Aspect Ratio Display */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Detected Aspect Ratio</label>
                </div>
                <div className="flex-1">
                  <span className="rounded-lg bg-white/5 border border-white/10 px-3 py-1 text-xs font-semibold text-text/90">
                    {getAspectRatioLabel(width, height)}
                  </span>
                </div>
              </div>

              {/* Show Safe Area Guide */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 border-b border-white/5 pb-4">
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Show Safe Area Guide</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Draw reference borders during projection setup.</div>
                </div>
                <div className="flex-1">
                  <input
                    type="checkbox"
                    checked={isSafeAreaEnabled}
                    onChange={(e) => setIsSafeAreaEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[var(--color-primary)] font-semibold"
                  />
                </div>
              </div>

              {/* Safe Area Margin */}
              <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-6 pb-4">
                <div className="md:w-1/3">
                  <label className="text-xs font-semibold text-text/80">Safe Area Margin</label>
                  <div className="text-[11px] text-text/40 mt-0.5">Border offset padding: {safeArea}%</div>
                </div>
                <div className="flex-1 max-w-md">
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={safeArea}
                    onChange={(e) => setSafeArea(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--color-primary)]"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-text/30 text-xs">
            No item selected
          </div>
        )}
      </div>
    </div>
  );
}
