import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { LayoutTemplate, Save, X, Lock, Unlock, Eye, EyeOff, Grid } from 'lucide-react';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import { ipcTemplateService } from '../../core/services/ipcTemplateService';
import { ipcOutputSettingsService } from '../../core/services/ipcOutputSettingsService';
import { useSettingsStore } from '../../core/stores/useSettingsStore';
import { useElementSize } from '../../hooks/useElementSize';
import type { ContentThemeType, Media, SlideLayer, Template } from '../../electron/database/schema';
import { buildLayersFromSongPreset, serializeSongPresetLayers } from '../../core/songEditor/songPresets';
import { getScreenLayoutThumbnailSignature, renderContentThemeThumbnail, renderScreenLayoutThumbnail } from '../../core/presets/presetThumbnailRenderer';
import { ipcPresetPreviewService } from '../../core/services/ipcPresetPreviewService';
import type { SongEditorSlide } from '../../core/services/ipcSongService';
import { useEditorLogic } from './AdvancedEditorParts/useEditorLogic';
import { LayerListPanel } from './AdvancedEditorParts/LayerListPanel';
import { CanvasArea } from './AdvancedEditorParts/CanvasArea';
import { PropertiesPanel } from './AdvancedEditorParts/PropertiesPanel';
import {
  DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT,
  createDefaultOutputPreset,
  type ContentThemePolicy,
  type OutputPreset,
  type OutputWidgetId,
} from '../../core/models/outputSettings';

interface SongPresetEditorModalProps {
  template: Template | null;
  outputPreset?: OutputPreset | null;
  initialPresetType?: 'song' | 'output';
  onClose: () => void;
  onSaved: (savedOutputPreset?: OutputPreset) => void;
  standalone?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
}

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

const OUTPUT_WIDGET_SAMPLES: Record<OutputWidgetId, string> = {
  slideCanvas: 'Rendered content slide',
  currentLyrics: 'Amazing Grace\nHow sweet the sound',
  nextLyrics: 'Next lyric line',
  previousLyrics: 'Previous lyric line',
  sectionLabel: 'Verse 1',
  notes: 'Operator notes',
  clock: '19:30',
  timer: '00:42',
  videoCountdown: '02:18',
  showName: 'Sunday Service',
  progress: '3 / 8',
  logo: 'RAMEDIA',
  alert: 'Stage alert message',
};

const FONT_OPTIONS = [
  { value: 'Manrope, Inter, sans-serif', label: 'Manrope' },
  { value: 'Inter, sans-serif', label: 'Inter' },
  { value: 'Roboto, sans-serif', label: 'Roboto' },
  { value: 'Outfit, sans-serif', label: 'Outfit' },
  { value: 'serif', label: 'Serif' },
  { value: 'monospace', label: 'Monospace' },
];

const CONTENT_RULE_OPTIONS: Array<{ id: ContentThemePolicy; label: string }> = [
  { id: 'follow', label: 'Follow' },
  { id: 'fallback', label: 'Fallback' },
  { id: 'force', label: 'Force' },
];

const CONTENT_TYPE_LABELS: Record<ContentThemeType, string> = {
  song: 'Song',
  scripture: 'Scripture',
  presentation: 'Presentation',
  media: 'Media',
};

const CONTENT_THEME_EDITOR_CONFIG: Record<ContentThemeType, {
  sampleText: string;
  roles: Array<{ value: string; label: string; content: string; y: number; boxHeight: number; scale: number }>;
}> = {
  song: {
    sampleText: 'Amazing Grace\nHow sweet the sound',
    roles: [
      { value: 'song-title', label: 'Song Title', content: 'Amazing Grace', y: 15, boxHeight: 10, scale: 0.52 },
      { value: 'lyrics-main', label: 'Lyrics Main', content: 'Amazing Grace\nHow sweet the sound', y: 50, boxHeight: 36, scale: 1 },
      { value: 'section-label', label: 'Section Label', content: 'Verse 1', y: 84, boxHeight: 8, scale: 0.42 },
    ],
  },
  scripture: {
    sampleText: 'For God so loved the world that he gave his one and only Son.',
    roles: [
      { value: 'scripture-text', label: 'Verse Text', content: 'For God so loved the world that he gave his one and only Son.', y: 46, boxHeight: 40, scale: 0.9 },
      { value: 'scripture-reference', label: 'Reference', content: 'John 3:16', y: 80, boxHeight: 9, scale: 0.48 },
      { value: 'scripture-version', label: 'Version', content: 'NIV', y: 89, boxHeight: 6, scale: 0.34 },
    ],
  },
  presentation: {
    sampleText: 'A clear supporting message for the audience.',
    roles: [
      { value: 'presentation-title', label: 'Presentation Title', content: 'Presentation Title', y: 25, boxHeight: 15, scale: 0.78 },
      { value: 'presentation-body', label: 'Presentation Body', content: 'A clear supporting message for the audience.', y: 58, boxHeight: 40, scale: 0.7 },
    ],
  },
  media: {
    sampleText: 'Media caption',
    roles: [
      { value: 'media-caption', label: 'Media Caption', content: 'Media caption', y: 86, boxHeight: 12, scale: 0.55 },
    ],
  },
};

function createPresetSlide(template: Template | null, contentType: ContentThemeType): SongEditorSlide {
  const slideId = crypto.randomUUID();
  const config = CONTENT_THEME_EDITOR_CONFIG[contentType];
  const seedLayers = buildLayersFromSongPreset(
    slideId,
    config.sampleText,
    template,
    useSettingsStore.getState().defaultSongStyle,
    {
      songTitle: 'Amazing Grace',
      sectionLabel: 'Verse 1',
      scriptureText: config.sampleText,
      scriptureReference: 'John 3:16',
      scriptureVersion: 'NIV',
      presentationTitle: 'Presentation Title',
      presentationBody: config.sampleText,
      mediaCaption: 'Media caption',
    },
  );
  const primaryTextLayer = seedLayers.find((layer) => layer.layerType === 'text');
  const layers = template || !primaryTextLayer
    ? seedLayers
    : [
        ...seedLayers.filter((layer) => layer.layerType !== 'text'),
        ...config.roles.map((role, index) => {
          const baseStyle = typeof primaryTextLayer.style === 'string' ? JSON.parse(primaryTextLayer.style || '{}') : (primaryTextLayer.style || {});
          return {
            ...primaryTextLayer,
            id: crypto.randomUUID(),
            layerOrder: primaryTextLayer.layerOrder + index,
            content: role.content,
            style: JSON.stringify({
              ...baseStyle,
              textRole: role.value,
              y: role.y,
              boxHeight: role.boxHeight,
              scale: role.scale,
            }),
          } as SlideLayer;
        }),
      ];

  return {
    id: slideId,
    songId: '',
    orderIndex: 1,
    sectionType: 'verse',
    sectionNumber: 1,
    content: config.sampleText,
    notes: null,
    customThemeId: null,
    createdAt: new Date().toISOString(),
    layers,
  };
}

export default function SongPresetEditorModal({ template, outputPreset = null, initialPresetType, onClose, onSaved, standalone = false, onDirtyChange }: SongPresetEditorModalProps) {
  const { outputWidth, outputHeight, appTheme } = useSettingsStore();
  const isDark = appTheme !== 'light';
  const [presetType, setPresetType] = useState<'song' | 'output'>(initialPresetType || (outputPreset ? 'output' : 'song'));
  const [name, setName] = useState(template?.name || outputPreset?.name || (presetType === 'output' ? 'New Screen Layout' : 'New Content Theme'));
  const [category, setCategory] = useState(template?.category || (presetType === 'output' ? 'Screen Layout' : 'Content Theme'));
  const [contentType, setContentType] = useState<ContentThemeType>(template?.contentType || 'song');
  const [outputDraft, setOutputDraft] = useState<OutputPreset>(() => (
    outputPreset || createDefaultOutputPreset({ name: 'New Screen Layout', role: 'worship-leader', renderMode: 'custom-layout', layoutType: 'worship-leader-foldback' })
  ));
  const [selectedOutputWidget, setSelectedOutputWidget] = useState<OutputWidgetId>('currentLyrics');
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [lockedWidgets, setLockedWidgets] = useState<OutputWidgetId[]>([]);
  const [isLayerPanelCollapsed, setIsLayerPanelCollapsed] = useState(false);
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [contentThemes, setContentThemes] = useState<Template[]>([]);
  const [draftSlides, setDraftSlides] = useState<SongEditorSlide[]>([createPresetSlide(template, template?.contentType || 'song')]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirtyRef = useRef(false);
  const hasMountedEditorStateRef = useRef(false);
  const { ref: canvasRef, width: containerW, height: containerH } = useElementSize<HTMLDivElement>();
  const slideCanvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMountedEditorStateRef.current) {
      hasMountedEditorStateRef.current = true;
      return;
    }
    dirtyRef.current = true;
    onDirtyChange?.(true);
  }, [category, contentType, draftSlides, name, outputDraft, presetType]);

  const requestClose = () => {
    if (!standalone && dirtyRef.current && !confirm('Close the preset editor without saving your changes?')) return;
    dirtyRef.current = false;
    onDirtyChange?.(false);
    onClose();
  };

  useEffect(() => {
    let cancelled = false;

    const loadMediaItems = () => {
      ipcMediaService.getAll()
        .then((items) => {
          if (!cancelled) setMediaItems(items);
        })
        .catch(() => {
          if (!cancelled) setMediaItems([]);
        });
    };

    loadMediaItems();
    window.addEventListener('ramedia:refresh-media', loadMediaItems);

    return () => {
      cancelled = true;
      window.removeEventListener('ramedia:refresh-media', loadMediaItems);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    ipcTemplateService.getAll()
      .then((items) => {
        if (!cancelled) setContentThemes(items);
      })
      .catch(() => {
        if (!cancelled) setContentThemes([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const {
    slides,
    selectedLayerId,
    selectedSlide,
    selectedLayer,
    setSelectedLayerId,
    undo,
    redo,
    canUndo,
    canRedo,
    addLayer,
    deleteLayer,
    reorderLayers,
    updateLayer,
    updateSelectedLayer,
    alignSelectedLayer,
    updateSlideContent,
  } = useEditorLogic(null, draftSlides, ({ slides: nextSlides }) => setDraftSlides(nextSlides), slideCanvasRef);

  const aspectRatio = outputWidth / outputHeight;
  const containerAspect = containerW / Math.max(containerH, 1);
  const canvasStyle = containerAspect > aspectRatio
    ? { height: '100%', aspectRatio }
    : { width: '100%', aspectRatio };

  const primarySlide = slides[0];

  const handleSave = async () => {
    if (presetType === 'output') {
      if (!name.trim()) {
        setError('Layout name is required.');
        return;
      }

      setIsSaving(true);
      setError(null);

      try {
        const settings = await ipcOutputSettingsService.getSettings();
        let nextPreset: OutputPreset = {
          ...outputDraft,
          name: name.trim(),
          renderMode: 'custom-layout',
        };
        try {
          const previewDataUrl = await renderScreenLayoutThumbnail(nextPreset);
          const thumbnail = await ipcPresetPreviewService.save(`screen-${nextPreset.id}`, previewDataUrl, nextPreset.thumbnail);
          nextPreset = { ...nextPreset, thumbnail, thumbnailSignature: getScreenLayoutThumbnailSignature(nextPreset) };
        } catch (previewError) {
          console.warn('[Preset Preview] Unable to generate Screen Layout thumbnail.', previewError);
        }
        const exists = settings.outputPresets.some((preset) => preset.id === nextPreset.id);
        const outputPresets = exists
          ? settings.outputPresets.map((preset) => (preset.id === nextPreset.id ? nextPreset : preset))
          : [...settings.outputPresets, nextPreset];
        const nextSettings = await ipcOutputSettingsService.setSettings({ ...settings, outputPresets });
        useSettingsStore.getState().setSettings(nextSettings);
        dirtyRef.current = false;
        onDirtyChange?.(false);
        onSaved(nextPreset);
        onClose();
      } catch (saveError) {
        setError((saveError as Error).message || 'Failed to save Screen Layout.');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!name.trim()) {
      setError('Theme name is required.');
      return;
    }
    if (!primarySlide) {
      setError('Theme canvas is missing.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const layersData = serializeSongPresetLayers(primarySlide.layers);
      let existingVariants: Array<{ id: string; name: string; layersData: string }> = [];
      try {
        const parsed = template?.variantsData ? JSON.parse(template.variantsData) : [];
        if (Array.isArray(parsed)) existingVariants = parsed.filter((variant) => variant && variant.id !== 'default');
      } catch {
        existingVariants = [];
      }
      const variantsData = JSON.stringify([
        { id: 'default', name: CONTENT_TYPE_LABELS[contentType], layersData },
        ...existingVariants,
      ]);
      let savedTemplateId = template?.id || null;
      if (savedTemplateId) {
        await ipcTemplateService.update(savedTemplateId, name.trim(), category.trim() || 'Content Theme', layersData, contentType, variantsData);
      } else {
        savedTemplateId = await ipcTemplateService.create(name.trim(), category.trim() || 'Content Theme', layersData, contentType, variantsData);
      }
      if (savedTemplateId) {
        try {
          const previewDataUrl = await renderContentThemeThumbnail(layersData, contentType);
          const previewUrl = await ipcPresetPreviewService.save(`content-${savedTemplateId}`, previewDataUrl, template?.previewUrl);
          await ipcTemplateService.updatePreview(savedTemplateId, previewUrl);
        } catch (previewError) {
          console.warn('[Preset Preview] Unable to generate Content Theme thumbnail.', previewError);
        }
      }
      onSaved();
      dirtyRef.current = false;
      onDirtyChange?.(false);
      onClose();
    } catch (saveError) {
      setError((saveError as Error).message || 'Failed to save Content Theme.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredMediaItems = useMemo(
    () => mediaItems.filter((item) => item.mediaType === 'image' || item.mediaType === 'video'),
    [mediaItems],
  );

  const updateOutputDraft = (updater: (preset: OutputPreset) => OutputPreset) => {
    setOutputDraft((current) => updater(current));
  };

  const toggleWidget = (widgetId: OutputWidgetId, enabled: boolean) => {
    updateOutputDraft((preset) => {
      const widgets = new Set(preset.widgets);
      if (enabled) widgets.add(widgetId);
      else widgets.delete(widgetId);
      const nextWidgets = Array.from(widgets);
      return {
        ...preset,
        widgets: nextWidgets.length ? nextWidgets : DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT[preset.layoutType],
      };
    });
  };

  const updateWidgetLayout = (widgetId: OutputWidgetId, updates: Partial<OutputPreset['widgetLayouts'][OutputWidgetId]>) => {
    updateOutputDraft((preset) => ({
      ...preset,
      widgetLayouts: {
        ...preset.widgetLayouts,
        [widgetId]: {
          ...preset.widgetLayouts[widgetId],
          ...updates,
        },
      },
    }));
  };

  const updateWidgetStyle = (widgetId: OutputWidgetId, updates: Partial<OutputPreset['widgetStyles'][OutputWidgetId]>) => {
    updateOutputDraft((preset) => ({
      ...preset,
      widgetStyles: {
        ...preset.widgetStyles,
        [widgetId]: {
          ...preset.widgetStyles[widgetId],
          ...updates,
        },
      },
    }));
  };

  const startWidgetDrag = (event: ReactMouseEvent<HTMLDivElement>, widgetId: OutputWidgetId) => {
    if (lockedWidgets.includes(widgetId)) return;
    const stage = event.currentTarget.parentElement;
    const widgetLayout = outputDraft.widgetLayouts[widgetId];
    if (!stage || !widgetLayout) return;

    event.preventDefault();
    setSelectedOutputWidget(widgetId);
    const rect = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent: MouseEvent) => {
      const deltaX = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaY = ((moveEvent.clientY - startY) / rect.height) * 100;
      let nextX = widgetLayout.x + deltaX;
      let nextY = widgetLayout.y + deltaY;

      if (snapToGrid) {
        nextX = Math.round(nextX / 2) * 2;
        nextY = Math.round(nextY / 2) * 2;
      }

      updateWidgetLayout(widgetId, {
        x: Math.max(0, Math.min(100 - widgetLayout.width, nextX)),
        y: Math.max(0, Math.min(100 - widgetLayout.height, nextY)),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startWidgetResize = (event: ReactMouseEvent<HTMLDivElement>, widgetId: OutputWidgetId) => {
    if (lockedWidgets.includes(widgetId)) return;
    const stage = event.currentTarget.parentElement?.parentElement;
    const widgetLayout = outputDraft.widgetLayouts[widgetId];
    if (!stage || !widgetLayout) return;

    event.preventDefault();
    event.stopPropagation();
    setSelectedOutputWidget(widgetId);
    const rect = stage.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;

    const onMove = (moveEvent: MouseEvent) => {
      const deltaW = ((moveEvent.clientX - startX) / rect.width) * 100;
      const deltaH = ((moveEvent.clientY - startY) / rect.height) * 100;
      let nextW = widgetLayout.width + deltaW;
      let nextH = widgetLayout.height + deltaH;

      if (snapToGrid) {
        nextW = Math.round(nextW / 2) * 2;
        nextH = Math.round(nextH / 2) * 2;
      }

      updateWidgetLayout(widgetId, {
        width: Math.max(4, Math.min(100 - widgetLayout.x, nextW)),
        height: Math.max(4, Math.min(100 - widgetLayout.y, nextH)),
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const modalContent = (
    <div className={`fixed inset-0 z-[220] flex items-center justify-center ${standalone ? 'bg-slate-950 p-0' : 'bg-slate-950/68 p-4 backdrop-blur-sm'}`}>
      <div className={`theme-scope flex w-full flex-col overflow-hidden border transition-colors duration-200 ${standalone ? 'h-[100dvh] max-w-none rounded-none border-0 shadow-none' : 'h-[92dvh] max-w-[1480px] rounded-[22px] shadow-[0_28px_90px_rgba(15,23,42,0.38)]'} ${isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'}`}>
        <div className={`flex min-h-[72px] items-center justify-between border-b px-5 py-3 transition-colors duration-200 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-950'}`}>
          <div className="flex items-center gap-3">
            {!standalone && <button
              onClick={requestClose}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg border transition active:scale-[0.98] ${isDark ? 'border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-850 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-950'}`}
              aria-label="Close preset editor"
              title="Close preset editor"
            >
              <X size={15} />
            </button>}
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-200 ${isDark ? 'bg-indigo-950/50 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>
              <LayoutTemplate size={18} />
            </div>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-550' : 'text-slate-400'}`}>
                {presetType === 'output' ? 'Screen Layout' : 'Content Theme'}
              </div>
              <div className={`text-sm font-semibold ${isDark ? 'text-slate-200' : 'text-slate-950'}`}>
                {presetType === 'output' ? 'Compose runtime widgets and content rules for reusable outputs' : 'Design reusable content-bound slide layers'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-[0_12px_28px_rgba(37,99,235,0.26)] transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={15} />
              {isSaving ? 'Saving...' : presetType === 'output' ? 'Save Layout' : 'Save Theme'}
            </button>
          </div>
        </div>

        <div className={`grid gap-4 border-b px-5 py-3 transition-colors duration-200 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-100' : 'border-slate-200 bg-slate-50 text-slate-950'} ${
          presetType === 'output' ? 'md:grid-cols-[220px_minmax(0,1fr)_220px]' : 'md:grid-cols-[180px_minmax(0,1fr)_180px_200px]'
        }`}>
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>Preset Type</label>
            <select
              value={presetType}
              disabled={!!template || !!outputPreset}
              onChange={(event) => {
                const nextType = event.target.value as 'song' | 'output';
                setPresetType(nextType);
                setName(nextType === 'output' ? 'New Screen Layout' : 'New Content Theme');
                setCategory(nextType === 'output' ? 'Screen Layout' : 'Content Theme');
              }}
              className={`h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200 disabled:bg-slate-900 disabled:text-slate-500' : 'border-slate-300 bg-white text-slate-950 disabled:bg-slate-100 disabled:text-slate-500'}`}
            >
              <option value="song">Content Theme</option>
              <option value="output">Screen Layout</option>
            </select>
          </div>

          {presetType === 'output' && (
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>Purpose</label>
              <select
                value={outputDraft.purpose}
                onChange={(event) => updateOutputDraft((layout) => ({ ...layout, purpose: event.target.value as OutputPreset['purpose'] }))}
                className={`h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-300 bg-white text-slate-950'}`}
              >
                <option value="audience">Audience</option><option value="stage">Stage</option><option value="confidence">Confidence</option><option value="broadcast">Broadcast</option><option value="custom">Custom</option>
              </select>
            </div>
          )}

          {presetType === 'output' && (
            <div className="space-y-1.5">
              <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>Canvas</label>
              <select
                value={outputDraft.canvasBackground}
                onChange={(event) => updateOutputDraft((layout) => ({ ...layout, canvasBackground: event.target.value === 'transparent' ? 'transparent' : 'opaque' }))}
                className={`h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-300 bg-white text-slate-950'}`}
              >
                <option value="opaque">Opaque</option>
                <option value="transparent">Transparent overlay</option>
              </select>
            </div>
          )}

          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-450'}`}>
              {presetType === 'output' ? 'Layout Name' : 'Theme Name'}
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={`h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-300 bg-white text-slate-950'}`}
            />
          </div>

          {presetType === 'song' && (
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-455'}`}>Content Type</label>
            <select
              value={contentType}
              disabled={!!template}
              title={template ? 'Content type is fixed for an existing theme. Create a new theme to use another content type.' : undefined}
              onChange={(event) => {
                const nextType = event.target.value as ContentThemeType;
                setContentType(nextType);
                setDraftSlides([createPresetSlide(null, nextType)]);
              }}
              className={`h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 disabled:cursor-not-allowed disabled:opacity-60 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-300 bg-white text-slate-950'}`}
            >
              <option value="song">Song</option><option value="scripture">Scripture</option><option value="presentation">Presentation</option><option value="media">Media</option>
            </select>
          </div>
          )}

          {presetType === 'song' && (
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-455'}`}>Category</label>
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className={`h-10 w-full rounded-lg border px-3 text-sm font-medium outline-none transition placeholder:text-slate-550 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-300 bg-white text-slate-950'}`}
            />
          </div>
          )}
        </div>

        {error && (
          <div className="mx-5 mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-350">
            {error}
          </div>
        )}

        {presetType === 'output' ? (
          <div className={`flex min-h-0 flex-1 overflow-hidden transition-colors duration-200 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-800'}`}>
            {/* PANEL KIRI: Layers / Widgets Manager */}
            <div className={`w-[240px] shrink-0 border-r flex flex-col min-h-0 transition-colors duration-200 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-100' : 'border-slate-200 bg-white text-slate-800'}`}>
              <div className={`p-4 border-b flex items-center justify-between ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Layers</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {OUTPUT_WIDGET_OPTIONS.map((widget) => {
                  const isEnabled = outputDraft.widgets.includes(widget.id);
                  const isLocked = lockedWidgets.includes(widget.id);
                  const isSelected = selectedOutputWidget === widget.id;

                  return (
                    <div
                      key={widget.id}
                      onClick={() => {
                        if (isEnabled) {
                          setSelectedOutputWidget(widget.id);
                        }
                      }}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition ${
                        isSelected && isEnabled
                          ? 'bg-blue-600/20 border border-blue-500/30 text-white'
                          : isEnabled
                            ? isDark
                              ? 'bg-slate-900/60 hover:bg-slate-900 border border-transparent text-slate-300'
                              : 'bg-slate-100 hover:bg-slate-200 border border-transparent text-slate-700'
                            : isDark
                              ? 'bg-slate-950 opacity-40 hover:opacity-60 border border-transparent text-slate-500'
                              : 'bg-white opacity-40 hover:opacity-60 border border-slate-150 text-slate-400'
                      }`}
                    >
                      <span className="text-xs font-medium truncate select-none">{widget.label}</span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {/* Lock toggle */}
                        <button
                          type="button"
                          onClick={() => {
                            if (!isEnabled) return;
                            setLockedWidgets((prev) =>
                              prev.includes(widget.id)
                                ? prev.filter((id) => id !== widget.id)
                                : [...prev, widget.id]
                            );
                          }}
                          disabled={!isEnabled}
                          className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800 text-slate-550' : 'hover:bg-slate-100 text-slate-500'} ${
                            isLocked ? 'text-amber-400 hover:text-amber-300' : 'hover:text-slate-300'
                          } disabled:opacity-30`}
                          title={isLocked ? 'Unlock widget' : 'Lock widget'}
                        >
                          {isLocked ? <Lock size={12} /> : <Unlock size={12} />}
                        </button>
                        {/* Visibility (Eye) toggle */}
                        <button
                          type="button"
                          onClick={() => toggleWidget(widget.id, !isEnabled)}
                          className={`p-1 rounded transition ${isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'} ${
                            isEnabled ? 'text-blue-400 hover:text-blue-300' : 'text-slate-500 hover:text-slate-600'
                          }`}
                          title={isEnabled ? 'Hide widget' : 'Show widget'}
                        >
                          {isEnabled ? <Eye size={12} /> : <EyeOff size={12} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AREA TENGAH: Canvas */}
            <div className={`flex-1 flex flex-col min-h-0 relative transition-colors duration-200 ${isDark ? 'bg-[#0f1013]' : 'bg-slate-100'}`}>
              {/* Toolbar atas canvas */}
              <div className={`h-12 border-b px-4 flex items-center justify-between transition-colors duration-200 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-300' : 'border-slate-200 bg-white text-slate-700'}`}>
                <div className="flex items-center gap-4">
                  <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer select-none ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                    <input
                      type="checkbox"
                      checked={snapToGrid}
                      onChange={(e) => setSnapToGrid(e.target.checked)}
                      className={`h-3.5 w-3.5 rounded focus:ring-blue-600 ${isDark ? 'border-slate-700 bg-slate-805 text-blue-600 focus:ring-offset-slate-900' : 'border-slate-300 bg-white text-blue-600'}`}
                    />
                    <Grid size={13} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                    Snap to Grid (2%)
                  </label>
                </div>
                <div className={`text-[10px] font-mono ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>1920 x 1080 (16:9)</div>
              </div>

              {/* Area scroll/centering canvas */}
              <div className="flex-1 overflow-auto flex items-center justify-center p-8 relative">
                {/* Dotted Grid Background */}
                <div 
                  className={`absolute inset-0 pointer-events-none ${isDark ? 'opacity-30' : 'opacity-10'}`}
                  style={{
                    backgroundImage: isDark ? 'radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 1px)' : 'radial-gradient(rgba(0, 0, 0, 0.15) 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />

                <div 
                  ref={canvasRef}
                  className={`w-full max-w-4xl aspect-video rounded-xl border shadow-2xl relative overflow-hidden transition-colors duration-200 ${isDark ? 'border-slate-700' : 'border-slate-300'}`}
                  style={{ background: outputDraft.canvasBackground === 'transparent' ? 'repeating-conic-gradient(#272a31 0 25%, #17191e 0 50%) 50% / 22px 22px' : '#05070a' }}
                >
                  <div className="relative h-full w-full">
                    {outputDraft.widgets.map((widgetId) => {
                      const layout = outputDraft.widgetLayouts[widgetId];
                      const style = outputDraft.widgetStyles[widgetId];
                      if (!layout) return null;
                      const widget = OUTPUT_WIDGET_OPTIONS.find((item) => item.id === widgetId);
                      const isSelected = selectedOutputWidget === widgetId;
                      const isLocked = lockedWidgets.includes(widgetId);
                      return (
                        <div
                          key={widgetId}
                          onMouseDown={(event) => startWidgetDrag(event, widgetId)}
                          className={`absolute select-none rounded border p-3 text-white transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_0_2px_rgba(59,130,246,0.30)] z-10'
                              : 'border-white/10 bg-white/[0.04] hover:border-white/20'
                          } ${isLocked ? 'cursor-default' : 'cursor-move'}`}
                          style={{
                            left: `${layout.x}%`,
                            top: `${layout.y}%`,
                            width: `${layout.width}%`,
                            height: `${layout.height}%`,
                            color: style.color,
                            fontFamily: style.fontFamily,
                            textAlign: style.textAlign,
                            backgroundColor: `color-mix(in srgb, ${style.backgroundColor} ${Math.round(style.backgroundOpacity * 100)}%, transparent)`,
                            borderColor: style.borderVisible ? undefined : 'transparent',
                          }}
                        >
                          {style.showLabel !== false && <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                            <span>{style.label || widget?.label || widgetId}</span>
                            {isLocked && <Lock size={10} className="text-amber-400" />}
                          </div>}
                          
                          <div
                            className="mt-2 overflow-hidden text-sm font-semibold"
                            style={{
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: style.maxLines || 3,
                              fontSize: style.sizingMode === 'fixed' ? `${(style.fontSizePx || 64) / 19.2}cqw` : `${14 * style.scale}px`,
                              textShadow: style.shadow ? '0 3px 14px rgba(0,0,0,0.85)' : 'none',
                            }}
                          >
                            {OUTPUT_WIDGET_SAMPLES[widgetId]}
                          </div>

                          {/* Resize Handle (bottom-right corner) */}
                          {isSelected && !isLocked && (
                            <div
                              onMouseDown={(e) => startWidgetResize(e, widgetId)}
                              className="absolute bottom-0 right-0 w-3.5 h-3.5 cursor-se-resize bg-blue-500 rounded-tl-sm flex items-center justify-center hover:bg-blue-400 active:bg-blue-600 transition"
                              title="Resize widget"
                            >
                              <div className="w-1.5 h-1.5 border-r border-b border-white opacity-80" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* PANEL KANAN: Properties & Styling */}
            <div className={`w-[320px] shrink-0 border-l flex flex-col min-h-0 transition-colors duration-200 ${isDark ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-white'}`}>
              <div className={`p-4 border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Properties</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-5">

                <div className={`space-y-3 border-b pb-5 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Content Theme Rules</div>
                    <p className={`mt-1 text-[10px] leading-relaxed ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Choose whether this layout follows content, supplies a fallback, or forces one theme.</p>
                  </div>
                  {(Object.keys(CONTENT_TYPE_LABELS) as ContentThemeType[]).map((ruleType) => {
                    const rule = outputDraft.contentRules[ruleType];
                    const matchingThemes = contentThemes.filter((theme) => (theme.contentType || 'song') === ruleType);
                    return (
                      <div key={ruleType} className={`space-y-2 rounded-lg border p-2.5 ${isDark ? 'border-slate-800 bg-slate-900/55' : 'border-slate-200 bg-slate-50'}`}>
                        <div className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{CONTENT_TYPE_LABELS[ruleType]}</div>
                        <div className={`grid grid-cols-3 gap-1 rounded-md p-1 ${isDark ? 'bg-slate-950' : 'bg-white'}`}>
                          {CONTENT_RULE_OPTIONS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => updateOutputDraft((layout) => ({
                                ...layout,
                                contentRules: {
                                  ...layout.contentRules,
                                  [ruleType]: { ...rule, policy: option.id },
                                },
                              }))}
                              className={`rounded px-1 py-1.5 text-[9px] font-bold uppercase transition ${rule.policy === option.id ? 'bg-blue-600 text-white' : isDark ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                        {rule.policy !== 'follow' && (
                          <select
                            value={rule.themeId || ''}
                            onChange={(event) => {
                              const theme = matchingThemes.find((item) => item.id === event.target.value) || null;
                              updateOutputDraft((layout) => ({
                                ...layout,
                                contentRules: {
                                  ...layout.contentRules,
                                  [ruleType]: {
                                    ...rule,
                                    themeId: theme?.id || null,
                                    themeName: theme?.name || null,
                                    themeLayersData: theme?.layersData || null,
                                  },
                                },
                              }));
                            }}
                            className={`h-8 w-full rounded-md border px-2 text-[10px] outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-950 text-slate-200' : 'border-slate-200 bg-white text-slate-700'}`}
                          >
                            <option value="">Select theme</option>
                            {matchingThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>


                {selectedOutputWidget && outputDraft.widgetLayouts[selectedOutputWidget] && (
                  <div className={`pt-4 space-y-4`}>
                    <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Widget Style</div>
                    
                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Widget Label</label>
                      <input
                        value={outputDraft.widgetStyles[selectedOutputWidget]?.label || ''}
                        onChange={(event) => updateWidgetStyle(selectedOutputWidget, { label: event.target.value })}
                        className={`h-9 w-full rounded-lg border px-3 text-xs font-medium outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Font Family</label>
                      <select
                        value={outputDraft.widgetStyles[selectedOutputWidget]?.fontFamily || FONT_OPTIONS[0].value}
                        onChange={(event) => updateWidgetStyle(selectedOutputWidget, { fontFamily: event.target.value })}
                        className={`h-9 w-full rounded-lg border px-2.5 text-xs outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                      >
                        {FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className={`mb-1.5 block text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Sizing Mode</label>
                      <div className={`mb-3 grid grid-cols-2 gap-1 rounded-lg border p-1 ${isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-slate-100'}`}>
                        {(['responsive', 'fixed'] as const).map((mode) => (
                          <button key={mode} type="button" onClick={() => updateWidgetStyle(selectedOutputWidget, { sizingMode: mode })} className={`rounded px-2 py-1.5 text-[10px] font-bold uppercase transition ${(outputDraft.widgetStyles[selectedOutputWidget]?.sizingMode || 'responsive') === mode ? 'bg-blue-600 text-white' : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'}`}>{mode}</button>
                        ))}
                      </div>
                      <div className={`flex justify-between text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span>Font Size</span>
                        <span>{outputDraft.widgetStyles[selectedOutputWidget]?.sizingMode === 'fixed' ? `${outputDraft.widgetStyles[selectedOutputWidget]?.fontSizePx || 64}px` : `${Math.round((outputDraft.widgetStyles[selectedOutputWidget]?.scale || 1) * 100)}%`}</span>
                      </div>
                      {outputDraft.widgetStyles[selectedOutputWidget]?.sizingMode === 'fixed' ? <input
                        type="range"
                        min="16"
                        max="160"
                        step="1"
                        value={outputDraft.widgetStyles[selectedOutputWidget]?.fontSizePx || 64}
                        onChange={(event) => updateWidgetStyle(selectedOutputWidget, { fontSizePx: Number(event.target.value) })}
                        className={`w-full accent-blue-500 h-1 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-250'}`}
                      /> : <input
                        type="range"
                        min="0.4"
                        max="3"
                        step="0.05"
                        value={outputDraft.widgetStyles[selectedOutputWidget]?.scale || 1}
                        onChange={(event) => updateWidgetStyle(selectedOutputWidget, { scale: Number(event.target.value) })}
                        className={`w-full accent-blue-500 h-1 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-250'}`}
                      />}
                    </div>

                    {(['currentLyrics', 'nextLyrics', 'previousLyrics'] as OutputWidgetId[]).includes(selectedOutputWidget) && (
                      <div className="grid grid-cols-2 gap-2">
                        <label className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Max Lines<input type="number" min="1" max="12" value={outputDraft.widgetStyles[selectedOutputWidget]?.maxLines || 2} onChange={(event) => updateWidgetStyle(selectedOutputWidget, { maxLines: Number(event.target.value) })} className={`mt-1 h-9 w-full rounded-lg border px-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`} /></label>
                        <label className={`text-[10px] font-bold uppercase tracking-[0.14em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Overflow<select value={outputDraft.widgetStyles[selectedOutputWidget]?.overflow || 'clip'} onChange={(event) => updateWidgetStyle(selectedOutputWidget, { overflow: event.target.value === 'ellipsis' ? 'ellipsis' : 'clip' })} className={`mt-1 h-9 w-full rounded-lg border px-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}><option value="clip">Clip</option><option value="ellipsis">Ellipsis</option></select></label>
                        <label className={`col-span-2 text-[10px] font-bold uppercase tracking-[0.14em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Content Scope<select value={outputDraft.widgetStyles[selectedOutputWidget]?.contentScope || 'any'} onChange={(event) => updateWidgetStyle(selectedOutputWidget, { contentScope: event.target.value === 'song' ? 'song' : 'any' })} className={`mt-1 h-9 w-full rounded-lg border px-2 text-xs outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}><option value="any">Any slide text</option><option value="song">Song lyrics only</option></select></label>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Text Color</label>
                      <input
                        type="color"
                        value={outputDraft.widgetStyles[selectedOutputWidget]?.color || '#ffffff'}
                        onChange={(event) => updateWidgetStyle(selectedOutputWidget, { color: event.target.value })}
                        className={`h-7 w-12 rounded border bg-transparent cursor-pointer ${isDark ? 'border-slate-800' : 'border-slate-300'}`}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Alignment</label>
                      <div className={`grid grid-cols-3 gap-1 rounded-lg p-1 border ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
                        {(['left', 'center', 'right'] as const).map((align) => (
                          <button
                            key={align}
                            type="button"
                            onClick={() => updateWidgetStyle(selectedOutputWidget, { textAlign: align })}
                            className={`rounded px-2 py-1 text-[10px] font-bold uppercase ${
                              outputDraft.widgetStyles[selectedOutputWidget]?.textAlign === align
                                ? 'bg-blue-600 text-white shadow-sm'
                                : isDark
                                  ? 'text-slate-400 hover:text-slate-255'
                                  : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {align}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className={`text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Background Color</label>
                      <input
                        type="color"
                        value={outputDraft.widgetStyles[selectedOutputWidget]?.backgroundColor || '#000000'}
                        onChange={(event) => updateWidgetStyle(selectedOutputWidget, { backgroundColor: event.target.value })}
                        className={`h-7 w-12 rounded border bg-transparent cursor-pointer ${isDark ? 'border-slate-800' : 'border-slate-300'}`}
                      />
                    </div>

                    <div className="space-y-1">
                      <div className={`flex justify-between text-[10px] font-bold uppercase tracking-[0.16em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                        <span>Background Opacity</span>
                        <span>{Math.round((outputDraft.widgetStyles[selectedOutputWidget]?.backgroundOpacity ?? 0.18) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.02"
                        value={outputDraft.widgetStyles[selectedOutputWidget]?.backgroundOpacity ?? 0.18}
                        onChange={(event) => updateWidgetStyle(selectedOutputWidget, { backgroundOpacity: Number(event.target.value) })}
                        className={`w-full accent-blue-500 h-1 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-250'}`}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer select-none ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <input
                          type="checkbox"
                          checked={outputDraft.widgetStyles[selectedOutputWidget]?.shadow ?? true}
                          onChange={(event) => updateWidgetStyle(selectedOutputWidget, { shadow: event.target.checked })}
                          className={`h-3.5 w-3.5 rounded focus:ring-blue-600 ${isDark ? 'border-slate-700 bg-slate-800 text-blue-600' : 'border-slate-300 bg-white text-blue-600'}`}
                        />
                        Text Shadow
                      </label>

                      <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer select-none ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <input
                          type="checkbox"
                          checked={outputDraft.widgetStyles[selectedOutputWidget]?.borderVisible ?? true}
                          onChange={(event) => updateWidgetStyle(selectedOutputWidget, { borderVisible: event.target.checked })}
                          className={`h-3.5 w-3.5 rounded focus:ring-blue-600 ${isDark ? 'border-slate-700 bg-slate-800 text-blue-600' : 'border-slate-300 bg-white text-blue-600'}`}
                        />
                        Show Border
                      </label>
                      <label className={`flex items-center gap-2 text-xs font-semibold cursor-pointer select-none ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                        <input type="checkbox" checked={outputDraft.widgetStyles[selectedOutputWidget]?.showLabel !== false} onChange={(event) => updateWidgetStyle(selectedOutputWidget, { showLabel: event.target.checked })} className={`h-3.5 w-3.5 rounded focus:ring-blue-600 ${isDark ? 'border-slate-700 bg-slate-800 text-blue-600' : 'border-slate-300 bg-white text-blue-600'}`} />
                        Show Widget Label
                      </label>
                    </div>

                    <div className={`pt-4 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                      <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Position & Dimensions</div>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { key: 'x', label: 'X (%)' },
                          { key: 'y', label: 'Y (%)' },
                          { key: 'width', label: 'Width (%)' },
                          { key: 'height', label: 'Height (%)' },
                        ].map((item) => (
                          <label key={item.key} className={`text-[10px] font-bold uppercase tracking-[0.14em] block ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                            {item.label}
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={Math.round(outputDraft.widgetLayouts[selectedOutputWidget][item.key as keyof typeof outputDraft.widgetLayouts[typeof selectedOutputWidget]])}
                              onChange={(event) => updateWidgetLayout(selectedOutputWidget, { [item.key]: Number(event.target.value) })}
                              className={`mt-1 h-8 w-full rounded-lg border px-2 text-xs font-medium outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Transitions Section */}
                <div className={`pt-4 border-t space-y-3 ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Transitions</div>
                  <select
                    value={outputDraft.transitionSettings.type}
                    onChange={(event) => updateOutputDraft((preset) => ({
                      ...preset,
                      transitionSettings: { ...preset.transitionSettings, type: event.target.value as OutputPreset['transitionSettings']['type'] },
                    }))}
                    className={`h-9 w-full rounded-lg border px-2.5 text-xs outline-none focus:border-blue-500 ${isDark ? 'border-slate-800 bg-slate-900 text-slate-200' : 'border-slate-200 bg-slate-50 text-slate-800'}`}
                  >
                    <option value="fade">Fade</option>
                    <option value="slide">Slide</option>
                    <option value="zoom">Zoom</option>
                    <option value="none">None</option>
                  </select>
                  
                  <div className="space-y-1">
                    <div className={`flex justify-between text-[10px] font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                      <span>Duration</span>
                      <span>{outputDraft.transitionSettings.durationMs} ms</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1500"
                      step="25"
                      value={outputDraft.transitionSettings.durationMs}
                      onChange={(event) => updateOutputDraft((preset) => ({
                        ...preset,
                        transitionSettings: { ...preset.transitionSettings, durationMs: Number(event.target.value) },
                      }))}
                      className={`w-full accent-blue-500 h-1 rounded-lg appearance-none cursor-pointer ${isDark ? 'bg-slate-800' : 'bg-slate-250'}`}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className={`theme-scope flex min-h-0 flex-1 overflow-hidden transition-colors duration-200 ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
          <LayerListPanel
            layers={selectedSlide?.layers || []}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onToggleVisibility={(layerId, visible) => updateLayer(layerId, { visible })}
            onDeleteLayer={deleteLayer}
            onReorderLayer={reorderLayers}
            onAddLayer={addLayer}
            isCollapsed={isLayerPanelCollapsed}
            onToggleCollapse={() => setIsLayerPanelCollapsed((collapsed) => !collapsed)}
          />

          <CanvasArea
            selectedSlide={primarySlide}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            canvasRef={canvasRef}
            slideCanvasRef={slideCanvasRef}
            outputWidth={outputWidth}
            outputHeight={outputHeight}
            canvasStyle={canvasStyle}
            onAddLayer={addLayer}
          />

          <PropertiesPanel
            selectedLayer={selectedLayer}
            updateSelectedLayer={updateSelectedLayer}
            updateContent={updateSlideContent}
            mediaItems={filteredMediaItems}
            undo={undo}
            redo={redo}
            canUndo={canUndo}
            canRedo={canRedo}
            onAlign={alignSelectedLayer}
            textContentMode="layer"
            onDeleteLayer={deleteLayer}
            textRoleOptions={[
              ...CONTENT_THEME_EDITOR_CONFIG[contentType].roles.map(({ value, label, content }) => ({ value, label, sampleContent: content })),
              { value: 'static', label: 'Static Text' },
            ]}
          />
        </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
