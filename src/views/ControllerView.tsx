import { useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode, type UIEvent as ReactUIEvent } from 'react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import {
  AlignJustify,
  BookOpen,
  CalendarDays,
  ChevronDown,
  Clock3,
  Copy,
  Edit3,
  FileText,
  Film,
  Gauge,
  Globe,
  Grid2X2,
  Image as ImageIcon,
  Library,
  ListFilter,
  MonitorOff,
  Music2,
  Pause,
  Play,
  Plus,
  Presentation,
  Repeat,
  Repeat1,
  RotateCcw,
  RotateCw,
  Search,
  ScreenShare,
  Settings,
  Sparkles,
  Square,
  Star,
  Tag,
  Trash2,
  Volume2,
  VolumeX,
  Send,
} from 'lucide-react';
import { ipcMediaService } from '../core/services/ipcMediaService';
import { ipcOutputSettingsService } from '../core/services/ipcOutputSettingsService';
import { ipcSongService, type SongWithSlides } from '../core/services/ipcSongService';
import { ipcTemplateService } from '../core/services/ipcTemplateService';
import { ipcPresetPreviewService } from '../core/services/ipcPresetPreviewService';
import { usePresentationStore } from '../core/stores/usePresentationStore';
import { TEMP_SCHEDULE_ID, useScheduleStore } from '../core/stores/useScheduleStore';
import { useSettingsStore } from '../core/stores/useSettingsStore';
import { buildBibleVirtualSlides } from '../core/utils/bibleSlides';
import { buildMediaVirtualSlides } from '../core/utils/mediaSlides';
import { toRenderableMediaUrl } from '../core/utils/mediaUrl';
import { importPdfWithRasterizer } from '../core/utils/pdf';
import {
  findPrimaryVideoLayer,
  getVideoPlaybackId,
  normalizeVideoPlaybackTime,
} from '../core/utils/videoLayers';
import type { ContentThemeType, Media, SlideLayer, Song, Template } from '../electron/database/schema';
import type { MediaPlaybackState } from '../core/models/types';
import {
  DEFAULT_OUTPUT_PRESET_IDS,
  getDefaultOutputPresetIdForRole,
  type ScreenLayoutPreset,
} from '../core/models/outputSettings';
import type { OpenPresetEditorPayload } from '../core/presets/presetEditorWindow';
import {
  getScreenLayoutThumbnailSignature,
  renderContentThemeThumbnail,
  renderScreenLayoutThumbnail,
} from '../core/presets/presetThumbnailRenderer';
import { formatDuration } from '../utils/timeUtils';
import { parseSongLyrics } from '../utils/songParser';
import { LiveOutputSurface } from '../components/common/LiveOutputSurface';
import { RoleOutputSurface } from '../components/common/RoleOutputSurface';
import { SlideLabelBadge } from '../components/common/SlideLabelBadge';
import { LogoOutputSurface } from '../components/common/LogoOutputSurface';
import { useToast } from '../components/common/Toast';
import AddScheduleItemModal from '../components/modals/AddScheduleItemModal';
import ScheduleManagerModal from '../components/modals/ScheduleManagerModal';
import SettingsModal from '../components/modals/SettingsModal';
import SongEditorModal from '../components/modals/SongEditorModal';
import BibleSettingsModal from '../components/modals/BibleSettingsModal';
import SongPresetEditorModal from '../components/modals/SongPresetEditorModal';
import AddOnlineMediaModal from '../components/modals/AddOnlineMediaModal';
import BiblePanel from '../components/controller/BiblePanel';
import AudioPanel from '../components/controller/AudioPanel';
import PrdPresenterPanel from '../components/controller/PrdPresenterPanel';
import CapturePanel from '../components/controller/CapturePanel';
import { QuickAlertPopover } from '../components/controller/QuickAlertPopover';
import { useUIStore } from '../core/stores/useUIStore';
import { useHotkeysStore } from '../core/stores/useHotkeysStore';
import { LAST_RUNDOWN_KEY, useGeneralSettingsStore } from '../core/stores/useGeneralSettingsStore';
import {
  findSlideLabel,
  useSlideLabelSettingsStore,
} from '../core/stores/useSlideLabelSettingsStore';
import { useBible } from '../hooks/useBible';
import { useBibleManager } from '../hooks/useBibleManager';
import type { BibleVersion } from '../electron/database/schema';
import { sync } from '../core/sync';
import type { RemoteCommand, RemoteControllerContext } from '../core/remote/types';
import { buildLayersFromContentThemeData } from '../core/songEditor/songPresets';

type LibraryTab = 'all' | 'songs' | 'media' | 'presentations' | 'preset' | 'bible';
type SlideViewMode = 'grid' | 'text';
type LibraryViewMode = 'grid' | 'list' | 'visual-list';
type PresetFamilyFilter = 'all' | 'content-theme' | 'screen-layout';

const LIBRARY_VIEW_MODES_STORAGE_KEY = 'rumedia:library-view-modes';

function isLibraryViewMode(value: unknown): value is LibraryViewMode {
  return value === 'grid' || value === 'list' || value === 'visual-list';
}

function loadLibraryViewModes(): Record<LibraryTab, LibraryViewMode> {
  const legacyMode = localStorage.getItem('rumedia:library-view-mode');
  const fallbackMode: LibraryViewMode = isLibraryViewMode(legacyMode) ? legacyMode : 'visual-list';
  let stored: Partial<Record<LibraryTab, LibraryViewMode>> = {};
  try {
    const parsed = JSON.parse(localStorage.getItem(LIBRARY_VIEW_MODES_STORAGE_KEY) || '{}');
    if (parsed && typeof parsed === 'object') stored = parsed;
  } catch {
    stored = {};
  }
  const resolve = (tab: LibraryTab) => isLibraryViewMode(stored[tab]) ? stored[tab] : fallbackMode;
  return {
    all: resolve('all'),
    songs: 'list',
    media: resolve('media'),
    presentations: resolve('presentations'),
    preset: resolve('preset'),
    bible: resolve('bible'),
  };
}

const CUSTOM_LAYERS_MARKER = '__custom_layers__';
const LIBRARY_RENDER_BATCH_SIZE = 84;
const BUILTIN_SCREEN_LAYOUT_IDS = new Set<string>(Object.values(DEFAULT_OUTPUT_PRESET_IDS));

type LibraryMediaDragPayload = {
  type: 'media';
  id: string;
  title?: string;
  mediaType?: string;
  filepath?: string;
  playbackSettings?: string | null;
  duration?: number | null;
};

type SongPresetDragPayload = {
  type: 'song-preset';
  id: string;
  name?: string;
};

const LIBRARY_PREVIEW_FALLBACK_THEME = JSON.stringify([
  { layerType: 'base', layerOrder: 1, content: '#111318', visible: true, opacity: 1, style: null },
  {
    layerType: 'text',
    layerOrder: 2,
    content: "Besar setia-Mu\nKasih-Mu tak berkesudahan",
    visible: true,
    opacity: 1,
    style: JSON.stringify({
      x: 50,
      y: 50,
      boxWidth: 82,
      boxHeight: 42,
      sizingMode: 'fixed',
      textAlign: 'center',
      scale: 1,
      color: '#ffffff',
      shadow: true,
      fontFamily: 'Outfit, Manrope, sans-serif',
      fontWeight: 700,
      textRole: 'lyrics-main',
    }),
  },
]);

function buildLibraryContentThemePreview(preset: Template) {
  const contentType = preset.contentType || 'song';
  const samples = {
    song: {
      type: 'lyrics',
      content: "Besar setia-Mu\nKasih-Mu tak berkesudahan",
      label: 'Verse 1',
    },
    scripture: {
      type: 'bible',
      content: 'Karena begitu besar kasih Allah akan dunia ini.',
      label: 'Yohanes 3:16',
    },
    presentation: {
      type: 'custom',
      content: 'Hidup dalam kasih dan pengharapan.',
      label: 'Sermon',
    },
    media: {
      type: 'media',
      content: 'Ibadah Minggu',
      label: 'Media',
    },
  } as const;
  const sample = samples[contentType];
  const slideId = `library-preset-preview-${preset.id}`;
  return {
    id: slideId,
    type: sample.type,
    title: preset.name,
    content: sample.content,
    label: sample.label,
    sectionType: contentType === 'scripture' ? 'Bible' : sample.label,
    contentThemeId: preset.id,
    contentThemeName: preset.name,
    scriptureText: contentType === 'scripture' ? sample.content : null,
    scriptureReference: contentType === 'scripture' ? 'Yohanes 3:16' : null,
    versionCode: contentType === 'scripture' ? 'TB' : null,
    layers: buildLayersFromContentThemeData(slideId, sample.content, preset.layersData, {
      songTitle: 'Besar Setia-Mu',
      sectionLabel: contentType === 'scripture' ? 'Ayat' : 'Verse 1',
      scriptureText: 'Karena begitu besar kasih Allah akan dunia ini.',
      scriptureReference: 'Yohanes 3:16',
      scriptureVersion: 'TB',
      presentationTitle: 'Hidup dalam Kasih',
      presentationBody: 'Hidup dalam kasih dan pengharapan.',
      mediaCaption: 'Ibadah Minggu',
    }),
  } as any;
}

function buildLibraryScreenLayoutPreview(layout: ScreenLayoutPreset) {
  const slideId = `library-screen-layout-preview-${layout.id}`;
  const themeLayersData = layout.contentRules.song.themeLayersData || LIBRARY_PREVIEW_FALLBACK_THEME;
  const content = "Besar setia-Mu\nKasih-Mu tak berkesudahan";
  return {
    id: slideId,
    type: 'lyrics',
    title: layout.name,
    content,
    label: 'Verse 1',
    sectionType: 'Verse',
    layers: buildLayersFromContentThemeData(slideId, content, themeLayersData, {
      songTitle: 'Besar Setia-Mu',
      sectionLabel: 'Verse 1',
    }),
    libraryScreenLayoutPreview: layout,
  } as any;
}

const SONG_PRESET_DRAG_TYPE = 'application/x-rumedia-song-preset';

const typeLabel: Record<string, string> = {
  song: 'Song',
  bible: 'Bible',
  media: 'Media',
  announcement: 'Section',
  custom: 'Section',
};

const typeIcon: Record<string, typeof Music2> = {
  song: Music2,
  bible: BookOpen,
  media: Film,
  announcement: Clock3,
  custom: Clock3,
};

function safeJsonArray(value?: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type LyricMatch = {
  id: string;
  sectionLabel: string;
  excerpt: string;
  occurrenceCount: number;
};

function formatLyricSectionLabel(type: string, number: number | null, index: number) {
  const labels: Record<string, string> = {
    verse: 'Verse',
    chorus: 'Chorus',
    bridge: 'Bridge',
    pre_chorus: 'Pre-Chorus',
    intro: 'Intro',
    outro: 'Outro',
    tag: 'Tag',
  };
  const label = labels[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const fallbackNumber = type === 'verse' && number === null ? index + 1 : number;
  return fallbackNumber ? `${label} ${fallbackNumber}` : label;
}

function countTextOccurrences(text: string, query: string) {
  if (!query) return 0;
  const normalizedText = text.toLocaleLowerCase();
  const normalizedNeedle = query.toLocaleLowerCase();
  let count = 0;
  let cursor = 0;
  while ((cursor = normalizedText.indexOf(normalizedNeedle, cursor)) !== -1) {
    count += 1;
    cursor += Math.max(normalizedNeedle.length, 1);
  }
  return count;
}

function findLyricMatches(rawLyrics: string | null | undefined, query: string): LyricMatch[] {
  const trimmedQuery = query.trim();
  if (!rawLyrics || !trimmedQuery) return [];

  return parseSongLyrics(rawLyrics).flatMap((section, sectionIndex) => {
    const lines = section.content.split('\n').map((line) => line.trim()).filter(Boolean);
    return lines.flatMap((line, lineIndex) => {
      const occurrenceCount = countTextOccurrences(line, trimmedQuery);
      if (occurrenceCount === 0) return [];
      const excerptStart = Math.max(0, lineIndex - 1);
      const excerptEnd = Math.min(lines.length, lineIndex + 2);
      return [{
        id: `${sectionIndex}-${lineIndex}`,
        sectionLabel: formatLyricSectionLabel(section.type, section.number, sectionIndex),
        excerpt: lines.slice(excerptStart, excerptEnd).join('\n'),
        occurrenceCount,
      }];
    });
  });
}

function HighlightedLyric({ text, query }: { text: string; query: string }) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  if (!normalizedQuery) return <>{text}</>;

  const parts: ReactNode[] = [];
  const normalizedText = text.toLocaleLowerCase();
  let cursor = 0;
  let matchIndex = normalizedText.indexOf(normalizedQuery, cursor);

  while (matchIndex !== -1) {
    if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
    const matchEnd = matchIndex + normalizedQuery.length;
    parts.push(
      <mark
        key={`${matchIndex}-${matchEnd}`}
        className="rounded-[3px] bg-amber-400/22 px-0.5 font-semibold text-amber-700 dark:bg-amber-400/18 dark:text-amber-300"
      >
        {text.slice(matchIndex, matchEnd)}
      </mark>,
    );
    cursor = matchEnd;
    matchIndex = normalizedText.indexOf(normalizedQuery, cursor);
  }

  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function getItemTitle(item: any) {
  if (!item) return 'No Item Selected';
  if (item.itemType === 'song' && item.songData?.title) return item.songData.title;
  if (item.itemType === 'media' && item.mediaData?.filename) return item.mediaData.filename;
  if (item.itemType === 'bible') {
    if (item.content) {
      try {
        return JSON.parse(item.content)?.reference || 'Bible Reading';
      } catch {
        return 'Bible Reading';
      }
    }
    if (item.bibleBook && item.bibleChapter && item.bibleVerseStart) {
      return `${item.bibleBook} ${item.bibleChapter}:${item.bibleVerseStart}${item.bibleVerseEnd ? `-${item.bibleVerseEnd}` : ''}`;
    }
  }
  return item.content || 'Untitled Section';
}

function getSlideLabel(slide: any, index: number) {
  if (slide?.sectionType) {
    return `${slide.sectionType}${slide.sectionNumber ? ` ${slide.sectionNumber}` : ''}`;
  }
  return slide?.label || `Slide ${index + 1}`;
}

function getSlideText(slide: any) {
  return String(slide?.content || slide?.label || '').trim();
}

function formatSeconds(time: number) {
  if (!Number.isFinite(time) || time < 0) return '00:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getSelectedSlides(selectedItem: any, libraryPreviewSong: SongWithSlides | null, libraryPreviewMedia: Media | null) {
  if (selectedItem?.itemType === 'song') return selectedItem.songData?.slides || [];
  if (selectedItem?.itemType === 'media') return buildMediaVirtualSlides(selectedItem.mediaData);
  if (selectedItem?.itemType === 'bible') return buildBibleVirtualSlides(selectedItem);
  if (libraryPreviewSong) return libraryPreviewSong.slides || [];
  if (libraryPreviewMedia) return buildMediaVirtualSlides(libraryPreviewMedia);
  return [];
}

function parseJsonObject(value?: string | null) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildSongMediaBackgroundLayer(slideId: string, media: Media): SlideLayer {
  const playbackSettings = parseJsonObject(media.playbackSettings);

  return {
    id: crypto.randomUUID(),
    slideId,
    layerType: 'background',
    layerOrder: 2,
    visible: true,
    opacity: 1,
    content: media.filepath,
    mediaId: media.id,
    style: JSON.stringify({
      ...playbackSettings,
      playbackSettings,
      mediaType: media.mediaType,
      isSongBackground: true,
      source: media.filepath,
      duration: media.duration || 0,
      objectFit: 'cover',
    }),
    transition: null,
  };
}

function applyMediaBackgroundToSlide(slide: any, media: Media) {
  const slideId = slide.id || crypto.randomUUID();
  const sourceLayers = Array.isArray(slide.layers) ? slide.layers : [];
  const preservedLayers = sourceLayers
    .filter((layer: SlideLayer) => !['background', 'media'].includes(layer.layerType))
    .map((layer: SlideLayer) => ({ ...layer, id: layer.id || crypto.randomUUID(), slideId }));

  const hasBaseLayer = preservedLayers.some((layer: SlideLayer) => layer.layerType === 'base');
  const hasOverlayLayer = preservedLayers.some((layer: SlideLayer) => layer.layerType === 'overlay');

  const nextLayers: SlideLayer[] = [
    ...(hasBaseLayer
      ? []
      : [{
          id: crypto.randomUUID(),
          slideId,
          layerType: 'base',
          layerOrder: 1,
          visible: true,
          opacity: 1,
          content: '#000000',
          mediaId: null,
          style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#000000' }),
          transition: null,
        } as SlideLayer]),
    buildSongMediaBackgroundLayer(slideId, media),
    ...preservedLayers,
    ...(hasOverlayLayer
      ? []
      : [{
          id: crypto.randomUUID(),
          slideId,
          layerType: 'overlay',
          layerOrder: 4,
          visible: true,
          opacity: 1,
          content: null,
          mediaId: null,
          style: JSON.stringify({ background: 'rgba(0, 0, 0, 0.35)' }),
          transition: null,
        } as SlideLayer]),
  ]
    .sort((a, b) => {
      const weight: Record<string, number> = { base: 1, background: 2, media: 3, overlay: 4, text: 5 };
      return (weight[a.layerType] || a.layerOrder || 99) - (weight[b.layerType] || b.layerOrder || 99);
    })
    .map((layer, index) => ({ ...layer, layerOrder: index + 1 }));

  return {
    ...slide,
    id: slideId,
    customThemeId: CUSTOM_LAYERS_MARKER,
    layers: nextLayers,
  };
}

function clearMediaBackgroundFromSlide(slide: any) {
  const slideId = slide.id || crypto.randomUUID();
  const sourceLayers = Array.isArray(slide.layers) ? slide.layers : [];
  const nextLayers = sourceLayers
    .filter((layer: SlideLayer) => !['background', 'media'].includes(layer.layerType))
    .map((layer: SlideLayer, index: number) => ({
      ...layer,
      id: layer.id || crypto.randomUUID(),
      slideId,
      layerOrder: index + 1,
    }));

  return {
    ...slide,
    id: slideId,
    customThemeId: CUSTOM_LAYERS_MARKER,
    layers: nextLayers,
  };
}

function IconButton({
  children,
  label,
  onClick,
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-text/10 bg-surface text-text/62 transition hover:bg-text/[0.06] hover:text-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function PillButton({
  children,
  onClick,
  className = '',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg border border-text/10 bg-surface px-3 text-xs font-semibold text-text/72 transition hover:bg-text/[0.06] hover:text-text active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

function ResizeHandle({ direction }: { direction: 'horizontal' | 'vertical' }) {
  const isHorizontal = direction === 'horizontal';
  return (
    <Separator
      className={`group relative shrink-0 bg-transparent transition ${
        isHorizontal ? 'w-[5px] cursor-col-resize' : 'h-[5px] cursor-row-resize'
      }`}
    >
      <div
        className={`absolute bg-slate-200 transition group-hover:bg-indigo-500/70 group-data-[resize-handle-active]:bg-indigo-600 ${
          isHorizontal ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
        }`}
      />
    </Separator>
  );
}

function RundownPanel({
  onOpenScheduleManager,
  onAddItem,
  onApplyMediaToSong,
}: {
  onOpenScheduleManager: () => void;
  onAddItem: () => void;
  onApplyMediaToSong: (item: any, payload: LibraryMediaDragPayload) => Promise<void>;
}) {
  const {
    currentSchedule,
    selectedItemId,
    setSelectedItem,
    duplicateItem,
    deleteItem,
    addItem,
    reorderItems,
    getTotalDuration,
    libraryPreviewMode,
    refreshPresetDrivenSongs,
  } = useScheduleStore();
  const { setPreviewSlide, goLive } = usePresentationStore();
  const toast = useToast();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const items = currentSchedule?.items || [];
  const totalDuration = currentSchedule ? getTotalDuration() : 0;

  const previewItem = (item: any) => {
    setSelectedItem(item.id, 'preview');
    const slides = getSelectedSlides(item, null, null);
    if (slides[0]) {
      setPreviewSlide(slides[0] as any);
    }
  };

  const activateItemLive = (item: any) => {
    setSelectedItem(item.id, 'liveControl');
    const slides = getSelectedSlides(item, null, null);
    if (slides[0]) {
      setPreviewSlide(slides[0] as any);
      goLive(slides[0] as any);
    }
  };

  const handleDropFromLibrary = async (event: React.DragEvent) => {
    event.preventDefault();
    if (event.dataTransfer.types.includes('text/x-rundown-item')) return;
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      return;
    }
    if (data.type === 'song') {
      const id = await addItem({ itemType: 'song', songId: data.id, content: data.title || null, duration: 5 });
      setSelectedItem(id);
    }
    if (data.type === 'media') {
      const id = await addItem({ itemType: 'media', mediaId: data.id, content: data.title || null, duration: 1 });
      setSelectedItem(id);
    }
    if (data.type === 'bible') {
      const id = await addItem({
        itemType: 'bible',
        bibleVersionId: data.bibleVersionId || null,
        bibleBook: data.bibleBook,
        bibleChapter: data.bibleChapter,
        bibleVerseStart: data.bibleVerseStart,
        bibleVerseEnd: data.bibleVerseEnd,
        content: data.content || null,
        duration: data.duration || 3,
      });
      setSelectedItem(id);
    }
  };

  const handleReorderDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId || !currentSchedule) return;
    const ids = currentSchedule.items.map((item) => item.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await reorderItems(next);
    setDraggedId(null);
  };

  const applyPresetToRundownSong = async (item: any, payload: SongPresetDragPayload) => {
    const songId = item?.itemType === 'song' ? item.songId || item.songData?.id : null;
    if (!songId) {
      toast.warning('Song presets can only be dropped onto song items.');
      return;
    }

    try {
      await ipcSongService.update(songId, { defaultTemplateId: payload.id });
      await refreshPresetDrivenSongs();
      toast.success(`Preset "${payload.name || 'Song preset'}" applied to "${getItemTitle(item)}".`);
    } catch (error) {
      console.error('[RundownPanel] Failed to apply song preset:', error);
      toast.error('Failed to apply preset to song.');
    }
  };

  return (
    <aside
      className="flex min-h-0 w-full h-full flex-col bg-white"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDropFromLibrary}
    >
      <section className="flex flex-1 min-h-0 flex-col bg-white border-b border-slate-200">
        <div className="flex items-start gap-2 border-b border-slate-100 p-2.5">
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded bg-indigo-50 text-indigo-700">
            <CalendarDays size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-700">Rundown</p>
            <button type="button" onClick={onOpenScheduleManager} className="mt-0.5 flex w-full items-center justify-between gap-1 text-left">
              <span className="truncate text-xs font-bold text-slate-950">
                {currentSchedule?.name || 'Quick Rundown'}
              </span>
              <ChevronDown size={14} className="text-slate-500" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-2.5 py-1.5">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400">Service Time</p>
            <p className="mt-0.5 text-xs font-extrabold text-slate-950">
              {totalDuration > 0 ? formatDuration(totalDuration) : '00:00'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenScheduleManager}
            className="inline-flex h-6 items-center gap-1 rounded bg-indigo-50 px-2 text-[10px] font-bold text-indigo-700 transition hover:bg-indigo-100 active:scale-[0.98]"
          >
            <Edit3 size={11} />
            Edit
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-1.5 pb-1.5">
          {items.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center px-2 text-center text-[10px] text-slate-400">
              <CalendarDays size={24} className="mb-1.5 opacity-30" />
              Drag songs or media here, or use Add Item.
            </div>
          )}
          {items.map((item, index) => {
            const Icon = typeIcon[item.itemType] || Clock3;
            const active = selectedItemId === item.id;
            const isItemLive = active && libraryPreviewMode === 'liveControl';
            const isItemPreview = active && libraryPreviewMode === 'preview';
            return (
              <div
                key={item.id}
                draggable={items.length > 1}
                onDragStart={() => setDraggedId(item.id)}
                onDragEnter={() => setDragOverItemId(item.id)}
                onDragLeave={() => setDragOverItemId(null)}
                onDrop={(event) => {
                  setDragOverItemId(null);
                  event.stopPropagation();
                  const raw = event.dataTransfer.getData('application/json');
                  if (raw) {
                    try {
                      const data = JSON.parse(raw);
                      if (data.type === 'song-preset') {
                        void applyPresetToRundownSong(item, data as SongPresetDragPayload);
                        return;
                      }
                      if (data.type === 'media') {
                        void onApplyMediaToSong(item, data as LibraryMediaDragPayload);
                        return;
                      }
                    } catch (e) {
                      console.error('[ControllerView] Failed to parse drop data:', e);
                    }
                  }
                  void handleReorderDrop(item.id);
                }}
                onDragOver={(event) => event.preventDefault()}
                onClick={() => previewItem(item)}
                onDoubleClick={() => activateItemLive(item)}
                className={`group grid w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left transition cursor-pointer select-none ${
                  dragOverItemId === item.id
                    ? 'border-indigo-500 bg-indigo-100 text-indigo-950 font-bold scale-[1.01] shadow-sm'
                    : isItemLive
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 font-semibold'
                    : isItemPreview
                    ? 'border-indigo-400 bg-indigo-50/50 text-indigo-700 font-semibold'
                    : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
                }`}
                style={{ gridTemplateColumns: '20px 14px minmax(0, 1fr) 32px' }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    activateItemLive(item);
                  }}
                  title="Send to Live"
                  className="flex items-center justify-center h-5 w-5 rounded hover:bg-slate-200/50"
                >
                  <Icon size={14} className={isItemLive ? 'text-emerald-600' : isItemPreview ? 'text-indigo-600' : 'text-slate-500'} />
                </button>
                <span className="font-mono text-[10px] text-slate-500">{index + 1}</span>
                <div className="min-w-0 text-left">
                  <span className="block truncate text-xs font-semibold text-slate-950">{getItemTitle(item)}</span>
                  <span className={`mt-0.5 inline-flex rounded px-1 py-0.2 text-[8px] font-extrabold uppercase tracking-[0.06em] ${
                    isItemLive
                      ? 'bg-emerald-100 text-emerald-700'
                      : isItemPreview
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}>
                    {typeLabel[item.itemType] || 'Item'}
                  </span>
                </div>
                <div className="flex items-center justify-end gap-0.5">
                  <span className="font-mono text-[10px] text-slate-500">{item.duration ? formatDuration(item.duration) : ''}</span>
                  <button
                    type="button"
                    className="hidden text-slate-400 hover:text-slate-950 group-hover:block"
                    onClick={() => void duplicateItem(item.id)}
                    title="Duplicate"
                  >
                    <Copy size={11} />
                  </button>
                  <button
                    type="button"
                    className="hidden text-slate-400 hover:text-rose-600 group-hover:block"
                    onClick={() => void deleteItem(item.id)}
                    title="Delete"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

      </section>

      <section className="shrink-0 bg-white p-2 border-t border-slate-200">
        <button
          type="button"
          onClick={onAddItem}
          className="flex h-8 w-full items-center justify-center gap-1.5 rounded border border-slate-200 bg-white text-xs font-bold text-indigo-700 transition hover:bg-indigo-50 active:scale-[0.98]"
        >
          <Plus size={14} />
          Add Item
        </button>
        <p className="mt-2 text-center text-[10px] text-slate-400">
          {currentSchedule?.id === TEMP_SCHEDULE_ID ? 'Temporary Rundown' : 'Rumedia v2.0.0'}
        </p>
      </section>
    </aside>
  );
}

function MainEditorPanel({
  slides,
  selectedItem,
  libraryPreviewSong,
  libraryPreviewMedia,
  libraryPreviewMode,
  onApplyMediaToSongSlides,
  onClearMediaFromSongSlides: _onClearMediaFromSongSlides,
}: {
  slides: any[];
  selectedItem: any;
  libraryPreviewSong: SongWithSlides | null;
  libraryPreviewMedia: Media | null;
  libraryPreviewMode: 'preview' | 'liveControl';
  onApplyMediaToSongSlides: (payload: LibraryMediaDragPayload, slideId?: string) => Promise<void>;
  onClearMediaFromSongSlides: (slideId?: string) => Promise<void>;
}) {
  const { previewSlide, setPreviewSlide, goLive } = usePresentationStore();
  const {
    setLibraryPreviewMode,
    setSelectedItem,
    setLibraryPreviewSong,
    setLibraryPreviewMedia,
  } = useScheduleStore();
  const defaultSlideViewMode = useGeneralSettingsStore((state) => state.defaultSlideViewMode);
  const [slideViewMode, setSlideViewMode] = useState<SlideViewMode>(defaultSlideViewMode);
  const [mediaDropTarget, setMediaDropTarget] = useState<string | null>(null);
  const { activeView, setActiveView, openSettings } = useUIStore();
  const selectedTitle = selectedItem
    ? getItemTitle(selectedItem)
    : libraryPreviewSong?.title || libraryPreviewMedia?.filename || (previewSlide as any)?.title || 'No slide selected';
  const selectedSlideId = previewSlide?.id || slides[0]?.id;

  useEffect(() => setSlideViewMode(defaultSlideViewMode), [defaultSlideViewMode]);

  const handleSlideClick = (slide: any) => {
    setPreviewSlide(slide as any);
    if (libraryPreviewMode === 'liveControl') {
      goLive(slide as any);
    }
  };

  const handleSlideDoubleClick = (slide: any) => {
    setPreviewSlide(slide as any);
    void goLive(slide as any);
    setLibraryPreviewMode('liveControl');
    
    if (selectedItem) {
      setSelectedItem(selectedItem.id, 'liveControl');
    } else if (libraryPreviewSong) {
      setLibraryPreviewSong(libraryPreviewSong, 'liveControl');
    } else if (libraryPreviewMedia) {
      setLibraryPreviewMedia(libraryPreviewMedia, 'liveControl');
    }

    window.dispatchEvent(new CustomEvent('rumedia:focus-live-preview'));
  };

  const readMediaDragPayload = (event: React.DragEvent): LibraryMediaDragPayload | null => {
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      return parsed?.type === 'media' ? parsed : null;
    } catch {
      return null;
    }
  };

  const canDropMediaOnSong = Boolean(selectedItem?.itemType === 'song' || libraryPreviewSong);

  const handleSongMediaDragOver = (event: React.DragEvent) => {
    if (!canDropMediaOnSong) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleSongMediaDragEnter = (event: React.DragEvent, target: string) => {
    if (!canDropMediaOnSong) return;
    event.preventDefault();
    setMediaDropTarget(target);
  };

  const handleSongMediaDragLeave = (event: React.DragEvent, target: string) => {
    if (!canDropMediaOnSong) return;
    if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
    setMediaDropTarget((current) => (current === target ? null : current));
  };

  const handleSongMediaDrop = async (event: React.DragEvent, slideId?: string) => {
    if (!canDropMediaOnSong) return;
    event.preventDefault();
    event.stopPropagation();
    setMediaDropTarget(null);

    const payload = readMediaDragPayload(event);
    if (!payload) return;
    await onApplyMediaToSongSlides(payload, slideId);
  };

  useEffect(() => {
    if (!previewSlide && slides[0]) setPreviewSlide(slides[0] as any);
  }, [previewSlide, setPreviewSlide, slides]);

  // Local Preview Player Video Controls State
  const previewDisplaySlide = previewSlide || slides[0] || null;
  const previewScreenLayout = (previewDisplaySlide as any)?.libraryScreenLayoutPreview as ScreenLayoutPreset | undefined;
  const videoLayer = findPrimaryVideoLayer(previewDisplaySlide as any);
  const playbackSettings = videoLayer?.playbackSettings || {};
  const playbackMediaId = getVideoPlaybackId(videoLayer);
  const [localPreviewMediaPlayback, setLocalPreviewMediaPlayback] = useState<MediaPlaybackState | null>(null);

  useEffect(() => {
    setLocalPreviewMediaPlayback(null);
  }, [playbackMediaId]);

  const activeVideoPlayback = playbackMediaId
    ? (localPreviewMediaPlayback?.mediaId === playbackMediaId ? localPreviewMediaPlayback : null)
    : null;
  const videoVolume = activeVideoPlayback?.volume ?? (typeof playbackSettings.volume === 'number' ? playbackSettings.volume : 0);
  const videoSpeed = activeVideoPlayback?.playbackRate || Number(playbackSettings.speed) || 1;
  const videoStatus = activeVideoPlayback?.status || 'paused';
  const videoBehavior = activeVideoPlayback?.behavior || (['loop', 'stop', 'hold'].includes(String(playbackSettings.behavior)) ? playbackSettings.behavior : 'loop');
  const [lastVideoVolume, setLastVideoVolume] = useState(100);
  const [displayedVideoTime, setDisplayedVideoTime] = useState(Number(playbackSettings.startTime) || 0);
  const [probedVideoDuration, setProbedVideoDuration] = useState(0);
  const [isVideoScrubbing, setIsVideoScrubbing] = useState(false);
  const [showVideoVolume, setShowVideoVolume] = useState(false);
  const [showVideoSpeed, setShowVideoSpeed] = useState(false);
  const videoVolumeRef = useRef<HTMLDivElement | null>(null);
  const videoSpeedRef = useRef<HTMLDivElement | null>(null);
  const videoStartTime = Number(playbackSettings.startTime) || 0;
  const videoEndTime = Number(playbackSettings.endTime) || 0;
  const rawDuration = Math.max(videoEndTime || Number(videoLayer?.style.duration) || Number(playbackSettings.duration) || probedVideoDuration || (libraryPreviewMedia?.duration || 0), videoStartTime);
  const isYouTubeVideo = videoLayer?.style?.mediaType === 'youtube' || /(youtube\.com|youtu\.be)/i.test(videoLayer?.source || '');
  const videoDuration = rawDuration > 0 ? rawDuration : (isYouTubeVideo ? 300 : 0);
  const videoSliderMax = Math.max(videoDuration || 300, videoStartTime + 1);

  const updateVideoSpeed = (speedRate: number) => {
    updateVideoPlaybackState({ playbackRate: speedRate });
    setShowVideoSpeed(false);
  };

  useEffect(() => {
    setDisplayedVideoTime(activeVideoPlayback?.currentTime ?? videoStartTime);
    setProbedVideoDuration(0);
    setIsVideoScrubbing(false);
    setShowVideoVolume(false);
  }, [playbackMediaId, videoStartTime]);

  useEffect(() => {
    if (!activeVideoPlayback || isVideoScrubbing) return;

    const updateTime = () => {
      const elapsed = activeVideoPlayback.status === 'playing'
        ? ((Date.now() - activeVideoPlayback.updatedAt) / 1000) * (activeVideoPlayback.playbackRate || 1)
        : 0;
      setDisplayedVideoTime(normalizeVideoPlaybackTime(
        activeVideoPlayback.currentTime + elapsed,
        videoStartTime,
        videoDuration,
        activeVideoPlayback.behavior,
      ));
    };

    updateTime();
    if (activeVideoPlayback.status !== 'playing') return;

    const timer = window.setInterval(updateTime, 250);
    return () => window.clearInterval(timer);
  }, [activeVideoPlayback, isVideoScrubbing, videoDuration, videoStartTime]);

  useEffect(() => {
    if (!videoLayer?.source) return;
    if (videoDuration > videoStartTime + 1) return;

    let cancelled = false;
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    probe.src = toRenderableMediaUrl(videoLayer.source);
    probe.onloadedmetadata = () => {
      if (cancelled) return;
      const nextDuration = Number(probe.duration) || 0;
      if (nextDuration > 0) setProbedVideoDuration(nextDuration);
    };
    probe.onerror = () => {
      if (!cancelled) setProbedVideoDuration(0);
    };

    return () => {
      cancelled = true;
      probe.removeAttribute('src');
      probe.load();
    };
  }, [videoLayer?.source, videoDuration, videoStartTime]);

  useEffect(() => {
    if (!showVideoVolume) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (videoVolumeRef.current && target && !videoVolumeRef.current.contains(target)) {
        setShowVideoVolume(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showVideoVolume]);

  const updateVideoPlaybackState = (updates: Partial<MediaPlaybackState>) => {
    if (!playbackMediaId) return;

    setLocalPreviewMediaPlayback((prev: MediaPlaybackState | null) => {
      const current = prev || {
        mediaId: playbackMediaId,
        status: 'paused',
        currentTime: videoStartTime,
        volume: typeof playbackSettings.volume === 'number' ? playbackSettings.volume : 100,
        playbackRate: Number(playbackSettings.speed) || 1,
        behavior: (['loop', 'stop', 'hold'].includes(String(playbackSettings.behavior)) ? playbackSettings.behavior : 'loop') as any,
        commandId: crypto.randomUUID(),
        updatedAt: Date.now(),
      };
      return {
        ...current,
        ...updates,
        commandId: crypto.randomUUID(),
        updatedAt: Date.now(),
      };
    });
  };

  const updateVideoVolume = (nextVolume: number) => {
    const boundedVolume = Math.max(0, Math.min(100, nextVolume));
    if (boundedVolume > 0) setLastVideoVolume(boundedVolume);
    updateVideoPlaybackState({ volume: boundedVolume });
  };

  const toggleVideoMute = () => {
    if (videoVolume > 0) {
      updateVideoVolume(0);
      return;
    }
    updateVideoVolume(lastVideoVolume || 100);
  };

  const updateVideoPlayback = (status: 'paused' | 'playing' | 'stopped') => {
    const nextTime = status === 'stopped' ? videoStartTime : displayedVideoTime;
    updateVideoPlaybackState({ status, currentTime: nextTime });
    setDisplayedVideoTime(nextTime);
  };

  const toggleVideoPlayback = () => {
    updateVideoPlayback(videoStatus === 'playing' ? 'paused' : 'playing');
  };

  const toggleVideoBehavior = () => {
    updateVideoPlaybackState({ behavior: videoBehavior === 'loop' ? 'stop' : 'loop' });
  };

  const seekVideo = (nextTime: number) => {
    const boundedTime = Math.max(videoStartTime, Math.min(videoSliderMax, nextTime));
    setDisplayedVideoTime(boundedTime);
    updateVideoPlaybackState({ currentTime: boundedTime });
  };

  return (
    <main className="flex h-full min-w-0 flex-1 flex-col bg-white overflow-hidden">
      {/* Workspace Tabs */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-1.5 shrink-0">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm">
          {[
            { label: 'Library', icon: Library, view: 'songs' as const, action: () => setActiveView('songs') },
            { label: 'Bible', icon: BookOpen, view: 'bible' as const, action: () => setActiveView('bible') },
            { label: 'Audio', icon: Volume2, view: 'audio' as const, action: () => setActiveView('audio') },
            { label: 'Presentasi', icon: Presentation, view: 'prd' as const, action: () => setActiveView('prd') },
            { label: 'Capture', icon: ScreenShare, view: 'capture' as const, action: () => setActiveView('capture') },
          ].map((item) => {
            const Icon = item.icon;
            const active = activeView === item.view;
            return (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className={`flex h-8 items-center gap-2 rounded-md px-3 text-xs font-bold transition active:scale-[0.97] ${
                  active
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon size={14} className={active ? 'text-white' : 'text-slate-500'} />
                {item.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={openSettings}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97]"
        >
          <Settings size={14} className="text-slate-500" />
          Settings
        </button>
      </div>

      <div
        className={`relative flex items-center justify-between border-b px-3.5 py-2 transition shrink-0 ${
          mediaDropTarget === 'all' ? 'border-indigo-200 bg-indigo-50/70' : 'border-slate-100'
        }`}
        onDragEnter={(event) => handleSongMediaDragEnter(event, 'all')}
        onDragOver={handleSongMediaDragOver}
        onDragLeave={(event) => handleSongMediaDragLeave(event, 'all')}
        onDrop={(event) => void handleSongMediaDrop(event)}
        title={canDropMediaOnSong ? 'Drop media here to apply it to all song slides' : undefined}
      >
        {mediaDropTarget === 'all' && (
          <div className="pointer-events-none absolute inset-1 z-10 grid place-items-center rounded border border-dashed border-indigo-400 bg-white/78 text-[10px] font-extrabold uppercase tracking-[0.1em] text-indigo-700 backdrop-blur-sm">
            Drop to apply to all slides
          </div>
        )}
        <div className="flex flex-1 items-center justify-between gap-4 min-w-0">
          <div className="min-w-[190px] flex-1">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-indigo-700">PREVIEW CONTROL</p>
            </div>
            <h1 className="mt-0.5 truncate text-sm font-extrabold text-slate-950">{selectedTitle}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <div className="flex h-7 items-center rounded border border-slate-200 bg-slate-50 p-0.5">
              {[
                { id: 'grid' as const, label: 'Grid', icon: Grid2X2 },
                { id: 'text' as const, label: 'List', icon: AlignJustify },
              ].map((item) => {
                const Icon = item.icon;
                const active = slideViewMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.label} view`}
                    onClick={() => setSlideViewMode(item.id)}
                    className={`flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold transition active:scale-[0.98] ${
                      active ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-950'
                    }`}
                  >
                    <Icon size={12} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <Group orientation="vertical" className="flex-grow flex-1 min-h-0 w-full">
        <Panel defaultSize={50} minSize={30} className="flex flex-col min-h-0">
          {/* Local Preview Player & Video Control Toolbar */}
          {previewDisplaySlide ? (
            <div className="p-3 bg-slate-50/30 flex flex-col gap-2 min-h-0 flex-1 flex-grow">
              <div className="relative overflow-hidden bg-slate-950 rounded-lg shadow-inner flex-grow flex-1 w-full min-h-0">
                {previewScreenLayout ? (
                  <RoleOutputSurface
                    role={previewScreenLayout.role}
                    outputConfig={previewScreenLayout as any}
                    currentSlide={previewDisplaySlide as any}
                    isBlack={false}
                    isClear={false}
                    outputName={previewScreenLayout.name}
                    mediaPlayback={localPreviewMediaPlayback}
                  />
                ) : (
                  <LiveOutputSurface
                    currentSlide={previewDisplaySlide}
                    isBlack={false}
                    isClear={false}
                    mediaPlayback={localPreviewMediaPlayback}
                    mode="preview"
                  />
                )}
                <div className="absolute left-3 top-3 rounded-md bg-slate-950/60 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur">
                  <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  Preview Player
                </div>
              </div>

              {/* Video Control Bar if videoLayer is present */}
              {videoLayer && (
                <div className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 shadow-sm text-xs">
                  <IconButton
                    label="Rewind -10s"
                    onClick={() => seekVideo(Math.max(videoStartTime, displayedVideoTime - 10))}
                    className="h-8 w-8 border-transparent bg-slate-100 text-slate-700"
                  >
                    <RotateCcw size={13} />
                  </IconButton>
                  <IconButton
                    label={videoStatus === 'playing' ? 'Pause video' : 'Play video'}
                    onClick={toggleVideoPlayback}
                    className="h-8 w-8 border-transparent bg-emerald-50 text-emerald-700"
                  >
                    {videoStatus === 'playing' ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                  </IconButton>
                  <IconButton
                    label="Forward +10s"
                    onClick={() => seekVideo(Math.min(videoSliderMax, displayedVideoTime + 10))}
                    className="h-8 w-8 border-transparent bg-slate-100 text-slate-700"
                  >
                    <RotateCw size={13} />
                  </IconButton>
                  <IconButton
                    label="Stop video"
                    onClick={() => updateVideoPlayback('stopped')}
                    className="h-8 w-8 border-transparent bg-slate-100 text-slate-700"
                  >
                    <Square size={13} fill="currentColor" />
                  </IconButton>
                  <IconButton
                    label={videoBehavior === 'loop' ? 'Loop video' : 'Play once'}
                    onClick={toggleVideoBehavior}
                    className={`h-8 w-8 border-transparent ${videoBehavior === 'loop' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}
                  >
                    {videoBehavior === 'loop' ? <Repeat size={14} /> : <Repeat1 size={14} />}
                  </IconButton>
                  <div className="mx-1 h-5 w-px bg-slate-200" />
                  <IconButton
                    label={videoVolume === 0 ? 'Unmute video' : 'Mute video'}
                    onClick={() => setShowVideoVolume((value) => !value)}
                    className="h-8 w-8 border-transparent bg-slate-100 text-slate-700"
                  >
                    {videoVolume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </IconButton>
                  <div ref={videoVolumeRef} className="relative">
                    {showVideoVolume && (
                      <div className="absolute bottom-10 left-1/2 z-20 w-40 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2.5 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                        <div className="mb-1.5 flex items-center justify-between text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                          <span>Volume</span>
                          <span className="font-mono">{videoVolume}%</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            aria-label={videoVolume === 0 ? 'Unmute video' : 'Mute video'}
                            title={videoVolume === 0 ? 'Unmute video' : 'Mute video'}
                            onClick={toggleVideoMute}
                            className="grid h-7 w-7 shrink-0 place-items-center rounded bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                          >
                            {videoVolume === 0 ? <VolumeX size={13} /> : <Volume2 size={13} />}
                          </button>
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={1}
                            value={videoVolume}
                            onInput={(event) => updateVideoVolume(parseInt((event.target as HTMLInputElement).value, 10))}
                            className="h-1.5 min-w-0 flex-1 accent-emerald-500"
                            aria-label="Video volume"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <div ref={videoSpeedRef} className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setShowVideoSpeed((prev) => !prev);
                        setShowVideoVolume(false);
                      }}
                      title="Kecepatan Putar"
                      className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-mono font-bold text-slate-700 hover:bg-slate-200 transition"
                    >
                      <Gauge size={13} />
                      <span>{videoSpeed}x</span>
                    </button>
                    {showVideoSpeed && (
                      <div className="absolute bottom-10 left-1/2 z-20 w-36 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
                        <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400 px-1">
                          Speed / Kecepatan
                        </div>
                        {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                          <button
                            key={rate}
                            type="button"
                            onClick={() => updateVideoSpeed(rate)}
                            className={`w-full text-left px-2 py-1 rounded text-xs font-mono transition ${
                              videoSpeed === rate ? 'bg-indigo-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {rate}x {rate === 1.0 ? '(Normal)' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input
                    type="range"
                    min={videoStartTime}
                    max={videoSliderMax}
                    step={0.05}
                    value={Math.min(displayedVideoTime, videoSliderMax)}
                    onPointerDown={() => setIsVideoScrubbing(true)}
                    onPointerUp={(event) => {
                      setIsVideoScrubbing(false);
                      seekVideo(parseFloat((event.target as HTMLInputElement).value));
                    }}
                    onTouchEnd={(event) => {
                      setIsVideoScrubbing(false);
                      seekVideo(parseFloat((event.target as HTMLInputElement).value));
                    }}
                    onInput={(event) => seekVideo(parseFloat((event.target as HTMLInputElement).value))}
                    onChange={(event) => seekVideo(parseFloat((event.target as HTMLInputElement).value))}
                    className="h-1.5 min-w-24 flex-1 accent-emerald-500"
                    aria-label="Video timeline"
                  />
                  <span className="w-20 text-right font-mono text-[10px] font-bold text-slate-500">
                    {formatSeconds(displayedVideoTime)} / {videoDuration > 0 ? formatSeconds(videoDuration) : '--:--'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-400">
              No slide preview.
            </div>
          )}
        </Panel>

        <ResizeHandle direction="vertical" />

        <Panel defaultSize={50} minSize={20} className="flex flex-col min-h-0 border-t border-slate-200 bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {slides.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center rounded border border-dashed border-slate-200 text-center text-xs text-slate-400">
                <Grid2X2 size={24} className="mb-1.5 opacity-40" />
                Select a rundown item or library asset to edit slides.
              </div>
            )}
            {slides.length > 0 && slideViewMode === 'grid' && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
                {slides.map((slide, index) => {
                  const active = selectedSlideId === slide.id;
                  const text = getSlideText(slide);
                  const [firstLine, ...rest] = text.split('\n').filter(Boolean);
                  return (
                    <div
                      key={slide.id || index}
                      role="button"
                      tabIndex={0}
                      onDragEnter={(event) => handleSongMediaDragEnter(event, slide.id)}
                      onDragOver={handleSongMediaDragOver}
                      onDragLeave={(event) => handleSongMediaDragLeave(event, slide.id)}
                      onDrop={(event) => void handleSongMediaDrop(event, slide.id)}
                      onClick={() => handleSlideClick(slide)}
                      onDoubleClick={() => handleSlideDoubleClick(slide)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') handleSlideClick(slide);
                      }}
                      className={`group overflow-hidden rounded border text-left transition hover:-translate-y-0.5 active:scale-[0.99] ${
                        mediaDropTarget === slide.id
                          ? 'border-indigo-500 bg-indigo-50 shadow-[0_14px_28px_rgba(79,70,229,0.16)]'
                          :
                        active
                          ? 'border-indigo-500 bg-indigo-50/30 shadow-[0_14px_28px_rgba(79,70,229,0.12)]'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative aspect-video overflow-hidden bg-slate-900">
                        <LiveOutputSurface currentSlide={slide as any} isBlack={false} isClear={false} mode="preview" showPreviewBadge={false} />
                        {mediaDropTarget === slide.id && (
                          <span className="pointer-events-none absolute inset-2 grid place-items-center rounded-md border border-dashed border-indigo-300 bg-slate-950/60 px-3 text-center text-[10px] font-extrabold uppercase tracking-[0.08em] text-white backdrop-blur-sm">
                            Drop to apply to this slide
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: '24px minmax(0, 1fr)' }}>
                        <span className="font-mono text-sm text-slate-500">{index + 1}</span>
                        <span className="min-w-0">
                          <SlideLabelBadge slide={slide} fallback={getSlideLabel(slide, index)} className="mb-1 px-2 py-0.5 text-[9px]" />
                          <span className="block truncate text-sm font-semibold text-slate-950">{firstLine || '(empty)'}</span>
                          <span className="mt-1 block truncate text-xs text-slate-600">{rest.join(' ')}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {slides.length > 0 && slideViewMode === 'text' && (
              <div className="space-y-1">
                {slides.map((slide, index) => {
                  const active = selectedSlideId === slide.id;
                  const text = getSlideText(slide);
                  return (
                    <div
                      key={slide.id || index}
                      role="button"
                      tabIndex={0}
                      onDragEnter={(event) => handleSongMediaDragEnter(event, slide.id)}
                      onDragOver={handleSongMediaDragOver}
                      onDragLeave={(event) => handleSongMediaDragLeave(event, slide.id)}
                      onDrop={(event) => void handleSongMediaDrop(event, slide.id)}
                      onClick={() => handleSlideClick(slide)}
                      onDoubleClick={() => handleSlideDoubleClick(slide)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') handleSlideClick(slide);
                      }}
                      className={`flex items-start gap-2.5 rounded border px-2.5 py-1.5 text-left transition active:scale-[0.995] ${
                        mediaDropTarget === slide.id
                          ? 'border-indigo-500 bg-indigo-50'
                          :
                        active
                          ? 'border-indigo-500 bg-indigo-50/30'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-mono text-xs font-semibold text-slate-400 w-5 shrink-0 mt-0.5">{index + 1}</span>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center">
                          <SlideLabelBadge slide={slide} fallback={getSlideLabel(slide, index)} className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider scale-[0.9] origin-left" />
                        </div>
                        <div className="text-[12px] font-medium text-slate-800 whitespace-pre-line leading-tight">
                          {text || '(empty)'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>
      </Group>
    </main>
  );
}

function PreviewPanel({ 
  liveSlides,
  liveItem,
  libraryLiveSong,
  libraryLiveMedia
}: { 
  liveSlides: any[];
  liveItem: any;
  libraryLiveSong: SongWithSlides | null;
  libraryLiveMedia: Media | null;
}) {
  const {
    currentSlide,
    previewSlide,
    isBlack,
    isClear,
    isLogo,
    pointer,
    annotations,
    transitionMode,
    liveCapture,
    mediaPlayback,
    controlLiveMediaPlayback,
    goLive,
    setBlack,
    setClear,
    setLogo,
  } = usePresentationStore();
  const logoOutput = useSettingsStore((state) => state.logoOutput);

  const { refreshPresetDrivenSongs, setLibraryPreviewMode } = useScheduleStore();
  const toast = useToast();

  const previewDisplaySlide = previewSlide || currentSlide || null;

  const liveVideoLayer = findPrimaryVideoLayer(currentSlide as any);
  const livePlaybackSettings = liveVideoLayer?.playbackSettings || {};
  const livePlaybackMediaId = getVideoPlaybackId(liveVideoLayer);

  const activeLiveVideoPlayback = livePlaybackMediaId
    ? (mediaPlayback?.mediaId === livePlaybackMediaId ? mediaPlayback : null)
    : null;

  const liveVideoVolume = activeLiveVideoPlayback?.volume ?? (typeof livePlaybackSettings.volume === 'number' ? livePlaybackSettings.volume : 100);
  const liveVideoStatus = activeLiveVideoPlayback?.status || 'paused';
  const liveVideoBehavior = activeLiveVideoPlayback?.behavior || (['loop', 'stop', 'hold'].includes(String(livePlaybackSettings.behavior)) ? livePlaybackSettings.behavior : 'loop');
  const [lastLiveVideoVolume, setLastLiveVideoVolume] = useState(100);
  const [displayedLiveVideoTime, setDisplayedLiveVideoTime] = useState(Number(livePlaybackSettings.startTime) || 0);
  const [probedLiveVideoDuration, setProbedLiveVideoDuration] = useState(0);
  const [isLiveVideoScrubbing, setIsLiveVideoScrubbing] = useState(false);
  const [showLiveVideoVolume, setShowLiveVideoVolume] = useState(false);
  const liveVideoVolumeRef = useRef<HTMLDivElement | null>(null);
  const liveVideoStartTime = Number(livePlaybackSettings.startTime) || 0;
  const liveVideoEndTime = Number(livePlaybackSettings.endTime) || 0;
  const rawLiveDuration = Math.max(
    liveVideoEndTime ||
      Number(liveVideoLayer?.style.duration) ||
      Number(livePlaybackSettings.duration) ||
      probedLiveVideoDuration ||
      (libraryLiveMedia?.duration || 0),
    liveVideoStartTime
  );
  const isLiveYouTubeVideo = liveVideoLayer?.style?.mediaType === 'youtube' || /(youtube\.com|youtu\.be)/i.test(liveVideoLayer?.source || '');
  const liveVideoDuration = rawLiveDuration > 0 ? rawLiveDuration : (isLiveYouTubeVideo ? 300 : 0);
  const liveVideoSliderMax = Math.max(liveVideoDuration || 300, liveVideoStartTime + 1);
  const liveVideoSpeed = activeLiveVideoPlayback?.playbackRate || Number(livePlaybackSettings.speed) || 1;
  const [showLiveVideoSpeed, setShowLiveVideoSpeed] = useState(false);
  const liveVideoSpeedRef = useRef<HTMLDivElement | null>(null);

  const updateLiveVideoSpeed = (speedRate: number) => {
    updateLiveVideoPlaybackState({ playbackRate: speedRate });
    setShowLiveVideoSpeed(false);
  };

  const defaultSlideViewMode = useGeneralSettingsStore((state) => state.defaultSlideViewMode);
  const [liveSlideViewMode, setLiveSlideViewMode] = useState<'grid' | 'text'>(defaultSlideViewMode);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [isOutputBusy, setIsOutputBusy] = useState(false);

  useEffect(() => setLiveSlideViewMode(defaultSlideViewMode), [defaultSlideViewMode]);

  useEffect(() => {
    if (!window.api?.window) return;

    const refreshOutputState = () => {
      void window.api.window.getOutputState()
        .then((state) => setIsOutputOpen(state.isOpen))
        .catch(() => setIsOutputOpen(false));
    };
    const handleOutputStateChanged = (event: Event) => {
      const state = (event as CustomEvent<{ isOpen?: boolean }>).detail;
      if (typeof state?.isOpen === 'boolean') setIsOutputOpen(state.isOpen);
      else refreshOutputState();
    };

    refreshOutputState();
    window.addEventListener('focus', refreshOutputState);
    window.addEventListener('rumedia:output-state-changed', handleOutputStateChanged);
    return () => {
      window.removeEventListener('focus', refreshOutputState);
      window.removeEventListener('rumedia:output-state-changed', handleOutputStateChanged);
    };
  }, []);

  const applyPresetToLiveSong = async (payload: SongPresetDragPayload) => {
    const songId = liveItem?.itemType === 'song'
      ? liveItem.songId || liveItem.songData?.id
      : libraryLiveSong?.id;
    if (!songId) {
      toast.warning('Select a song before applying a song preset.');
      return;
    }

    try {
      await ipcSongService.update(songId, { defaultTemplateId: payload.id });
      await refreshPresetDrivenSongs();
      toast.success(`Preset "${payload.name || 'Song preset'}" applied to the selected song.`);
    } catch (error) {
      console.error('[PreviewPanel] Failed to apply song preset:', error);
      toast.error('Failed to apply preset to song.');
    }
  };

  useEffect(() => {
    setDisplayedLiveVideoTime(activeLiveVideoPlayback?.currentTime ?? liveVideoStartTime);
    setProbedLiveVideoDuration(0);
    setIsLiveVideoScrubbing(false);
    setShowLiveVideoVolume(false);
  }, [livePlaybackMediaId, liveVideoStartTime]);

  useEffect(() => {
    if (!activeLiveVideoPlayback || isLiveVideoScrubbing) return;

    const updateTime = () => {
      const elapsed = activeLiveVideoPlayback.status === 'playing'
        ? ((Date.now() - activeLiveVideoPlayback.updatedAt) / 1000) * (activeLiveVideoPlayback.playbackRate || 1)
        : 0;
      setDisplayedLiveVideoTime(normalizeVideoPlaybackTime(
        activeLiveVideoPlayback.currentTime + elapsed,
        liveVideoStartTime,
        liveVideoDuration,
        activeLiveVideoPlayback.behavior,
      ));
    };

    updateTime();
    if (activeLiveVideoPlayback.status !== 'playing') return;

    const timer = window.setInterval(updateTime, 250);
    return () => window.clearInterval(timer);
  }, [activeLiveVideoPlayback, isLiveVideoScrubbing, liveVideoDuration, liveVideoStartTime]);

  useEffect(() => {
    if (!liveVideoLayer?.source) return;
    if (liveVideoDuration > liveVideoStartTime + 1) return;

    let cancelled = false;
    const probe = document.createElement('video');
    probe.preload = 'metadata';
    probe.muted = true;
    probe.src = toRenderableMediaUrl(liveVideoLayer.source);
    probe.onloadedmetadata = () => {
      if (cancelled) return;
      const nextDuration = Number(probe.duration) || 0;
      if (nextDuration > 0) setProbedLiveVideoDuration(nextDuration);
    };
    probe.onerror = () => {
      if (!cancelled) setProbedLiveVideoDuration(0);
    };

    return () => {
      cancelled = true;
      probe.removeAttribute('src');
      probe.load();
    };
  }, [liveVideoLayer?.source, liveVideoDuration, liveVideoStartTime]);

  useEffect(() => {
    if (!showLiveVideoVolume) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (liveVideoVolumeRef.current && target && !liveVideoVolumeRef.current.contains(target)) {
        setShowLiveVideoVolume(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showLiveVideoVolume]);

  const handleGoLive = async () => {
    if (isOutputBusy) return;
    setIsOutputBusy(true);

    try {
      if (window.api?.window) {
        const currentOutputState = await window.api.window.getOutputState();
        if (currentOutputState.isOpen) {
          setBlack(true);
          if (activeLiveVideoPlayback && livePlaybackMediaId) {
            controlLiveMediaPlayback({ status: 'paused' });
          }
          await window.api.window.closeOutput();
          const closedState = await window.api.window.getOutputState();
          setIsOutputOpen(false);
          setLibraryPreviewMode('preview');
          window.dispatchEvent(new CustomEvent('rumedia:output-state-changed', { detail: closedState }));
          return;
        }
      }

      if (!previewDisplaySlide) return;
      setBlack(false);
      await goLive(previewDisplaySlide as any);
      setLibraryPreviewMode('liveControl');
      setIsOutputOpen(true);
      window.dispatchEvent(new CustomEvent('rumedia:focus-live-preview'));
    } finally {
      setIsOutputBusy(false);
    }
  };

  const updateLiveVideoPlaybackState = (updates: Partial<MediaPlaybackState>) => {
    if (!livePlaybackMediaId) return;

    controlLiveMediaPlayback({
      mediaId: livePlaybackMediaId,
      status: activeLiveVideoPlayback?.status || 'paused',
      currentTime: displayedLiveVideoTime,
      volume: liveVideoVolume,
      playbackRate: activeLiveVideoPlayback?.playbackRate || Number(livePlaybackSettings.speed) || 1,
      behavior: (updates.behavior ?? liveVideoBehavior) as any,
      ...updates,
    });
  };

  const updateLiveVideoVolume = (nextVolume: number) => {
    const boundedVolume = Math.max(0, Math.min(100, nextVolume));
    if (boundedVolume > 0) setLastLiveVideoVolume(boundedVolume);
    updateLiveVideoPlaybackState({ volume: boundedVolume });
  };

  const toggleLiveVideoMute = () => {
    if (liveVideoVolume > 0) {
      updateLiveVideoVolume(0);
      return;
    }
    updateLiveVideoVolume(lastLiveVideoVolume || 100);
  };

  const updateLiveVideoPlayback = (status: 'paused' | 'playing' | 'stopped') => {
    const nextTime = status === 'stopped' ? liveVideoStartTime : displayedLiveVideoTime;
    updateLiveVideoPlaybackState({ status, currentTime: nextTime });
    setDisplayedLiveVideoTime(nextTime);
  };

  const toggleLiveVideoPlayback = () => {
    updateLiveVideoPlayback(liveVideoStatus === 'playing' ? 'paused' : 'playing');
  };

  const toggleLiveVideoBehavior = () => {
    updateLiveVideoPlaybackState({ behavior: liveVideoBehavior === 'loop' ? 'stop' : 'loop' });
  };

  const seekLiveVideo = (nextTime: number) => {
    const boundedTime = Math.max(liveVideoStartTime, Math.min(liveVideoSliderMax, nextTime));
    setDisplayedLiveVideoTime(boundedTime);
    updateLiveVideoPlaybackState({ currentTime: boundedTime });
  };

  const liveTitle = liveItem
    ? getItemTitle(liveItem)
    : libraryLiveSong?.title || libraryLiveMedia?.filename || 'No active item';

  return (
    <section className="flex h-full min-h-0 flex-col bg-white">
      <Group orientation="vertical" className="h-full w-full">
        <Panel defaultSize={65} minSize={40} className="flex flex-col min-h-0">
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
            <div className="flex h-full items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-black text-slate-950 uppercase tracking-widest">LIVE CONTROL</span>
            </div>
            <div className="flex items-center gap-2">
              <QuickAlertPopover />
              <button
                type="button"
                aria-label="Clear text"
                title="Clear text"
                onClick={() => setClear(!isClear)}
                className={`grid h-10 w-10 place-items-center rounded-lg border transition active:scale-[0.98] ${
                  isClear
                    ? 'border-amber-300 bg-amber-100 text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.18)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <FileText size={17} />
              </button>
              <button
                type="button"
                aria-label="Logo output"
                title={logoOutput.mediaId ? 'Show configured Logo on second screen' : 'Configure Logo in Settings first'}
                onClick={() => setLogo(!isLogo)}
                disabled={!logoOutput.mediaId}
                className={`grid h-10 w-10 place-items-center rounded-lg border transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 ${
                  isLogo
                    ? 'border-amber-400 bg-amber-100 text-amber-900 shadow-[0_10px_24px_rgba(245,158,11,0.18)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800'
                }`}
              >
                <ImageIcon size={17} />
              </button>
              <button
                type="button"
                aria-label="Black screen"
                title="Black screen"
                onClick={() => setBlack(!isBlack)}
                className={`grid h-10 w-10 place-items-center rounded-lg border transition active:scale-[0.98] ${
                  isBlack
                    ? 'border-slate-950 bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.28)]'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                <MonitorOff size={17} />
              </button>
              <button
                type="button"
                aria-label={isOutputOpen ? 'Stop live output' : 'Go live'}
                title={isOutputOpen ? 'Close second screen' : 'Open second screen and show the selected slide'}
                onClick={() => void handleGoLive()}
                disabled={isOutputBusy || (!previewDisplaySlide && !isOutputOpen)}
                className={`flex h-10 min-w-[116px] items-center justify-center gap-2 rounded-lg border px-4 text-sm font-extrabold shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                  isOutputOpen
                    ? 'border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100'
                    : 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {isOutputOpen ? <Square size={14} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
                {isOutputBusy ? 'WAIT...' : isOutputOpen ? 'ON AIR' : 'OFF'}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 bg-slate-50/50 shrink-0">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">Live Slides</p>
              <h2 className="text-xs font-bold text-slate-950 truncate max-w-[240px]">{liveTitle}</h2>
            </div>
            <div className="flex h-6 items-center rounded border border-slate-200 bg-white p-0.5">
              {[
                { id: 'grid' as const, label: 'Grid', icon: Grid2X2 },
                { id: 'text' as const, label: 'List', icon: AlignJustify },
              ].map((item) => {
                const Icon = item.icon;
                const active = liveSlideViewMode === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.label} view`}
                    onClick={() => setLiveSlideViewMode(item.id)}
                    className={`flex h-5 items-center gap-1 rounded px-1.5 text-[9px] font-bold transition active:scale-[0.98] ${
                      active ? 'bg-indigo-50 text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-950'
                    }`}
                  >
                    <Icon size={10} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4 bg-slate-50/20">
            {liveSlides.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-xs text-slate-400">
                <Grid2X2 size={24} className="mb-1.5 opacity-40" />
                No live schedule item active. Double click a rundown item to go live.
              </div>
            )}
            {liveSlides.length > 0 && liveSlideViewMode === 'grid' && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
                {liveSlides.map((slide, index) => {
                  const active = currentSlide?.id === slide.id;
                  const text = getSlideText(slide);
                  const [firstLine, ...rest] = text.split('\n').filter(Boolean);
                  return (
                    <div
                      key={slide.id || index}
                      role="button"
                      tabIndex={0}
                      onClick={() => goLive(slide as any)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') goLive(slide as any);
                      }}
                      className={`group overflow-hidden rounded border text-left transition hover:-translate-y-0.5 active:scale-[0.99] ${
                        active
                          ? 'border-emerald-500 bg-emerald-50/40 shadow-[0_14px_28px_rgba(16,185,129,0.12)]'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="relative aspect-video overflow-hidden bg-slate-900">
                        <LiveOutputSurface currentSlide={slide as any} isBlack={false} isClear={false} mode="preview" showPreviewBadge={false} />
                        {active && (
                          <span className="absolute left-2 top-2 rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-emerald-950">
                            Live
                          </span>
                        )}
                      </div>
                      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: '24px minmax(0, 1fr)' }}>
                        <span className="font-mono text-sm text-slate-500">{index + 1}</span>
                        <span className="min-w-0">
                          <SlideLabelBadge slide={slide} fallback={getSlideLabel(slide, index)} className="mb-1 px-2 py-0.5 text-[10px]" />
                          <span className="block truncate text-sm font-semibold text-slate-950">{firstLine || '(empty)'}</span>
                          <span className="mt-1 block truncate text-xs text-slate-600">{rest.join(' ')}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {liveSlides.length > 0 && liveSlideViewMode === 'text' && (
              <div className="space-y-1">
                {liveSlides.map((slide, index) => {
                  const active = currentSlide?.id === slide.id;
                  const text = getSlideText(slide);
                  return (
                    <div
                      key={slide.id || index}
                      role="button"
                      tabIndex={0}
                      onClick={() => goLive(slide as any)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') goLive(slide as any);
                      }}
                      className={`flex items-start gap-2.5 rounded border px-2.5 py-1.5 text-left transition active:scale-[0.995] ${
                        active
                          ? 'border-emerald-500 bg-emerald-50/40'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-mono text-xs font-semibold text-slate-400 w-5 shrink-0 mt-0.5">{index + 1}</span>
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <div className="flex items-center">
                          <SlideLabelBadge slide={slide} fallback={getSlideLabel(slide, index)} className="px-1.5 py-0.5 text-[8px] uppercase tracking-wider scale-[0.9] origin-left" />
                        </div>
                        <div className="text-[12px] font-medium text-slate-800 whitespace-pre-line leading-tight">
                          {text || '(empty)'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        <ResizeHandle direction="vertical" />

        <Panel defaultSize={35} minSize={20} className="flex flex-col min-h-0 border-t border-slate-200">
          <div className="min-h-0 flex-1 overflow-hidden p-4 pb-3">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                if (e.dataTransfer.types.includes('application/json')) {
                  e.dataTransfer.dropEffect = 'copy';
                }
              }}
              onDragEnter={() => setIsDragOver(true)}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                setIsDragOver(false);
                event.preventDefault();
                const raw = event.dataTransfer.getData('application/json');
                if (raw) {
                  try {
                    const data = JSON.parse(raw);
                    if (data.type === 'song-preset') {
                      void applyPresetToLiveSong(data as SongPresetDragPayload);
                    }
                  } catch (e) {
                    console.error('[PreviewPanel] Failed to parse drop data:', e);
                  }
                }
              }}
              className={`relative h-full min-h-0 overflow-hidden rounded-xl bg-slate-950 shadow-lg transition-all duration-200 ${
                isDragOver ? 'ring-4 ring-emerald-500/50 ring-offset-2 ring-offset-slate-950 scale-[0.99]' : ''
              }`}
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
                  mediaPlayback={mediaPlayback}
                  mode="output"
                />
              )}
              <div className="absolute left-5 top-4 rounded-lg bg-slate-950/60 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-white backdrop-blur">
                <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {isLogo ? 'Logo Output' : 'Live Stage Output'}
              </div>

              {isDragOver && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-emerald-950/80 backdrop-blur-[2px] border-2 border-dashed border-emerald-500 rounded-xl pointer-events-none">
                  <div className="flex flex-col items-center gap-2 rounded-lg bg-slate-950/90 p-4 border border-emerald-500/30 shadow-2xl">
                    <Sparkles className="h-6 w-6 text-emerald-400 animate-bounce" />
                    <span className="text-xs font-black text-white tracking-widest uppercase">
                      Drop to Apply Preset Layout
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {liveVideoLayer && (
            <div className="mx-4 mb-3 flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <IconButton
                label="Rewind -10s"
                onClick={() => seekLiveVideo(Math.max(liveVideoStartTime, displayedLiveVideoTime - 10))}
                className="h-9 w-9 border-transparent bg-slate-100 text-slate-700"
              >
                <RotateCcw size={15} />
              </IconButton>
              <IconButton
                label={liveVideoStatus === 'playing' ? 'Pause live video' : 'Play live video'}
                onClick={toggleLiveVideoPlayback}
                className="h-9 w-9 border-transparent bg-emerald-50 text-emerald-700"
              >
                {liveVideoStatus === 'playing' ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </IconButton>
              <IconButton
                label="Forward +10s"
                onClick={() => seekLiveVideo(Math.min(liveVideoSliderMax, displayedLiveVideoTime + 10))}
                className="h-9 w-9 border-transparent bg-slate-100 text-slate-700"
              >
                <RotateCw size={15} />
              </IconButton>
              <IconButton
                label="Stop live video"
                onClick={() => updateLiveVideoPlayback('stopped')}
                className="h-9 w-9 border-transparent bg-slate-100 text-slate-700"
              >
                <Square size={15} fill="currentColor" />
              </IconButton>
              <IconButton
                label={liveVideoBehavior === 'loop' ? 'Loop live video' : 'Play once'}
                onClick={toggleLiveVideoBehavior}
                className={`h-9 w-9 border-transparent ${liveVideoBehavior === 'loop' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}
              >
                {liveVideoBehavior === 'loop' ? <Repeat size={16} /> : <Repeat1 size={16} />}
              </IconButton>
              <div className="mx-1 h-6 w-px bg-slate-200" />
              <IconButton
                label={liveVideoVolume === 0 ? 'Unmute live video' : 'Mute live video'}
                onClick={() => setShowLiveVideoVolume((value) => !value)}
                className="h-9 w-9 border-transparent bg-slate-100 text-slate-700"
              >
                {liveVideoVolume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </IconButton>
              <div ref={liveVideoVolumeRef} className="relative">
                {showLiveVideoVolume && (
                  <div className="absolute bottom-11 left-1/2 z-20 w-44 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[0.1em] text-slate-400">
                      <span>Volume</span>
                      <span className="font-mono">{liveVideoVolume}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={liveVideoVolume === 0 ? 'Unmute video' : 'Mute video'}
                        title={liveVideoVolume === 0 ? 'Unmute video' : 'Mute video'}
                        onClick={toggleLiveVideoMute}
                        className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                      >
                        {liveVideoVolume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        step={1}
                        value={liveVideoVolume}
                        onInput={(event) => updateLiveVideoVolume(parseInt((event.target as HTMLInputElement).value, 10))}
                        className="h-2 min-w-0 flex-1 accent-emerald-500"
                        aria-label="Video volume"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div ref={liveVideoSpeedRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowLiveVideoSpeed((prev) => !prev);
                    setShowLiveVideoVolume(false);
                  }}
                  title="Kecepatan Putar"
                  className="flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-mono font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  <Gauge size={13} />
                  <span>{liveVideoSpeed}x</span>
                </button>
                {showLiveVideoSpeed && (
                  <div className="absolute bottom-11 left-1/2 z-20 w-36 -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    <div className="mb-1 text-[9px] font-extrabold uppercase tracking-[0.1em] text-slate-400 px-1">
                      Speed / Kecepatan
                    </div>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => updateLiveVideoSpeed(rate)}
                        className={`w-full text-left px-2 py-1 rounded text-xs font-mono transition ${
                          liveVideoSpeed === rate ? 'bg-emerald-600 text-white font-bold' : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {rate}x {rate === 1.0 ? '(Normal)' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                type="range"
                min={liveVideoStartTime}
                max={liveVideoSliderMax}
                step={0.05}
                value={Math.min(displayedLiveVideoTime, liveVideoSliderMax)}
                onPointerDown={() => setIsLiveVideoScrubbing(true)}
                onPointerUp={(event) => {
                  setIsLiveVideoScrubbing(false);
                  seekLiveVideo(parseFloat((event.target as HTMLInputElement).value));
                }}
                onTouchEnd={(event) => {
                  setIsLiveVideoScrubbing(false);
                  seekLiveVideo(parseFloat((event.target as HTMLInputElement).value));
                }}
                onInput={(event) => seekLiveVideo(parseFloat((event.target as HTMLInputElement).value))}
                onChange={(event) => seekLiveVideo(parseFloat((event.target as HTMLInputElement).value))}
                className="h-2 min-w-28 flex-1 accent-emerald-500"
                aria-label="Video timeline"
              />
              <span className="w-24 text-right font-mono text-[11px] font-bold text-slate-500">
                {formatSeconds(displayedLiveVideoTime)} / {liveVideoDuration > 0 ? formatSeconds(liveVideoDuration) : formatSeconds(300)}
              </span>
            </div>
          )}
        </Panel>
      </Group>
    </section>
  );
}


function ControllerLibraryPanel({
  onOpenSongEditor,
  refreshToken,
}: {
  onOpenSongEditor: (song: SongWithSlides | null) => void;
  refreshToken: number;
}) {
  const [tab, setTab] = useState<LibraryTab>('songs');
  const [libraryContextMenu, setLibraryContextMenu] = useState<{ x: number; y: number; songId: string } | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [songTotal, setSongTotal] = useState(0);
  const [songAvailableTags, setSongAvailableTags] = useState<string[]>([]);
  const [isSongPageLoading, setIsSongPageLoading] = useState(false);
  const songPageRequestRef = useRef(0);
  const songPageAppendLoadingRef = useRef(false);
  const [mediaItems, setMediaItems] = useState<Media[]>([]);
  const [mediaTotal, setMediaTotal] = useState(0);
  const [mediaAvailableTags, setMediaAvailableTags] = useState<string[]>([]);
  const [isMediaPageLoading, setIsMediaPageLoading] = useState(false);
  const mediaPageRequestRef = useRef(0);
  const mediaPageAppendLoadingRef = useRef(false);
  const [presets, setPresets] = useState<Template[]>([]);
  const [presetTotal, setPresetTotal] = useState(0);
  const [presetCategories, setPresetCategories] = useState<string[]>([]);
  const [isPresetPageLoading, setIsPresetPageLoading] = useState(false);
  const presetPageRequestRef = useRef(0);
  const presetPageAppendLoadingRef = useRef(false);
  const screenPreviewGenerationRef = useRef(0);
  const [query, setQuery] = useState('');
  const [searchBy, setSearchBy] = useState<'all' | 'title' | 'lyrics' | 'author'>('all');
  const [viewModes, setViewModes] = useState<Record<LibraryTab, LibraryViewMode>>(loadLibraryViewModes);
  const viewMode: LibraryViewMode = tab === 'songs' ? 'list' : viewModes[tab];
  const setViewMode = (nextMode: LibraryViewMode) => {
    if (tab === 'songs') return;
    setViewModes((current) => current[tab] === nextMode ? current : { ...current, [tab]: nextMode });
  };
  const [visualThumbnailWidth, setVisualThumbnailWidth] = useState(() => {
    const saved = Number(localStorage.getItem('rumedia:library-thumbnail-width'));
    return Number.isFinite(saved) && saved >= 56 && saved <= 160 ? saved : 76;
  });
  const [gridThumbnailWidth, setGridThumbnailWidth] = useState(() => {
    const saved = Number(localStorage.getItem('rumedia:library-grid-thumbnail-width'));
    return Number.isFinite(saved) && saved >= 140 && saved <= 320 ? saved : 180;
  });
  const [expandedLyricSongIds, setExpandedLyricSongIds] = useState<Set<string>>(() => new Set());
  const [sortColumn, setSortColumn] = useState<'title' | 'detail' | 'copyright'>('title');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sidebarFilter, setSidebarFilter] = useState<string>('all');
  const [playlistsList, setPlaylistsList] = useState<{ id: string; name: string; type: LibraryTab; itemIds: string[] }[]>([
    { id: 'pl-song-1', name: 'Worship Sunday', type: 'songs', itemIds: [] },
    { id: 'pl-song-2', name: 'Youth Gathering', type: 'songs', itemIds: [] },
    { id: 'pl-media-1', name: 'Sermon Bumpers', type: 'media', itemIds: [] },
    { id: 'pl-media-2', name: 'Background Loops', type: 'media', itemIds: [] }
  ]);
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false);
  const [isAddOnlineOpen, setIsAddOnlineOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(null);
  const [dragOverSongId, setDragOverSongId] = useState<string | null>(null);
  const resetPlaylistDragState = () => {
    setDragOverPlaylistId(null);
    setDragOverSongId(null);
  };
  const favoritesOnly = sidebarFilter === 'favorites';
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [isTagMenuOpen, setIsTagMenuOpen] = useState(false);
  const [presetFamilyFilter, setPresetFamilyFilter] = useState<PresetFamilyFilter>('all');
  const [contentThemeTypeFilter, setContentThemeTypeFilter] = useState<'all' | ContentThemeType>('all');
  const [screenLayoutPurposeFilter, setScreenLayoutPurposeFilter] = useState<'all' | ScreenLayoutPreset['purpose']>('all');
  const [editingPreset, setEditingPreset] = useState<Template | null>(null);
  const [editingScreenLayout, setEditingScreenLayout] = useState<ScreenLayoutPreset | null>(null);
  const [selectedPresetPreviewKey, setSelectedPresetPreviewKey] = useState<string | null>(null);
  const [isCreatingPreset, setIsCreatingPreset] = useState(false);
  const { setPreviewSlide, goLive } = usePresentationStore();
  const toast = useToast();
  const {
    libraryPreviewSong,
    libraryPreviewMedia,
    setLibraryPreviewSong,
    setLibraryPreviewMedia,
    addItem,
    setSelectedItem,
    refreshPresetDrivenSongs,
  } = useScheduleStore();
  const primaryRole = useSettingsStore((state) => state.outputs.find((output) => output.enabled && output.isPrimary)?.role || 'audience');
  const screenLayouts = useSettingsStore((state) => state.outputPresets);

  useEffect(() => {
    localStorage.setItem(LIBRARY_VIEW_MODES_STORAGE_KEY, JSON.stringify(viewModes));
  }, [viewModes]);

  useEffect(() => {
    localStorage.setItem('rumedia:library-thumbnail-width', String(visualThumbnailWidth));
  }, [visualThumbnailWidth]);

  useEffect(() => {
    localStorage.setItem('rumedia:library-grid-thumbnail-width', String(gridThumbnailWidth));
  }, [gridThumbnailWidth]);

  // Bible states
  const {
    activeVersion: activeBibleVersion,
    versions: bibleVersions,
    switchVersion: switchBibleVersion,
    deleteVersion: deleteBibleVersion,
  } = useBibleManager();
  const { isLoading: _isBibleLoading, books: bibleBooks } = useBible();
  const [selectedBibleBookCode, setSelectedBibleBookCode] = useState('');
  const [selectedBibleChapter, setSelectedBibleChapter] = useState(1);
  const [selectedBibleVerseStart, setSelectedBibleVerseStart] = useState(1);
  const [selectedBibleVerseEnd, setSelectedBibleVerseEnd] = useState(1);
  const [isBibleSettingsOpen, setIsBibleSettingsOpen] = useState(false);
  const [scriptureThemes, setScriptureThemes] = useState<Template[]>([]);
  const defaultBibleContentThemeId = useSettingsStore((state) => state.defaultBibleContentThemeId);
  const defaultBibleContentThemeName = useSettingsStore((state) => state.defaultBibleContentThemeName);
  const defaultBibleContentThemeLayersData = useSettingsStore((state) => state.defaultBibleContentThemeLayersData);
  const [selectedBibleContentThemeId, setSelectedBibleContentThemeId] = useState(defaultBibleContentThemeId || '');
  const bibleTemplate = useSettingsStore((state) => state.bibleTemplate);
  const setOutputSettings = useSettingsStore((state) => state.setSettings);

  useEffect(() => {
    const generation = ++screenPreviewGenerationRef.current;
    const staleLayouts = screenLayouts.filter((layout) => (
      !layout.thumbnail || layout.thumbnailSignature !== getScreenLayoutThumbnailSignature(layout)
    ));
    if (!staleLayouts.length) return;

    void (async () => {
      const updates = new Map<string, ScreenLayoutPreset>();
      for (const layout of staleLayouts) {
        if (generation !== screenPreviewGenerationRef.current) return;
        try {
          const dataUrl = await renderScreenLayoutThumbnail(layout);
          const thumbnail = await ipcPresetPreviewService.save(`screen-${layout.id}`, dataUrl, layout.thumbnail);
          updates.set(layout.id, {
            ...layout,
            thumbnail,
            thumbnailSignature: getScreenLayoutThumbnailSignature(layout),
          });
        } catch (previewError) {
          console.warn(`[Preset Preview] Unable to generate Screen Layout thumbnail for ${layout.name}.`, previewError);
        }
      }
      if (!updates.size || generation !== screenPreviewGenerationRef.current) return;

      const currentSettings = useSettingsStore.getState();
      const outputPresets = currentSettings.outputPresets.map((layout) => updates.get(layout.id) || layout);
      const nextSettings = await ipcOutputSettingsService.setSettings({ outputPresets });
      if (generation === screenPreviewGenerationRef.current) setOutputSettings(nextSettings);
    })();

    return () => {
      if (generation === screenPreviewGenerationRef.current) screenPreviewGenerationRef.current += 1;
    };
  }, [screenLayouts, setOutputSettings]);
  const [bibleQuickRefInput, setBibleQuickRefInput] = useState('');

  useEffect(() => {
    let active = true;
    const loadScriptureThemes = async () => {
      await ipcTemplateService.seed();
      const page = await ipcTemplateService.getLibraryPage({ contentType: 'scripture', limit: 250 });
      if (active) setScriptureThemes(page.items);
    };
    const refreshThemes = () => void loadScriptureThemes().catch(() => undefined);
    refreshThemes();
    window.addEventListener('rumedia:templates-changed', refreshThemes);
    return () => {
      active = false;
      window.removeEventListener('rumedia:templates-changed', refreshThemes);
    };
  }, []);

  useEffect(() => {
    setSelectedBibleContentThemeId(defaultBibleContentThemeId || '');
  }, [defaultBibleContentThemeId]);

  const selectedBibleThemeFields = useMemo(() => {
    const theme = scriptureThemes.find((item) => item.id === selectedBibleContentThemeId) || null;
    const usesStoredDefault = !theme && selectedBibleContentThemeId === defaultBibleContentThemeId;
    return {
      contentThemeId: theme?.id || (usesStoredDefault ? defaultBibleContentThemeId : null),
      contentThemeName: theme?.name || (usesStoredDefault ? defaultBibleContentThemeName : null),
      contentThemeLayersData: theme?.layersData || (usesStoredDefault ? defaultBibleContentThemeLayersData : null),
    };
  }, [defaultBibleContentThemeId, defaultBibleContentThemeLayersData, defaultBibleContentThemeName, scriptureThemes, selectedBibleContentThemeId]);

  useEffect(() => {
    if (bibleBooks.length > 0 && !selectedBibleBookCode) {
      setSelectedBibleBookCode(bibleBooks[0].code);
      setSelectedBibleChapter(1);
      setSelectedBibleVerseStart(1);
      setSelectedBibleVerseEnd(1);
    }
  }, [bibleBooks, selectedBibleBookCode]);

  const createBibleScheduleItemData = (startVerse = selectedBibleVerseStart, endVerse = selectedBibleVerseEnd) => {
    const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
    const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
    if (!book || !chapter) return null;

    const start = Math.min(startVerse, endVerse);
    const end = Math.max(startVerse, endVerse);
    const selectedVerses = chapter.verses.filter(v => v.verse >= start && v.verse <= end);
    if (selectedVerses.length === 0) return null;

    const payload = {
      reference: `${book.name} ${chapter.number}:${start}${start !== end ? `-${end}` : ""}`,
      text: selectedVerses.map(v => v.text).join("\n"),
      verseStart: start,
      verseEnd: end,
      versionCode: activeBibleVersion?.code || "DEFAULT",
      verses: selectedVerses.map(v => ({ verse: v.verse, text: v.text })),
      splitMode: bibleTemplate.maxVersesPerSlide ? "per-verse" : "auto",
      slideCount: null,
      ...selectedBibleThemeFields,
      style: bibleTemplate,
    };

    return {
      itemType: "bible" as const,
      bibleVersionId: activeBibleVersion?.id || null,
      bibleBook: selectedBibleBookCode,
      bibleChapter: selectedBibleChapter,
      bibleVerseStart: start,
      bibleVerseEnd: end,
      content: JSON.stringify(payload),
      duration: 3,
    };
  };

  const createBibleDragPayload = (startVerse = selectedBibleVerseStart, endVerse = selectedBibleVerseEnd) => {
    const itemData = createBibleScheduleItemData(startVerse, endVerse);
    if (!itemData) return null;
    const content = itemData.content ? JSON.parse(itemData.content) : {};
    return {
      type: "bible",
      title: content.reference || "Bible Reading",
      ...itemData,
    };
  };

  useEffect(() => {
    if (tab !== 'bible') return;
    const itemData = createBibleScheduleItemData();
    if (!itemData) return;
    const previewItem = {
      id: `bible-theme-preview-${selectedBibleBookCode}-${selectedBibleChapter}-${selectedBibleVerseStart}-${selectedBibleVerseEnd}`,
      ...itemData,
    };
    const firstSlide = buildBibleVirtualSlides(previewItem as any)[0];
    if (firstSlide) setPreviewSlide(firstSlide as any);
  }, [selectedBibleContentThemeId, selectedBibleThemeFields.contentThemeLayersData]);

  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const isLyricSearchMode = (tab === 'all' || tab === 'songs') && searchBy === 'lyrics' && normalizedQuery.length > 0;
  const showsLyricContext = (tab === 'all' || tab === 'songs')
    && (searchBy === 'lyrics' || searchBy === 'all')
    && normalizedQuery.length > 0;

  useEffect(() => {
    setExpandedLyricSongIds(new Set());
  }, [normalizedQuery, searchBy]);

  const loadSongPage = async (offset = 0, append = false) => {
    if (append && songPageAppendLoadingRef.current) return;
    if (append) songPageAppendLoadingRef.current = true;
    const requestId = ++songPageRequestRef.current;
    const selectedPlaylist = sidebarFilter.startsWith('playlist:')
      ? playlistsList.find((playlist) => playlist.id === sidebarFilter.split(':')[1])
      : null;
    setIsSongPageLoading(true);

    try {
      const page = await ipcSongService.getLibraryPage({
        offset,
        limit: LIBRARY_RENDER_BATCH_SIZE,
        query: deferredQuery.trim(),
        searchBy,
        favoritesOnly,
        tag: tagFilter,
        songIds: selectedPlaylist ? (selectedPlaylist.type === 'songs' ? selectedPlaylist.itemIds : []) : null,
        sortBy: sortColumn === 'detail' ? 'author' : sortColumn,
        sortDirection,
      });
      if (requestId !== songPageRequestRef.current) return;

      setSongTotal(page.total);
      setSongs((current) => {
        if (!append) return page.items;
        const merged = new Map(current.map((song) => [song.id, song]));
        page.items.forEach((song) => merged.set(song.id, song));
        return Array.from(merged.values());
      });
    } catch (error) {
      if (requestId === songPageRequestRef.current) {
        console.error('[ControllerLibraryPanel] Failed to load song page:', error);
        if (!append) {
          setSongs([]);
          setSongTotal(0);
        }
      }
    } finally {
      if (append) songPageAppendLoadingRef.current = false;
      if (requestId === songPageRequestRef.current) setIsSongPageLoading(false);
    }
  };

  const loadMediaPage = async (offset = 0, append = false) => {
    if (append && mediaPageAppendLoadingRef.current) return;
    if (append) mediaPageAppendLoadingRef.current = true;
    const requestId = ++mediaPageRequestRef.current;
    const selectedPlaylist = sidebarFilter.startsWith('playlist:')
      ? playlistsList.find((playlist) => playlist.id === sidebarFilter.split(':')[1])
      : null;
    const mediaTypes = sidebarFilter === 'video'
      ? ['video']
      : sidebarFilter === 'image'
        ? ['image']
        : sidebarFilter === 'audio'
          ? ['audio']
          : sidebarFilter === 'online'
            ? ['youtube']
            : tab === 'presentations'
              ? ['pdf']
              : tab === 'media'
                ? ['image', 'video', 'audio', 'youtube']
                : ['image', 'video', 'pdf', 'audio', 'youtube'];
    setIsMediaPageLoading(true);

    try {
      const page = await ipcMediaService.getLibraryPage({
        offset,
        limit: LIBRARY_RENDER_BATCH_SIZE,
        query: deferredQuery.trim(),
        mediaTypes,
        favoritesOnly,
        tag: tagFilter,
        mediaIds: selectedPlaylist ? (selectedPlaylist.type === 'media' ? selectedPlaylist.itemIds : []) : null,
        sortBy: sortColumn === 'detail' ? 'mediaType' : 'filename',
        sortDirection,
      });
      if (requestId !== mediaPageRequestRef.current) return;
      setMediaTotal(page.total);
      setMediaItems((current) => {
        if (!append) return page.items;
        const merged = new Map(current.map((media) => [media.id, media]));
        page.items.forEach((media) => merged.set(media.id, media));
        return Array.from(merged.values());
      });
    } catch (error) {
      if (requestId === mediaPageRequestRef.current) {
        console.error('[ControllerLibraryPanel] Failed to load media page:', error);
        if (!append) {
          setMediaItems([]);
          setMediaTotal(0);
        }
      }
    } finally {
      if (append) mediaPageAppendLoadingRef.current = false;
      if (requestId === mediaPageRequestRef.current) setIsMediaPageLoading(false);
    }
  };

  const backfillContentThemePreviews = async (items: Template[], requestId: number) => {
    for (const preset of items) {
      if (preset.previewUrl || requestId !== presetPageRequestRef.current) continue;
      try {
        const dataUrl = await renderContentThemeThumbnail(preset.layersData, preset.contentType || 'song');
        const previewUrl = await ipcPresetPreviewService.save(`content-${preset.id}`, dataUrl, null);
        await ipcTemplateService.updatePreview(preset.id, previewUrl);
        if (requestId === presetPageRequestRef.current) {
          setPresets((current) => current.map((item) => item.id === preset.id ? { ...item, previewUrl } : item));
        }
      } catch (previewError) {
        console.warn(`[Preset Preview] Unable to generate Content Theme thumbnail for ${preset.name}.`, previewError);
      }
    }
  };

  const loadPresetPage = async (offset = 0, append = false) => {
    if (append && presetPageAppendLoadingRef.current) return;
    if (append) presetPageAppendLoadingRef.current = true;
    const requestId = ++presetPageRequestRef.current;
    setIsPresetPageLoading(true);

    try {
      if (favoritesOnly || sidebarFilter.startsWith('playlist:')) {
        if (requestId === presetPageRequestRef.current) {
          setPresets([]);
          setPresetTotal(0);
        }
        return;
      }
      const page = await ipcTemplateService.getLibraryPage({
        offset,
        limit: LIBRARY_RENDER_BATCH_SIZE,
        query: deferredQuery.trim(),
        category: tagFilter,
        contentType: tab === 'preset' && contentThemeTypeFilter !== 'all' ? contentThemeTypeFilter : null,
        sortBy: sortColumn === 'detail' ? 'category' : 'name',
        sortDirection,
      });
      if (requestId !== presetPageRequestRef.current) return;
      setPresetTotal(page.total);
      setPresets((current) => {
        if (!append) return page.items;
        const merged = new Map(current.map((preset) => [preset.id, preset]));
        page.items.forEach((preset) => merged.set(preset.id, preset));
        return Array.from(merged.values());
      });
      void backfillContentThemePreviews(page.items, requestId);
    } catch (error) {
      if (requestId === presetPageRequestRef.current) {
        console.error('[ControllerLibraryPanel] Failed to load preset page:', error);
        if (!append) {
          setPresets([]);
          setPresetTotal(0);
        }
      }
    } finally {
      if (append) presetPageAppendLoadingRef.current = false;
      if (requestId === presetPageRequestRef.current) setIsPresetPageLoading(false);
    }
  };

  const loadLibrary = async () => {
    await ipcSongService.seed();
    await ipcTemplateService.seed();
    const [libraryTags, libraryMediaTags, libraryPresetCategories] = await Promise.all([
      ipcSongService.getLibraryTags(),
      ipcMediaService.getLibraryTags(),
      ipcTemplateService.getLibraryCategories(),
    ]);
    setSongAvailableTags(libraryTags);
    setMediaAvailableTags(libraryMediaTags);
    setPresetCategories(libraryPresetCategories);
    const pageRequests: Promise<void>[] = [];
    if (tab === 'all' || tab === 'songs') pageRequests.push(loadSongPage(0, false));
    if (tab === 'all' || tab === 'media' || tab === 'presentations') pageRequests.push(loadMediaPage(0, false));
    if (tab === 'all' || tab === 'preset') pageRequests.push(loadPresetPage(0, false));
    await Promise.all(pageRequests);
  };

  useEffect(() => {
    void loadLibrary();
  }, [refreshToken]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (tab === 'all' || tab === 'songs') void loadSongPage(0, false);
      if (tab === 'all' || tab === 'media' || tab === 'presentations') void loadMediaPage(0, false);
      if (tab === 'all' || tab === 'preset') void loadPresetPage(0, false);
    }, normalizedQuery ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [contentThemeTypeFilter, favoritesOnly, normalizedQuery, playlistsList, searchBy, sidebarFilter, sortColumn, sortDirection, tab, tagFilter]);

  useEffect(() => {
    const handleClose = () => setLibraryContextMenu(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const indexedSongs = useMemo(() => songs.map((song) => {
    const tags = safeJsonArray(song.tags).map(String);
    return {
      song,
      tags,
      isFavorite: tags.includes('favorite'),
      displayTag: tags.find((tag) => tag !== 'favorite'),
      searchText: `${song.title} ${song.author || ''} ${song.rawLyrics || ''}`.toLowerCase(),
    };
  }), [songs]);

  const indexedMedia = useMemo(() => mediaItems.map((media) => {
    const tags = safeJsonArray(media.tags).map(String);
    return {
      media,
      tags,
      isFavorite: tags.includes('favorite'),
      displayTag: tags.find((tag) => tag !== 'favorite'),
      searchText: media.filename.toLowerCase(),
    };
  }), [mediaItems]);

  const indexedPresets = useMemo(() => presets.map((preset) => ({
    preset,
    searchText: `${preset.name} ${preset.category || ''} ${preset.contentType || 'song'}`.toLowerCase(),
  })), [presets]);

  const indexedScreenLayouts = useMemo(() => screenLayouts.map((layout) => ({
    layout,
    searchText: `${layout.name} ${layout.purpose} ${layout.role} ${layout.layoutType}`.toLowerCase(),
  })), [screenLayouts]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>([...songAvailableTags, ...mediaAvailableTags, ...presetCategories]);
    return Array.from(tags).filter((tag) => tag !== 'favorite').sort((a, b) => a.localeCompare(b));
  }, [mediaAvailableTags, presetCategories, songAvailableTags]);

  const filteredSongs = useMemo(() => indexedSongs.filter((item) => {
    if (tab !== 'all' && tab !== 'songs') return false;
    if (favoritesOnly && !item.isFavorite) return false;
    if (tagFilter && !item.tags.includes(tagFilter)) return false;
    if (sidebarFilter.startsWith('playlist:')) {
      const plId = sidebarFilter.split(':')[1];
      const playlist = playlistsList.find(p => p.id === plId);
      return playlist ? playlist.itemIds.includes(item.song.id) : false;
    }
    if (normalizedQuery) {
      if (searchBy === 'title') {
        return item.song.title.toLowerCase().includes(normalizedQuery);
      } else if (searchBy === 'lyrics') {
        return (item.song.rawLyrics || '').toLowerCase().includes(normalizedQuery);
      } else if (searchBy === 'author') {
        return (item.song.author || '').toLowerCase().includes(normalizedQuery);
      } else {
        return item.searchText.includes(normalizedQuery);
      }
    }
    return true;
  }), [favoritesOnly, indexedSongs, normalizedQuery, tab, tagFilter, sidebarFilter, playlistsList, searchBy]);

  const filteredMedia = useMemo(() => indexedMedia.filter((item) => {
    if (tab === 'songs' || tab === 'preset') return false;
    if (tab === 'presentations' && item.media.mediaType !== 'pdf') return false;
    if (tab === 'media' && item.media.mediaType === 'pdf') return false;
    if (sidebarFilter === 'video' && item.media.mediaType !== 'video') return false;
    if (sidebarFilter === 'image' && item.media.mediaType !== 'image') return false;
    if (sidebarFilter === 'audio' && item.media.mediaType !== 'audio') return false;
    if (sidebarFilter === 'online' && item.media.mediaType !== 'youtube') return false;
    if (favoritesOnly && !item.isFavorite) return false;
    if (tagFilter && !item.tags.includes(tagFilter)) return false;
    if (sidebarFilter.startsWith('playlist:')) {
      const plId = sidebarFilter.split(':')[1];
      const playlist = playlistsList.find(p => p.id === plId);
      return playlist ? playlist.itemIds.includes(item.media.id) : false;
    }
    return item.searchText.includes(normalizedQuery);
  }), [favoritesOnly, indexedMedia, normalizedQuery, tab, tagFilter, sidebarFilter, playlistsList]);

  const filteredPresets = useMemo(() => indexedPresets.filter((item) => {
    if (tab !== 'all' && tab !== 'preset') return false;
    if (favoritesOnly) return false;
    if (tab === 'preset' && presetFamilyFilter === 'screen-layout') return false;
    if (tab === 'preset' && contentThemeTypeFilter !== 'all' && (item.preset.contentType || 'song') !== contentThemeTypeFilter) return false;
    if (tagFilter && item.preset.category !== tagFilter) return false;
    return item.searchText.includes(normalizedQuery);
  }), [contentThemeTypeFilter, favoritesOnly, indexedPresets, normalizedQuery, presetFamilyFilter, tab, tagFilter]);

  const filteredScreenLayouts = useMemo(() => indexedScreenLayouts.filter((item) => {
    if (tab !== 'all' && tab !== 'preset') return false;
    if (favoritesOnly || tagFilter) return false;
    if (tab === 'preset' && presetFamilyFilter === 'content-theme') return false;
    if (tab === 'preset' && screenLayoutPurposeFilter !== 'all' && item.layout.purpose !== screenLayoutPurposeFilter) return false;
    return item.searchText.includes(normalizedQuery);
  }), [favoritesOnly, indexedScreenLayouts, normalizedQuery, presetFamilyFilter, screenLayoutPurposeFilter, tab, tagFilter]);

  const previewSong = async (songId: string, live = false) => {
    const song = await ipcSongService.getById(songId, primaryRole);
    if (!song) return;
    setSelectedPresetPreviewKey(null);
    setLibraryPreviewSong(song, live ? 'liveControl' : 'preview');
    const slide = song.slides?.[0];
    if (slide) {
      setPreviewSlide(slide as any);
      if (live) {
        goLive(slide as any);
        window.dispatchEvent(new CustomEvent('rumedia:focus-live-preview'));
      }
    }
  };

  const editSong = async (songId: string) => {
    const song = await ipcSongService.getById(songId, primaryRole);
    if (song) void editSong(song.id);
  };

  const previewMedia = (media: Media, live = false) => {
    setSelectedPresetPreviewKey(null);
    setLibraryPreviewMedia(media, live ? 'liveControl' : 'preview');
    const [slide] = buildMediaVirtualSlides(media);
    if (slide) {
      setPreviewSlide(slide as any);
      if (live) {
        goLive(slide as any);
        window.dispatchEvent(new CustomEvent('rumedia:focus-live-preview'));
      }
    }
  };

  const previewContentTheme = (preset: Template) => {
    setSelectedPresetPreviewKey(`content-theme:${preset.id}`);
    setLibraryPreviewSong(null, 'preview');
    setPreviewSlide(buildLibraryContentThemePreview(preset));
  };

  const previewScreenLayout = (layout: ScreenLayoutPreset) => {
    setSelectedPresetPreviewKey(`screen-layout:${layout.id}`);
    setLibraryPreviewSong(null, 'preview');
    setPreviewSlide(buildLibraryScreenLayoutPreview(layout));
  };

  const deletePreset = async (preset: Template) => {
    if (!confirm(`Delete Content Theme "${preset.name}"?`)) return;
    await ipcTemplateService.delete(preset.id);
    await loadLibrary();
  };

  const deleteScreenLayout = async (layout: ScreenLayoutPreset) => {
    if (BUILTIN_SCREEN_LAYOUT_IDS.has(layout.id)) {
      toast.error('Built-in Screen Layouts cannot be deleted. Duplicate the layout first if you need a custom version.');
      return;
    }
    if (!confirm(`Delete Screen Layout "${layout.name}"?`)) return;
    const current = useSettingsStore.getState();
    const nextLayouts = current.outputPresets.filter((item) => item.id !== layout.id);
    const nextOutputs = current.outputs.map((output) => (
      output.outputPresetId === layout.id
        ? { ...output, outputPresetId: getDefaultOutputPresetIdForRole(output.role) }
        : output
    ));
    const nextSettings = await ipcOutputSettingsService.setSettings({ outputPresets: nextLayouts, outputs: nextOutputs });
    setOutputSettings(nextSettings);
    await ipcPresetPreviewService.delete(layout.thumbnail);
  };

  const openPresetEditor = (
    payload: OpenPresetEditorPayload,
    fallbackTemplate: Template | null = null,
    fallbackLayout: ScreenLayoutPreset | null = null,
  ) => {
    const openFallback = () => {
      setEditingPreset(fallbackTemplate);
      setEditingScreenLayout(fallbackLayout);
      setIsCreatingPreset(!fallbackTemplate && !fallbackLayout);
    };
    if (!window.api?.presetEditor) {
      openFallback();
      return;
    }
    void window.api.presetEditor.open(payload).catch((openError) => {
      console.error('[ControllerLibraryPanel] Failed to open detached preset editor:', openError);
      toast.error('Detached editor could not be opened. Using the in-app editor instead.');
      openFallback();
    });
  };

  const applyPresetToSong = async (songId: string, payload: SongPresetDragPayload) => {
    const song = songs.find((item) => item.id === songId);
    const preset = presets.find((item) => item.id === payload.id);
    if (!song || !preset) return;

    try {
      await ipcSongService.update(songId, { defaultTemplateId: preset.id });
      setSongs((current) => current.map((item) => (
        item.id === songId ? { ...item, defaultTemplateId: preset.id } : item
      )));
      await refreshPresetDrivenSongs();

      if (libraryPreviewSong?.id === songId) {
        await previewSong(songId);
      }

      toast.success(`Preset "${preset.name}" applied to "${song.title}".`);
    } catch (error) {
      console.error('[ControllerLibraryPanel] Failed to apply song preset:', error);
      toast.error('Failed to apply preset to song.');
    } finally {
      setDragOverSongId(null);
    }
  };

  const handlePresetDropOnSong = (event: React.DragEvent, songId: string) => {
    event.preventDefault();
    event.stopPropagation();

    try {
      const payload = JSON.parse(event.dataTransfer.getData('application/json')) as SongPresetDragPayload;
      if (payload.type === 'song-preset' && payload.id) {
        void applyPresetToSong(songId, payload);
      }
    } catch (error) {
      console.error('[ControllerLibraryPanel] Invalid preset drag payload:', error);
      setDragOverSongId(null);
    }
  };

  const toggleSongFavorite = async (song: Song) => {
    const tags = safeJsonArray(song.tags).map(String);
    const nextTags = tags.includes('favorite') ? tags.filter((tag) => tag !== 'favorite') : [...tags, 'favorite'];
    await ipcSongService.update(song.id, { tags: JSON.stringify(nextTags) });
    await loadLibrary();
  };

  const toggleMediaFavorite = async (media: Media) => {
    const tags = safeJsonArray(media.tags).map(String);
    const nextTags = tags.includes('favorite') ? tags.filter((tag) => tag !== 'favorite') : [...tags, 'favorite'];
    await ipcMediaService.update(media.id, { tags: JSON.stringify(nextTags) });
    await loadLibrary();
  };

  const addSongTag = async (song: Song) => {
    const tag = prompt('Tag name:')?.trim();
    if (!tag) return;
    const tags = safeJsonArray(song.tags).map(String);
    if (!tags.includes(tag)) {
      await ipcSongService.update(song.id, { tags: JSON.stringify([...tags, tag]) });
      await loadLibrary();
    }
  };

  const addMediaTag = async (media: Media) => {
    const tag = prompt('Tag name:')?.trim();
    if (!tag) return;
    const tags = safeJsonArray(media.tags).map(String);
    if (!tags.includes(tag)) {
      await ipcMediaService.update(media.id, { tags: JSON.stringify([...tags, tag]) });
      await loadLibrary();
    }
  };

  const handleAddLibraryItem = async () => {
    if (tab === 'preset') {
      openPresetEditor({
        kind: presetFamilyFilter === 'screen-layout'
          ? 'screen-layout'
          : presetFamilyFilter === 'content-theme'
            ? 'content-theme'
            : 'choose',
      });
      return;
    }
    if (tab === 'media') {
      if (sidebarFilter === 'online') {
        setIsAddOnlineOpen(true);
        return;
      }
      const imported = await ipcMediaService.importFile();
      if (imported?.length) await loadLibrary();
      return;
    }
    if (tab === 'presentations') {
      const imported = await importPdfWithRasterizer(ipcMediaService, toRenderableMediaUrl);
      if (imported) await loadLibrary();
      return;
    }
    onOpenSongEditor(null);
  };

  const addButtonLabel = tab === 'preset'
    ? presetFamilyFilter === 'screen-layout'
      ? 'New Screen Layout'
      : presetFamilyFilter === 'content-theme'
        ? 'New Content Theme'
        : 'New Preset'
    : tab === 'media'
      ? (sidebarFilter === 'online' ? 'Add Online Media' : 'Add Media')
      : tab === 'presentations'
        ? 'Add PDF'
        : tab === 'bible'
          ? 'Add Version'
          : 'Add Song';

  const tabs: { id: LibraryTab; label: string }[] = [
    { id: 'songs', label: 'Songs' },
    { id: 'media', label: 'Media' },
    { id: 'presentations', label: 'Presentations' },
    { id: 'preset', label: 'Presets' },
    { id: 'bible', label: 'Bible' },
  ];

  const emptyLibrary = filteredSongs.length === 0 && filteredMedia.length === 0 && filteredPresets.length === 0 && filteredScreenLayouts.length === 0;
  // const _totalFilteredItems = filteredSongs.length + filteredMedia.length + filteredPresets.length;
  const renderedSongs = filteredSongs;
  const renderedMedia = filteredMedia;
  const renderedPresets = filteredPresets;
  const renderedScreenLayouts = filteredScreenLayouts;
  const canLoadMoreSongs = songs.length < songTotal;
  const canLoadMoreMedia = mediaItems.length < mediaTotal;
  const canLoadMorePresets = presets.length < presetTotal;
  const isLibraryPageLoading = tab === 'all'
    ? isSongPageLoading || isMediaPageLoading || isPresetPageLoading
    : tab === 'songs'
      ? isSongPageLoading
      : tab === 'media' || tab === 'presentations'
        ? isMediaPageLoading
        : tab === 'preset'
          ? isPresetPageLoading
          : false;
  const handleLibraryScroll = (event: ReactUIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - scrollTop - clientHeight > 180) return;
    if ((tab === 'all' || tab === 'songs') && canLoadMoreSongs && !isSongPageLoading) void loadSongPage(songs.length, true);
    if ((tab === 'all' || tab === 'media' || tab === 'presentations') && canLoadMoreMedia && !isMediaPageLoading) void loadMediaPage(mediaItems.length, true);
    if ((tab === 'all' || tab === 'preset') && canLoadMorePresets && !isPresetPageLoading) void loadPresetPage(presets.length, true);
  };
  // const _renderedItemCount = renderedSongs.length + renderedMedia.length + renderedPresets.length;
  // const _hasMoreLibraryItems = false;

  const tableItems = useMemo(() => {
    const items: {
      id: string;
      type: 'song' | 'media' | 'preset' | 'screen-layout';
      title: string;
      detail: string;
      copyright: string;
      displayTag?: string | null;
      isFavorite?: boolean;
      lyricMatches?: LyricMatch[];
      originalSong?: Song;
      originalMedia?: Media;
      originalPreset?: Template;
      originalScreenLayout?: ScreenLayoutPreset;
    }[] = [];

    renderedSongs.forEach(({ song, isFavorite, displayTag }) => {
      items.push({
        id: song.id,
        type: 'song',
        title: song.title || '',
        detail: song.author || 'Unknown Artist',
        copyright: song.copyright || 'Public Domain',
        displayTag,
        isFavorite,
        lyricMatches: showsLyricContext ? findLyricMatches(song.rawLyrics, deferredQuery) : undefined,
        originalSong: song,
      });
    });

    renderedMedia.forEach(({ media, isFavorite, displayTag }) => {
      items.push({
        id: media.id,
        type: 'media',
        title: media.filename || '',
        detail: media.mediaType.toUpperCase(),
        copyright: 'Media',
        displayTag,
        isFavorite,
        originalMedia: media,
      });
    });

    renderedPresets.forEach(({ preset }) => {
      items.push({
        id: preset.id,
        type: 'preset',
        title: preset.name || '',
        detail: `${(preset.contentType || 'song').toUpperCase()} · ${preset.category || 'Theme'}`,
        copyright: 'Content Theme',
        originalPreset: preset,
      });
    });

    renderedScreenLayouts.forEach(({ layout }) => {
      items.push({
        id: layout.id,
        type: 'screen-layout',
        title: layout.name,
        detail: `${layout.purpose.toUpperCase()} · ${layout.role}`,
        copyright: 'Screen Layout',
        originalScreenLayout: layout,
      });
    });

    return items;
  }, [deferredQuery, renderedScreenLayouts, renderedSongs, renderedMedia, renderedPresets, showsLyricContext]);

  const sortedTableItems = useMemo(() => {
    const sorted = [...tableItems];
    sorted.sort((a, b) => {
      const valA = (a[sortColumn] || '').toLowerCase();
      const valB = (b[sortColumn] || '').toLowerCase();
      if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tableItems, sortColumn, sortDirection]);

  const displayedTableItems = useMemo(
    () => isLyricSearchMode
      ? sortedTableItems.filter((item) => item.type === 'song' && (item.lyricMatches?.length || 0) > 0)
      : sortedTableItems,
    [isLyricSearchMode, sortedTableItems],
  );

  const totalLyricMatches = useMemo(
    () => displayedTableItems.reduce((total, item) => (
      total + (item.lyricMatches || []).reduce((matchTotal, match) => matchTotal + match.occurrenceCount, 0)
    ), 0),
    [displayedTableItems],
  );

  const effectiveViewMode: LibraryViewMode = showsLyricContext ? 'list' : viewMode;
  const visualThumbnailHeight = Math.round(visualThumbnailWidth * 9 / 16);
  const visualPreviewColumnWidth = visualThumbnailWidth + 12;
  const visualRowMinHeight = Math.max(66, visualThumbnailHeight + 16);
  const visualListGridTemplate = `${visualPreviewColumnWidth}px minmax(0, 1.45fr) minmax(150px, 0.75fr) 118px`;

  const cardClass = viewMode === 'grid'
    ? 'overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)] active:scale-[0.99]'
    : 'grid items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 text-left transition hover:bg-slate-50 active:scale-[0.995]'
  const activeCardClass = viewMode === 'grid'
    ? 'overflow-hidden rounded-lg border border-indigo-500 bg-indigo-50/10 text-left transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(15,23,42,0.12)] active:scale-[0.99]'
    : 'grid items-center gap-3 rounded-lg border border-indigo-500 bg-indigo-50/10 p-2 text-left transition hover:bg-indigo-50/20 active:scale-[0.995]';
  const cardStyle = viewMode === 'list' ? { gridTemplateColumns: '112px minmax(0, 1fr) 90px 28px' } : undefined;

  return (
    <section className="flex h-full min-h-0 flex-col border-t border-slate-200 bg-white">
      {/* Top Header / Category Selector */}
      <div className="flex min-h-14 shrink-0 items-center justify-between border-b border-slate-100 px-3">
        <div className="flex items-center gap-3">
          <p className="shrink-0 text-sm font-extrabold uppercase tracking-[0.08em] text-slate-950">Library</p>
          <div className="flex min-w-0 shrink items-center gap-1 overflow-x-auto">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setSidebarFilter('all');
                }}
                className={`h-9 rounded-lg px-3 text-sm font-semibold transition active:scale-[0.98] ${
                  tab === item.id
                    ? 'border border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <label className="flex h-9 w-[240px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-slate-500">
            <Search size={16} />
            <input
              type="search"
              placeholder={`Search in ${tabs.find((t) => t.id === tab)?.label}...`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>
          {(tab === 'all' || tab === 'songs') && (
            <select
              value={searchBy}
              onChange={(e) => {
                const nextSearchBy = e.target.value as typeof searchBy;
                setSearchBy(nextSearchBy);
                if (nextSearchBy === 'lyrics') setViewMode('list');
              }}
              className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 outline-none hover:bg-slate-50 transition cursor-pointer"
            >
              <option value="all">All Fields</option>
              <option value="title">Title</option>
              <option value="lyrics">Lyrics</option>
              <option value="author">Author</option>
            </select>
          )}
          {(tab !== 'preset' || presetFamilyFilter !== 'screen-layout') && <div className="relative">
            <PillButton onClick={() => setIsTagMenuOpen((current) => !current)}>
              {tagFilter || (tab === 'preset' ? 'Category' : 'Tag')} <ChevronDown size={14} />
            </PillButton>
            {isTagMenuOpen && (
              <div className="absolute right-0 top-11 z-30 max-h-56 w-48 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-[0_18px_42px_rgba(15,23,42,0.16)]">
                <button
                  type="button"
                  onClick={() => {
                    setTagFilter(null);
                    setIsTagMenuOpen(false);
                  }}
                  className={`flex w-full px-3 py-2 text-left text-sm font-semibold ${!tagFilter ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                >
                  {tab === 'preset' ? 'All categories' : 'All tags'}
                </button>
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      setTagFilter(tag);
                      setIsTagMenuOpen(false);
                    }}
                    className={`flex w-full px-3 py-2 text-left text-sm font-semibold ${tagFilter === tag ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>}
          {tab === 'songs' ? (
            <div
              title="Songs always use list view"
              aria-label="Songs always use list view"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-indigo-700"
            >
              <AlignJustify size={16} />
              <span className="hidden xl:inline">List</span>
            </div>
          ) : (
            <>
              <IconButton
                label={showsLyricContext ? 'Search results with lyric context use list view' : 'Grid view'}
                onClick={() => {
                  if (!showsLyricContext) setViewMode('grid');
                }}
                className={effectiveViewMode === 'grid' ? 'bg-indigo-50 text-indigo-700' : showsLyricContext ? 'cursor-not-allowed opacity-35' : undefined}
              ><Grid2X2 size={16} /></IconButton>
              <IconButton label="List view" onClick={() => setViewMode('list')} className={effectiveViewMode === 'list' ? 'bg-indigo-50 text-indigo-700' : undefined}><AlignJustify size={16} /></IconButton>
              <IconButton
                label={showsLyricContext ? 'Lyric search uses detailed list view' : 'Visual list view'}
                onClick={() => {
                  if (!showsLyricContext) setViewMode('visual-list');
                }}
                className={effectiveViewMode === 'visual-list' ? 'bg-indigo-50 text-indigo-700' : showsLyricContext ? 'cursor-not-allowed opacity-35' : undefined}
              ><ImageIcon size={16} /></IconButton>
            </>
          )}
          {effectiveViewMode === 'grid' && (
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" title={`Grid thumbnail width ${gridThumbnailWidth}px`}>
              <span className="hidden xl:inline">Thumbnail</span>
              <input
                type="range"
                min="140"
                max="320"
                step="20"
                value={gridThumbnailWidth}
                onChange={(event) => setGridThumbnailWidth(Number(event.target.value))}
                className="h-1.5 w-20 cursor-pointer accent-indigo-600"
                aria-label="Grid thumbnail size"
              />
              <span className="w-8 text-right font-mono text-[9px] text-slate-400">{gridThumbnailWidth}</span>
            </label>
          )}
          {effectiveViewMode === 'visual-list' && (
            <label className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400" title={`Thumbnail width ${visualThumbnailWidth}px`}>
              <span className="hidden xl:inline">Thumbnail</span>
              <input
                type="range"
                min="56"
                max="160"
                step="8"
                value={visualThumbnailWidth}
                onChange={(event) => setVisualThumbnailWidth(Number(event.target.value))}
                className="h-1.5 w-20 cursor-pointer accent-indigo-600"
                aria-label="Thumbnail size"
              />
              <span className="w-7 text-right font-mono text-[9px] text-slate-400">{visualThumbnailWidth}</span>
            </label>
          )}
          <PillButton onClick={() => void handleAddLibraryItem()} className="bg-indigo-600 text-white hover:bg-indigo-500 hover:text-white border-transparent">
            <Plus size={14} />
            {addButtonLabel}
          </PillButton>
        </div>
      </div>

      {/* Main Inner Split: Sidebar + Content */}
      <div className="flex flex-1 min-h-0">
                {tab === 'bible' ? (
          /* Left Bible Sidebar */
          <div className="w-52 border-r border-slate-200 bg-slate-50/50 flex flex-col gap-4 p-3 shrink-0 overflow-y-auto select-none">
            {/* Quick Reference Input */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-2">Quick Reference</p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!bibleQuickRefInput.trim()) return;
                  // Try to parse input (e.g. John 3:16 or Kej 1:1 or Genesis 1)
                  const match = bibleQuickRefInput.match(/^([a-zA-Z0-9\s]+?)\s+(\d+)(?::(\d+))?$/);
                  if (match) {
                    const bookNameOrCode = match[1].toLowerCase().replace(/\s+/g, '');
                    const chapterNum = parseInt(match[2]);
                    const verseNum = match[3] ? parseInt(match[3]) : null;
                    
                    const foundBook = bibleBooks.find(b => 
                      b.name.toLowerCase().replace(/\s+/g, '') === bookNameOrCode ||
                      b.code.toLowerCase() === bookNameOrCode
                    );
                    
                    if (foundBook) {
                      setSelectedBibleBookCode(foundBook.code);
                      const maxChapter = foundBook.chapters.length;
                      const validChapter = Math.min(Math.max(1, chapterNum), maxChapter);
                      setSelectedBibleChapter(validChapter);
                      if (verseNum) {
                        // Scroll/Highlight verse logic can be added later
                      }
                    } else {
                      alert('Book not found: ' + match[1]);
                    }
                  } else {
                    alert('Invalid reference format. Try e.g. "Genesis 1:1"');
                  }
                }}
                className="px-2"
              >
                <input
                  type="text"
                  placeholder="e.g. Genesis 1:1"
                  value={bibleQuickRefInput}
                  onChange={(e) => setBibleQuickRefInput(e.target.value)}
                  className="w-full h-8 rounded border border-slate-200 bg-white px-2 text-xs text-slate-900 outline-none focus:border-indigo-500 placeholder:text-slate-400"
                />
              </form>
            </div>

            {/* SCRIPTURES Section */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-2">SCRIPTURES</p>
              <div className="space-y-0.5">
                {bibleVersions.map((version: BibleVersion) => (
                  <div key={version.id} className="group flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-100 cursor-pointer">
                    <button
                      type="button"
                      onClick={() => void switchBibleVersion(version.id)}
                      className={`flex-1 text-xs font-semibold text-left truncate ${
                        activeBibleVersion?.id === version.id
                          ? 'text-indigo-700 font-extrabold'
                          : 'text-slate-700 hover:text-slate-900'
                      }`}
                    >
                      {version.name} ({version.code})
                    </button>
                    {activeBibleVersion?.id !== version.id && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete ${version.name}?`)) {
                            void deleteBibleVersion(version.id);
                          }
                        }}
                        className="hidden group-hover:block text-slate-400 hover:text-red-600 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
                {bibleVersions.length === 0 && (
                  <p className="text-[10px] text-slate-400 px-2 italic">No versions installed</p>
                )}
              </div>
            </div>

            {/* COLLECTIONS & MY COLLECTIONS placeholders */}
            <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-2">COLLECTIONS</p>
              <p className="text-[10px] text-slate-400 px-2 italic">No collections</p>
            </div>

            {/* Sidebar bottom icons */}
            <div className="mt-auto border-t border-slate-200 pt-2 flex items-center justify-end px-2">
              <button
                type="button"
                className="text-slate-500 hover:text-indigo-600 transition"
                onClick={() => setIsBibleSettingsOpen(true)}
                title="Bible Settings & Translations"
              >
                <Settings size={14} />
              </button>
            </div>
          </div>

        ) : (
          /* Left Library Sidebar */
          <div className="w-52 border-r border-slate-200 bg-slate-50/50 flex flex-col gap-4 p-3 shrink-0 overflow-y-auto select-none">
            {/* Quick Access */}
            {tab !== 'preset' && <div>
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-1.5 px-2">Quick Access</p>
              <div className="space-y-0.5">
                {tab === 'songs' && (
                  <button
                    type="button"
                    onClick={() => setSidebarFilter('all')}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left ${
                      sidebarFilter === 'all'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <ListFilter size={14} className={sidebarFilter === 'all' ? 'text-indigo-600' : 'text-slate-400'} />
                    <span className="flex-1 truncate">All Songs</span>
                  </button>
                )}
                {(() => {
                  const favCount = tab === 'songs' 
                    ? indexedSongs.filter(s => s.isFavorite).length 
                    : tab === 'media' 
                    ? indexedMedia.filter(m => m.isFavorite).length 
                    : 0;
                  return (
                    <button
                      type="button"
                      onClick={() => setSidebarFilter(prev => prev === 'favorites' ? 'all' : 'favorites')}
                      onDragEnter={(event) => {
                        event.preventDefault();
                        setDragOverPlaylistId('favorites');
                      }}
                      onDragLeave={(event) => {
                        const rect = event.currentTarget.getBoundingClientRect();
                        const isStillInside =
                          event.clientX >= rect.left &&
                          event.clientX <= rect.right &&
                          event.clientY >= rect.top &&
                          event.clientY <= rect.bottom;
                        if (!isStillInside) {
                          setDragOverPlaylistId((current) => (current === 'favorites' ? null : current));
                        }
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'copy';
                        if (dragOverPlaylistId !== 'favorites') {
                          setDragOverPlaylistId('favorites');
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        setDragOverPlaylistId(null);
                        const raw = event.dataTransfer.getData('application/json');
                        if (!raw) return;
                        try {
                          const data = JSON.parse(raw);
                          if (data.type === 'song') {
                            const found = songs.find(s => s.id === data.id);
                            if (found) void toggleSongFavorite(found);
                          } else if (data.type === 'media') {
                            const found = mediaItems.find(m => m.id === data.id);
                            if (found) void toggleMediaFavorite(found);
                          }
                        } catch (e) {
                          console.error('Favorites drop error:', e);
                        }
                      }}
                      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left truncate relative ${
                        dragOverPlaylistId === 'favorites'
                          ? 'ring-2 ring-indigo-500 bg-indigo-50 text-indigo-700 border-indigo-200 scale-[1.02] shadow-sm z-10'
                          : sidebarFilter === 'favorites'
                            ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                            : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Star size={14} className={sidebarFilter === 'favorites' ? 'fill-indigo-600 text-indigo-600' : 'text-slate-400'} />
                      <span className="flex-1 truncate">Favorites</span>
                      <span className="ml-auto text-[10px] font-bold text-slate-500 bg-slate-200/60 rounded px-1.5 py-0.5 min-w-5 text-center shrink-0">
                        {favCount}
                      </span>
                    </button>
                  );
                })()}
              </div>
            </div>}

            {tab === 'preset' && (
              <div className="space-y-4 border-t border-slate-200 pt-3">
                <div>
                  <p className="mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Preset Family</p>
                  <div className="space-y-0.5">
                    {([
                      { id: 'all', label: 'All Presets', icon: Grid2X2 },
                      { id: 'content-theme', label: 'Content Themes', icon: Sparkles },
                      { id: 'screen-layout', label: 'Screen Layouts', icon: ScreenShare },
                    ] as const).map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setPresetFamilyFilter(item.id);
                            setTagFilter(null);
                          }}
                          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold transition active:scale-[0.98] ${presetFamilyFilter === item.id ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'}`}
                        >
                          <Icon size={14} className={presetFamilyFilter === item.id ? 'text-indigo-600' : 'text-slate-400'} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {presetFamilyFilter !== 'screen-layout' && (
                  <div>
                    <p className="mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Content Type</p>
                    <div className="grid grid-cols-2 gap-1">
                      {(['all', 'song', 'scripture', 'presentation', 'media'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setContentThemeTypeFilter(type)}
                          className={`rounded px-2 py-1.5 text-[10px] font-bold capitalize transition active:scale-[0.98] ${contentThemeTypeFilter === type ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                        >
                          {type === 'all' ? 'All types' : type}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {presetFamilyFilter !== 'content-theme' && (
                  <div>
                    <p className="mb-1.5 px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Layout Purpose</p>
                    <div className="grid grid-cols-2 gap-1">
                      {(['all', 'audience', 'stage', 'confidence', 'broadcast', 'custom'] as const).map((purpose) => (
                        <button
                          key={purpose}
                          type="button"
                          onClick={() => setScreenLayoutPurposeFilter(purpose)}
                          className={`rounded px-2 py-1.5 text-[10px] font-bold capitalize transition active:scale-[0.98] ${screenLayoutPurposeFilter === purpose ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`}
                        >
                          {purpose === 'all' ? 'All purposes' : purpose}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Playlists */}
            {(tab === 'songs' || tab === 'media') && (
              <div>
                <div className="flex items-center justify-between mb-1.5 px-2">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Playlists</p>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingPlaylist((prev) => !prev);
                      setNewPlaylistName('');
                    }}
                    className="text-slate-400 hover:text-indigo-600 transition"
                    title="Create playlist"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                {isCreatingPlaylist && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (newPlaylistName.trim()) {
                        const newPl = { id: crypto.randomUUID(), name: newPlaylistName.trim(), type: tab, itemIds: [] };
                        setPlaylistsList((current) => [...current, newPl]);
                        setSidebarFilter(`playlist:${newPl.id}`);
                        setNewPlaylistName('');
                        setIsCreatingPlaylist(false);
                      }
                    }}
                    className="mb-2 px-1 flex gap-1"
                  >
                    <input
                      type="text"
                      autoFocus
                      placeholder="Playlist name..."
                      value={newPlaylistName}
                      onChange={(e) => setNewPlaylistName(e.target.value)}
                      className="w-full text-xs px-2 py-1 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                    <button
                      type="submit"
                      disabled={!newPlaylistName.trim()}
                      className="px-2 py-1 bg-indigo-600 text-white text-xs font-semibold rounded hover:bg-indigo-700 disabled:opacity-50 transition"
                    >
                      Save
                    </button>
                  </form>
                )}
                <div className="space-y-0.5">
                  {playlistsList.filter((p) => p.type === tab).map((pl) => (
                    <div
                      key={pl.id}
                      className="group relative flex items-center"
                    >
                      <button
                        type="button"
                        onClick={() => setSidebarFilter(`playlist:${pl.id}`)}
                        onDragEnter={(event) => {
                          event.preventDefault();
                          setDragOverPlaylistId(pl.id);
                        }}
                        onDragLeave={(event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const isStillInside =
                            event.clientX >= rect.left &&
                            event.clientX <= rect.right &&
                            event.clientY >= rect.top &&
                            event.clientY <= rect.bottom;
                          if (!isStillInside) {
                            setDragOverPlaylistId((current) => (current === pl.id ? null : current));
                          }
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'copy';
                          if (dragOverPlaylistId !== pl.id) {
                            setDragOverPlaylistId(pl.id);
                          }
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragOverPlaylistId(null);
                          const raw = event.dataTransfer.getData('application/json');
                          if (!raw) return;
                          try {
                            const data = JSON.parse(raw);
                            if (data.type === 'song' && pl.type === 'songs') {
                              setPlaylistsList(prev => prev.map(p => p.id === pl.id ? { ...p, itemIds: Array.from(new Set([...p.itemIds, data.id])) } : p));
                            } else if (data.type === 'media' && pl.type === 'media') {
                              setPlaylistsList(prev => prev.map(p => p.id === pl.id ? { ...p, itemIds: Array.from(new Set([...p.itemIds, data.id])) } : p));
                            }
                          } catch (e) {
                            console.error('Playlist drop error:', e);
                          }
                        }}
                        className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left truncate relative ${
                          dragOverPlaylistId === pl.id
                            ? 'ring-2 ring-indigo-500 bg-indigo-50 text-indigo-700 border-indigo-200 scale-[1.02] shadow-sm z-10'
                            : sidebarFilter === `playlist:${pl.id}`
                              ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                              : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <AlignJustify size={14} className="rotate-90 shrink-0 text-slate-400" />
                        <span className="truncate flex-1 pr-4">{pl.name}</span>
                        <span className="ml-auto text-[10px] font-bold text-slate-500 bg-slate-200/60 rounded px-1.5 py-0.5 min-w-5 text-center shrink-0 group-hover:hidden">
                          {pl.itemIds.length}
                        </span>
                      </button>
                      <button
                        type="button"
                        title="Delete Playlist"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete playlist "${pl.name}"?`)) {
                            setPlaylistsList(prev => prev.filter(p => p.id !== pl.id));
                            if (sidebarFilter === `playlist:${pl.id}`) {
                              setSidebarFilter('all');
                            }
                          }
                        }}
                        className="hidden group-hover:grid absolute right-1.5 h-5 w-5 place-items-center rounded text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {playlistsList.filter((p) => p.type === tab).length === 0 && (
                    <p className="text-[10px] text-slate-400 px-2 italic">No playlists created</p>
                  )}
                </div>
              </div>
            )}

            {/* Subtypes (Dynamic: only show Videos & Images if tab === 'media' is open) */}
            {tab === 'media' && (
              <div>
                <div className="flex items-center justify-between px-2 mb-1.5">
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Media Types</p>
                  <button
                    type="button"
                    onClick={() => setIsAddOnlineOpen(true)}
                    title="Add Online Media (YouTube)"
                    className="p-1 rounded text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition"
                  >
                    <Plus size={14} />
                  </button>
                </div>
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => setSidebarFilter('all')}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left ${
                      sidebarFilter === 'all'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <ListFilter size={14} className={sidebarFilter === 'all' ? 'text-indigo-600' : 'text-slate-400'} />
                    All Media
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarFilter('video')}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left ${
                      sidebarFilter === 'video'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Film size={14} className={sidebarFilter === 'video' ? 'text-indigo-600' : 'text-slate-400'} />
                    Videos
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarFilter('image')}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left ${
                      sidebarFilter === 'image'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <ImageIcon size={14} className={sidebarFilter === 'image' ? 'text-indigo-600' : 'text-slate-400'} />
                    Images
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarFilter('audio')}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left ${
                      sidebarFilter === 'audio'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Volume2 size={14} className={sidebarFilter === 'audio' ? 'text-indigo-600' : 'text-slate-400'} />
                    Audios
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarFilter('online')}
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs font-semibold transition text-left ${
                      sidebarFilter === 'online'
                        ? 'bg-indigo-50 text-indigo-700 shadow-sm'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    <Globe size={14} className={sidebarFilter === 'online' ? 'text-indigo-600' : 'text-slate-400'} />
                    Online
                  </button>
                </div>
              </div>
            )}

          </div>

        )}

        {tab === 'bible' ? (
          /* Right Bible Content Area */
          <div className="min-h-0 flex-1 p-4 flex flex-col gap-4">
            <div className="flex-1 min-h-0 border border-slate-200/20 bg-surface rounded-lg shadow-sm flex flex-col bg-white">
              {/* Book & Chapter Selector Header */}
              <div className="flex items-center gap-2 border-b border-slate-100 p-2 bg-slate-50/50 flex-wrap">
                <select
                  value={selectedBibleBookCode}
                  onChange={(e) => {
                    setSelectedBibleBookCode(e.target.value);
                    setSelectedBibleChapter(1);
                    setSelectedBibleVerseStart(1);
                    setSelectedBibleVerseEnd(1);
                  }}
                  className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  {bibleBooks.map((book) => (
                    <option key={book.code} value={book.code}>{book.name}</option>
                  ))}
                </select>

                <select
                  value={selectedBibleChapter}
                  onChange={(e) => {
                    setSelectedBibleChapter(parseInt(e.target.value));
                    setSelectedBibleVerseStart(1);
                    setSelectedBibleVerseEnd(1);
                  }}
                  className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  {bibleBooks.find(b => b.code === selectedBibleBookCode)?.chapters.map((ch) => (
                    <option key={ch.number} value={ch.number}>Pasal {ch.number}</option>
                  )) || <option value={1}>Pasal 1</option>}
                </select>

                <select
                  value={selectedBibleVerseStart}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSelectedBibleVerseStart(val);
                    if (selectedBibleVerseEnd < val) {
                      setSelectedBibleVerseEnd(val);
                    }
                  }}
                  className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  {(() => {
                    const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
                    const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
                    const count = chapter?.verses.length || 0;
                    const opts = [];
                    for (let i = 1; i <= count; i++) {
                      opts.push(<option key={i} value={i}>Ayat {i}</option>);
                    }
                    return opts;
                  })()}
                </select>

                <select
                  value={selectedBibleVerseEnd}
                  onChange={(e) => setSelectedBibleVerseEnd(parseInt(e.target.value))}
                  className="h-8 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  {(() => {
                    const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
                    const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
                    const count = chapter?.verses.length || 0;
                    const opts = [];
                    for (let i = selectedBibleVerseStart; i <= count; i++) {
                      opts.push(<option key={i} value={i}>s/d Ayat {i}</option>);
                    }
                    return opts;
                  })()}
                </select>

                <select
                  value={selectedBibleContentThemeId}
                  onChange={(event) => setSelectedBibleContentThemeId(event.target.value)}
                  title="Scripture Content Theme"
                  className="h-8 max-w-52 rounded border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 outline-none"
                >
                  <option value="">No item theme · use layout rule</option>
                  {scriptureThemes.map((theme) => <option key={theme.id} value={theme.id}>{theme.name}</option>)}
                </select>

                <button
                  type="button"
                  onClick={async () => {
                    const itemData = createBibleScheduleItemData();
                    if (!itemData) return;
                    const itemId = await addItem(itemData);
                    setSelectedItem(itemId);
                  }}
                  className="h-8 rounded bg-emerald-600 hover:bg-emerald-500 text-white px-3 text-xs font-bold transition flex items-center gap-1 ml-auto"
                >
                  <Plus size={12} /> Add to Schedule
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
                    const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
                    if (!book || !chapter) return;
                    const selectedVerses = chapter.verses.filter(v => v.verse >= selectedBibleVerseStart && v.verse <= selectedBibleVerseEnd);
                    if (selectedVerses.length === 0) return;
                    
                    const currentPayload = {
                      reference: `${book.name} ${chapter.number}:${selectedBibleVerseStart}${selectedBibleVerseStart !== selectedBibleVerseEnd ? `-${selectedBibleVerseEnd}` : ""}`,
                      text: selectedVerses.map(v => v.text).join("\n"),
                      verseStart: selectedBibleVerseStart,
                      verseEnd: selectedBibleVerseEnd,
                      versionCode: activeBibleVersion?.code || "DEFAULT",
                      verses: selectedVerses.map(v => ({ verse: v.verse, text: v.text })),
                      splitMode: bibleTemplate.maxVersesPerSlide ? "per-verse" : "auto",
                      slideCount: null,
                      ...selectedBibleThemeFields,
                      style: bibleTemplate,
                    };
                    const previewItem = {
                      id: `bible-preview-${selectedBibleBookCode}-${selectedBibleChapter}-${selectedBibleVerseStart}-${selectedBibleVerseEnd}`,
                      itemType: "bible",
                      bibleBook: selectedBibleBookCode,
                      bibleChapter: selectedBibleChapter,
                      bibleVerseStart: selectedBibleVerseStart,
                      bibleVerseEnd: selectedBibleVerseEnd,
                      content: JSON.stringify(currentPayload),
                    };
                    const slides = buildBibleVirtualSlides(previewItem as any);
                    if (slides && slides[0]) {
                      goLive(slides[0] as any);
                    }
                  }}
                  className="h-8 rounded bg-indigo-600 hover:bg-indigo-500 text-white px-3 text-xs font-bold transition flex items-center gap-1"
                >
                  <Send size={12} /> Go Live
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                <table className="w-full border-collapse text-left text-xs table-fixed">
                  <thead>
                    <tr className="text-[11px] font-medium text-slate-500 select-none">
                      <th className="sticky top-0 z-10 bg-slate-100 px-3 py-1.5 border-b border-slate-200/20 w-[15%] shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Translation</th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-3 py-1.5 border-b border-slate-200/20 w-[20%] shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Reference</th>
                      <th className="sticky top-0 z-10 bg-slate-100 px-3 py-1.5 border-b border-slate-200/20 w-[65%] shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Scripture</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/10">
                    {(() => {
                      const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
                      const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
                      const verses = chapter?.verses || [];
                      
                      return verses.map((verse) => (
                        <tr
                          key={verse.id}
                          role="button"
                          tabIndex={0}
                          draggable
                          onDragStart={(event) => {
                            const isInSelectedRange = verse.verse >= selectedBibleVerseStart && verse.verse <= selectedBibleVerseEnd;
                            const payload = createBibleDragPayload(
                              isInSelectedRange ? selectedBibleVerseStart : verse.verse,
                              isInSelectedRange ? selectedBibleVerseEnd : verse.verse
                            );
                            if (!payload) return;
                            event.dataTransfer.setData('application/json', JSON.stringify(payload));
                            event.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={resetPlaylistDragState}
                          onClick={(e) => {
                            const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
                            const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
                            if (!book || !chapter) return;
                            
                            let start = selectedBibleVerseStart;
                            let end = selectedBibleVerseEnd;
                            
                            if (e.shiftKey) {
                              if (verse.verse < start) {
                                start = verse.verse;
                              } else {
                                end = verse.verse;
                              }
                            } else {
                              start = verse.verse;
                              end = verse.verse;
                            }
                            
                            setSelectedBibleVerseStart(start);
                            setSelectedBibleVerseEnd(end);
                            
                            const selectedVerses = chapter.verses.filter(v => v.verse >= start && v.verse <= end);
                            
                            const currentPayload = {
                              reference: `${verse.bookName} ${verse.chapter}:${start}${start !== end ? `-${end}` : ""}`,
                              text: selectedVerses.map(v => v.text).join("\n"),
                              verseStart: start,
                              verseEnd: end,
                              versionCode: activeBibleVersion?.code || "DEFAULT",
                              verses: selectedVerses.map(v => ({ verse: v.verse, text: v.text })),
                              splitMode: bibleTemplate.maxVersesPerSlide ? "per-verse" : "auto",
                              slideCount: null,
                              ...selectedBibleThemeFields,
                              style: bibleTemplate,
                            };
                            const previewItem = {
                              id: `bible-preview-${selectedBibleBookCode}-${selectedBibleChapter}-${start}-${end}`,
                              itemType: "bible",
                              bibleBook: selectedBibleBookCode,
                              bibleChapter: selectedBibleChapter,
                              bibleVerseStart: start,
                              bibleVerseEnd: end,
                              content: JSON.stringify(currentPayload),
                            };
                            const slides = buildBibleVirtualSlides(previewItem as any);
                            if (slides && slides[0]) {
                              setPreviewSlide(slides[0] as any);
                            }
                          }}
                          onDoubleClick={() => {
                            const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
                            const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
                            if (!book || !chapter) return;
                            const selectedVerses = chapter.verses.filter(v => v.verse >= selectedBibleVerseStart && v.verse <= selectedBibleVerseEnd);
                            if (selectedVerses.length === 0) return;
                            
                            const currentPayload = {
                              reference: `${book.name} ${chapter.number}:${selectedBibleVerseStart}${selectedBibleVerseStart !== selectedBibleVerseEnd ? `-${selectedBibleVerseEnd}` : ""}`,
                              text: selectedVerses.map(v => v.text).join("\n"),
                              verseStart: selectedBibleVerseStart,
                              verseEnd: selectedBibleVerseEnd,
                              versionCode: activeBibleVersion?.code || "DEFAULT",
                              verses: selectedVerses.map(v => ({ verse: v.verse, text: v.text })),
                              splitMode: bibleTemplate.maxVersesPerSlide ? "per-verse" : "auto",
                              slideCount: null,
                              ...selectedBibleThemeFields,
                              style: bibleTemplate,
                            };
                            const previewItem = {
                              id: `bible-preview-${selectedBibleBookCode}-${selectedBibleChapter}-${selectedBibleVerseStart}-${selectedBibleVerseEnd}`,
                              itemType: "bible",
                              bibleBook: selectedBibleBookCode,
                              bibleChapter: selectedBibleChapter,
                              bibleVerseStart: selectedBibleVerseStart,
                              bibleVerseEnd: selectedBibleVerseEnd,
                              content: JSON.stringify(currentPayload),
                            };
                            const slides = buildBibleVirtualSlides(previewItem as any);
                            if (slides && slides[0]) {
                              goLive(slides[0] as any);
                            }
                          }}
                          className={`hover:bg-slate-50 cursor-pointer active:bg-slate-100 select-none group ${
                            verse.verse >= selectedBibleVerseStart && verse.verse <= selectedBibleVerseEnd
                              ? "bg-indigo-50 hover:bg-indigo-100/60 dark:bg-indigo-900/30"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-1.5 truncate border-r border-slate-200/10 font-semibold text-slate-600">
                            {activeBibleVersion?.code || "DEFAULT"}
                          </td>
                          <td className="px-3 py-1.5 truncate border-r border-slate-200/10 font-medium text-slate-900">
                            {verse.bookName} {verse.chapter}:{verse.verse}
                          </td>
                          <td className="px-3 py-1.5 whitespace-normal break-words text-slate-800">
                            {verse.text}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
              
              {/* Footer */}
              <div className="border-t border-slate-200/20 px-3 py-1.5 bg-slate-50 text-[10px] text-slate-500 font-medium flex items-center justify-between">
                <span>
                  {(() => {
                    const book = bibleBooks.find(b => b.code === selectedBibleBookCode);
                    const chapter = book?.chapters.find(c => c.number === selectedBibleChapter);
                    return chapter?.verses.length || 0;
                  })()} references
                </span>
              </div>
            </div>
          </div>

        ) : (
          /* Right Content Area */
          <div
            onScroll={effectiveViewMode === 'grid' ? handleLibraryScroll : undefined}
            className={`min-h-0 flex-1 p-4 flex flex-col gap-3 ${effectiveViewMode === 'grid' ? 'overflow-y-auto' : ''}`}
          >
            {effectiveViewMode === 'list' ? (
              <>
              {showsLyricContext && (
                <div className="flex shrink-0 items-center justify-between px-0.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    <strong className="font-semibold text-slate-800 dark:text-slate-200">{songTotal}</strong> {searchBy === 'lyrics' ? 'songs' : 'song results'}
                    <span className="px-2 text-slate-300 dark:text-slate-600">·</span>
                    <strong className="font-semibold text-amber-700 dark:text-amber-300">{totalLyricMatches}</strong> lyric matches
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    {searchBy === 'lyrics' ? 'Search in lyrics' : 'Search in all fields'}
                  </span>
                </div>
              )}
              <div
                onScroll={handleLibraryScroll}
                className="flex-1 min-h-0 border border-slate-200/20 bg-surface rounded-lg shadow-sm overflow-y-auto select-none"
              >
                <table className="w-full border-collapse text-left text-xs table-fixed">
                  <thead>
                    <tr className="text-[11px] font-medium text-text/70 select-none">
                      <th 
                        onClick={() => {
                          if (sortColumn === 'title') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          else { setSortColumn('title'); setSortDirection('asc'); }
                        }}
                        className={`sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/80 border-r border-b border-slate-200/20 font-medium shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] ${showsLyricContext ? 'w-[55%]' : 'w-[45%]'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {tab === 'preset' ? 'Preset name' : isLyricSearchMode ? 'Song & lyric match' : showsLyricContext ? 'Item & matching context' : 'Title'}
                          {sortColumn === 'title' && (
                            <span className="text-slate-400">
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => {
                          if (sortColumn === 'detail') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          else { setSortColumn('detail'); setSortDirection('asc'); }
                        }}
                        className={`sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/80 border-r border-b border-slate-200/20 font-medium shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] ${showsLyricContext ? 'w-[22%]' : 'w-[25%]'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {tab === 'preset' ? 'Type / purpose' : 'Author'}
                          {sortColumn === 'detail' && (
                            <span className="text-slate-400">
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th 
                        onClick={() => {
                          if (showsLyricContext) return;
                          if (sortColumn === 'copyright') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                          else { setSortColumn('copyright'); setSortDirection('asc'); }
                        }}
                        className={`sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-r border-b border-slate-200/20 font-medium shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)] ${showsLyricContext ? 'w-[13%]' : 'w-[20%] cursor-pointer hover:bg-slate-200/60 dark:hover:bg-slate-700/80'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          {tab === 'preset' ? 'Family' : showsLyricContext ? 'Matches' : 'Copyright'}
                          {!showsLyricContext && sortColumn === 'copyright' && (
                            <span className="text-slate-400">
                              {sortDirection === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </th>
                      <th className="sticky top-0 z-10 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 border-b border-slate-200/20 w-28 text-right font-medium text-slate-400 select-none shadow-[inset_0_-1px_0_rgba(0,0,0,0.05)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/10">
                    {displayedTableItems.map((item, index) => {
                      const isSelected = item.type === 'song' 
                        ? libraryPreviewSong?.id === item.id 
                        : item.type === 'media'
                          ? libraryPreviewMedia?.id === item.id
                          : item.type === 'preset'
                            ? selectedPresetPreviewKey === `content-theme:${item.id}`
                            : selectedPresetPreviewKey === `screen-layout:${item.id}`;
                      const lyricMatches = item.lyricMatches || [];
                      const isLyricExpanded = expandedLyricSongIds.has(item.id);
                      const visibleLyricMatches = isLyricExpanded ? lyricMatches : lyricMatches.slice(0, 1);
                      const lyricOccurrenceCount = lyricMatches.reduce((total, match) => total + match.occurrenceCount, 0);
                          
                      return (
                        <tr
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          draggable={item.type !== 'screen-layout' && (item.type !== 'preset' || (item.originalPreset?.contentType || 'song') === 'song')}
                          onDragStart={(event) => {
                            if (item.type === 'song' && item.originalSong) {
                              event.dataTransfer.setData('application/json', JSON.stringify({ type: 'song', id: item.id, title: item.title }));
                            } else if (item.type === 'media' && item.originalMedia) {
                              const media = item.originalMedia;
                              event.dataTransfer.setData('application/json', JSON.stringify({
                                type: 'media',
                                id: media.id,
                                title: media.filename,
                                mediaType: media.mediaType,
                                filepath: media.filepath,
                                playbackSettings: media.playbackSettings,
                                duration: media.duration,
                              }));
                            } else if (item.type === 'preset' && item.originalPreset && (item.originalPreset.contentType || 'song') === 'song') {
                              event.dataTransfer.setData(SONG_PRESET_DRAG_TYPE, item.id);
                              event.dataTransfer.setData('application/json', JSON.stringify({
                                type: 'song-preset',
                                id: item.id,
                                name: item.title,
                              } satisfies SongPresetDragPayload));
                            }
                            event.dataTransfer.effectAllowed = 'copy';
                          }}
                          onDragEnd={resetPlaylistDragState}
                          onDragEnter={(event) => {
                            if (item.type === 'song' && event.dataTransfer.types.includes(SONG_PRESET_DRAG_TYPE)) {
                              setDragOverSongId(item.id);
                            }
                          }}
                          onDragLeave={(event) => {
                            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                              setDragOverSongId((current) => (current === item.id ? null : current));
                            }
                          }}
                          onDragOver={(event) => {
                            if (item.type === 'song' && event.dataTransfer.types.includes(SONG_PRESET_DRAG_TYPE)) {
                              event.preventDefault();
                              event.dataTransfer.dropEffect = 'copy';
                            }
                          }}
                          onDrop={(event) => {
                            if (item.type === 'song') handlePresetDropOnSong(event, item.id);
                          }}
                          onClick={() => {
                            if (item.type === 'song') {
                              void previewSong(item.id);
                            } else if (item.type === 'media' && item.originalMedia) {
                              previewMedia(item.originalMedia);
                            } else if (item.type === 'preset' && item.originalPreset) {
                              previewContentTheme(item.originalPreset);
                            } else if (item.type === 'screen-layout' && item.originalScreenLayout) {
                              previewScreenLayout(item.originalScreenLayout);
                            }
                          }}
                          onDoubleClick={() => {
                            if (item.type === 'song') {
                              void previewSong(item.id, true);
                            } else if (item.type === 'media' && item.originalMedia) {
                              previewMedia(item.originalMedia, true);
                            } else if (item.type === 'preset' && item.originalPreset) {
                              openPresetEditor({ kind: 'content-theme', id: item.id, name: item.title }, item.originalPreset);
                            } else if (item.type === 'screen-layout' && item.originalScreenLayout) {
                              openPresetEditor({ kind: 'screen-layout', id: item.id, name: item.title }, null, item.originalScreenLayout);
                            }
                          }}
                          onContextMenu={(event) => {
                            if (item.type === 'song') {
                              event.preventDefault();
                              setLibraryContextMenu({
                                x: event.clientX,
                                y: event.clientY,
                                songId: item.id
                              });
                            }
                          }}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer active:bg-slate-100 select-none group ${
                            dragOverSongId === item.id
                              ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-500'
                              : isSelected ? 'bg-indigo-50 hover:bg-indigo-100/60 dark:bg-indigo-900/30' : index % 2 === 1 ? 'bg-slate-50/30 dark:bg-slate-900/10' : ''
                          }`}
                        >
                          <td className={`border-r border-slate-200/10 text-slate-950 dark:text-slate-50 ${showsLyricContext ? 'px-4 py-3' : 'px-3 py-1.5 truncate font-bold'}`}>
                            <div className="font-bold">{item.title}</div>
                            {showsLyricContext && visibleLyricMatches.map((match, matchIndex) => (
                              <div
                                key={match.id}
                                className={`${matchIndex > 0 ? 'mt-2 border-t border-slate-200/60 pt-2 dark:border-slate-700/60' : 'mt-1.5'}`}
                              >
                                <div className="line-clamp-2 whitespace-pre-line text-[11px] font-medium leading-[1.45] text-slate-600 dark:text-slate-300">
                                  {match.excerpt.split('\n').map((line, lineIndex, lines) => (
                                    <span key={`${match.id}-${lineIndex}`}>
                                      <HighlightedLyric text={line} query={deferredQuery} />
                                      {lineIndex < lines.length - 1 && <br />}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </td>
                          <td className={`truncate border-r border-slate-200/10 text-slate-600 dark:text-slate-400 ${showsLyricContext ? 'px-4 py-3 align-top' : 'px-3 py-1.5'}`}>
                            {item.detail}
                          </td>
                          <td className={`border-r border-slate-200/10 text-slate-500 dark:text-slate-400 ${showsLyricContext ? 'px-4 py-3 align-top' : 'px-3 py-1.5 truncate'}`}>
                            {showsLyricContext && lyricOccurrenceCount > 0 ? (
                              <button
                                type="button"
                                title={lyricMatches.length > 1 ? (isLyricExpanded ? 'Collapse lyric matches' : 'Show all lyric matches') : 'One lyric match'}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (lyricMatches.length <= 1) return;
                                  setExpandedLyricSongIds((current) => {
                                    const next = new Set(current);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                className={`inline-flex items-center gap-1 rounded-md border border-amber-500/25 bg-amber-400/10 px-2 py-1 text-[10px] font-bold text-amber-700 transition active:scale-[0.98] dark:text-amber-300 ${lyricMatches.length > 1 ? 'hover:bg-amber-400/18' : 'cursor-default'}`}
                              >
                                {lyricOccurrenceCount} {lyricOccurrenceCount === 1 ? 'match' : 'matches'}
                                {lyricMatches.length > 1 && (
                                  <ChevronDown size={12} className={`transition-transform duration-200 ${isLyricExpanded ? 'rotate-180' : ''}`} />
                                )}
                              </button>
                            ) : showsLyricContext ? <span className="text-slate-300 dark:text-slate-600">—</span> : item.copyright}
                          </td>
                          <td className={`text-right font-medium text-slate-400 select-none ${showsLyricContext ? 'px-3 py-3 align-top' : 'px-3 py-1.5'}`}>
                            <span className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {item.type === 'song' && (
                                <button
                                  type="button"
                                  title="Edit song"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void (async () => {
                                      const songWithSlides = await ipcSongService.getById(item.id, primaryRole);
                                      onOpenSongEditor(songWithSlides);
                                    })();
                                  }}
                                  className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                                >
                                  <Edit3 size={14} />
                                </button>
                              )}
                              {item.type === 'preset' && item.originalPreset && (
                                <>
                                  <button
                                    type="button"
                                    title="Edit Content Theme"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openPresetEditor({ kind: 'content-theme', id: item.id, name: item.title }, item.originalPreset!);
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Delete Content Theme"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void deletePreset(item.originalPreset!);
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </>
                              )}
                              {item.type === 'screen-layout' && item.originalScreenLayout && (
                                <>
                                  <button
                                    type="button"
                                    title="Edit Screen Layout"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      openPresetEditor({ kind: 'screen-layout', id: item.id, name: item.title }, null, item.originalScreenLayout!);
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                  {!BUILTIN_SCREEN_LAYOUT_IDS.has(item.id) && (
                                    <button
                                      type="button"
                                      title="Delete Screen Layout"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        void deleteScreenLayout(item.originalScreenLayout!);
                                      }}
                                      className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </>
                              )}
                              {(item.type === 'song' || item.type === 'media') && (
                                <>
                                  <button
                                    type="button"
                                    title="Add to schedule"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (item.type === 'song') {
                                        void (async () => {
                                          const id = await addItem({ itemType: 'song', songId: item.id, content: item.title, duration: 1 });
                                          setSelectedItem(id);
                                        })();
                                      } else if (item.originalMedia) {
                                        void (async () => {
                                          const id = await addItem({ itemType: 'media', mediaId: item.id, content: item.title, duration: 1 });
                                          setSelectedItem(id);
                                        })();
                                      }
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                                  >
                                    <Plus size={14} />
                                  </button>
                                  <button
                                    type="button"
                                    title="Add tag"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (item.type === 'song' && item.originalSong) void addSongTag(item.originalSong);
                                      else if (item.originalMedia) void addMediaTag(item.originalMedia);
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-950"
                                  >
                                    <Tag size={14} />
                                  </button>
                                  {sidebarFilter.startsWith('playlist:') && (
                                    <button
                                      type="button"
                                      title="Remove from playlist"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        const plId = sidebarFilter.split(':')[1];
                                        setPlaylistsList(prev => prev.map(p => p.id === plId ? { ...p, itemIds: p.itemIds.filter(id => id !== item.id) } : p));
                                      }}
                                      className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    title={item.isFavorite ? 'Remove favorite' : 'Add favorite'}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      if (item.type === 'song' && item.originalSong) void toggleSongFavorite(item.originalSong);
                                      else if (item.originalMedia) void toggleMediaFavorite(item.originalMedia);
                                    }}
                                    className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-amber-500"
                                  >
                                    <Star size={16} className={item.isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
                                  </button>
                                </>
                              )}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {isLibraryPageLoading && displayedTableItems.length === 0 && Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`song-loading-${index}`} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-700" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" /></td>
                        <td className="px-4 py-3"><div className="h-3 w-1/4 rounded bg-slate-200 dark:bg-slate-700" /></td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))}
                    {displayedTableItems.length === 0 && !isLibraryPageLoading && (
                      <tr>
                        <td colSpan={4} className="h-40 px-6 text-center">
                          <div className="mx-auto flex max-w-sm flex-col items-center text-slate-400">
                            <Search size={22} className="mb-2 opacity-55" />
                            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                              {tab === 'preset' ? 'No presets match these filters' : isLyricSearchMode ? 'No matching lyrics found' : 'No library items found'}
                            </div>
                            <div className="mt-1 text-xs leading-relaxed">
                              {isLyricSearchMode
                                ? `Try another word or phrase instead of “${deferredQuery.trim()}”.`
                                : 'Try changing the search term or active filters.'}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              </>
            ) : effectiveViewMode === 'visual-list' ? (
              <div
                onScroll={handleLibraryScroll}
                className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm select-none dark:border-slate-700 dark:bg-slate-900"
              >
                <div
                  className="sticky top-0 z-10 grid border-b border-slate-200 bg-slate-100 px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500 shadow-[inset_0_-1px_0_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  style={{ gridTemplateColumns: visualListGridTemplate }}
                >
                  <span>Preview</span>
                  <span>Title & content</span>
                  <span>Creator / format</span>
                  <span className="text-right">Actions</span>
                </div>

                <div className="divide-y divide-slate-200/70 dark:divide-slate-700/70">
                  {displayedTableItems.map((item, index) => {
                    const isSelected = item.type === 'song'
                      ? libraryPreviewSong?.id === item.id
                      : item.type === 'media'
                        ? libraryPreviewMedia?.id === item.id
                        : item.type === 'preset'
                          ? selectedPresetPreviewKey === `content-theme:${item.id}`
                          : selectedPresetPreviewKey === `screen-layout:${item.id}`;
                    const media = item.originalMedia;
                    const song = item.originalSong;
                    const preset = item.originalPreset;
                    const screenLayout = item.originalScreenLayout;
                    const mediaUrl = media
                      ? toRenderableMediaUrl(media.thumbnail || (media.mediaType === 'image' ? media.filepath : ''))
                      : preset?.previewUrl
                        ? toRenderableMediaUrl(preset.previewUrl)
                        : '';
                    const songLines = String(song?.rawLyrics || '')
                      .split('\n')
                      .map((line) => line.trim())
                      .filter((line) => line && !/^\[.+\]$/.test(line))
                      .slice(0, 2);
                    const context = item.type === 'song'
                      ? songLines.join(' · ') || 'No lyrics available'
                      : item.type === 'media'
                        ? `${media?.mediaType || 'media'}${media?.duration ? ` · ${formatDuration(media.duration)}` : ''}`
                        : item.type === 'screen-layout'
                          ? `${screenLayout?.widgets.length || 0} widgets · ${screenLayout?.renderMode || 'layout'}`
                          : 'Reusable Content Theme';

                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        draggable={item.type !== 'screen-layout' && (item.type !== 'preset' || (preset?.contentType || 'song') === 'song')}
                        onDragStart={(event) => {
                          if (item.type === 'song' && song) {
                            event.dataTransfer.setData('application/json', JSON.stringify({ type: 'song', id: item.id, title: item.title }));
                          } else if (item.type === 'media' && media) {
                            event.dataTransfer.setData('application/json', JSON.stringify({
                              type: 'media',
                              id: media.id,
                              title: media.filename,
                              mediaType: media.mediaType,
                              filepath: media.filepath,
                              playbackSettings: media.playbackSettings,
                              duration: media.duration,
                            }));
                          } else if (item.type === 'preset' && preset && (preset.contentType || 'song') === 'song') {
                            event.dataTransfer.setData(SONG_PRESET_DRAG_TYPE, item.id);
                            event.dataTransfer.setData('application/json', JSON.stringify({ type: 'song-preset', id: item.id, name: item.title } satisfies SongPresetDragPayload));
                          }
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onDragEnd={resetPlaylistDragState}
                        onDragEnter={(event) => {
                          if (item.type === 'song' && event.dataTransfer.types.includes(SONG_PRESET_DRAG_TYPE)) setDragOverSongId(item.id);
                        }}
                        onDragLeave={(event) => {
                          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                            setDragOverSongId((current) => current === item.id ? null : current);
                          }
                        }}
                        onDragOver={(event) => {
                          if (item.type === 'song' && event.dataTransfer.types.includes(SONG_PRESET_DRAG_TYPE)) {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = 'copy';
                          }
                        }}
                        onDrop={(event) => {
                          if (item.type === 'song') handlePresetDropOnSong(event, item.id);
                        }}
                        onClick={() => {
                          if (item.type === 'song') void previewSong(item.id);
                          else if (item.type === 'media' && media) previewMedia(media);
                          else if (preset) previewContentTheme(preset);
                          else if (screenLayout) previewScreenLayout(screenLayout);
                        }}
                        onDoubleClick={() => {
                          if (item.type === 'song') void previewSong(item.id, true);
                          else if (item.type === 'media' && media) previewMedia(media, true);
                          else if (preset) openPresetEditor({ kind: 'content-theme', id: preset.id, name: preset.name }, preset);
                          else if (screenLayout) openPresetEditor({ kind: 'screen-layout', id: screenLayout.id, name: screenLayout.name }, null, screenLayout);
                        }}
                        onContextMenu={(event) => {
                          if (item.type !== 'song') return;
                          event.preventDefault();
                          setLibraryContextMenu({ x: event.clientX, y: event.clientY, songId: item.id });
                        }}
                        className={`group grid cursor-pointer items-center px-3 py-2 transition active:scale-[0.999] ${
                          dragOverSongId === item.id
                            ? 'bg-emerald-50 ring-2 ring-inset ring-emerald-500 dark:bg-emerald-900/20'
                            : isSelected
                              ? 'bg-indigo-50 shadow-[inset_3px_0_0_#6366f1] dark:bg-indigo-900/30'
                              : index % 2 === 1
                                ? 'bg-slate-50/45 hover:bg-slate-100/70 dark:bg-slate-800/25 dark:hover:bg-slate-800/60'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                        }`}
                        style={{ gridTemplateColumns: visualListGridTemplate, minHeight: visualRowMinHeight }}
                      >
                        <div
                          className="relative overflow-hidden rounded-md border border-slate-300 bg-slate-950 shadow-sm dark:border-slate-700"
                          style={{ width: visualThumbnailWidth, height: visualThumbnailHeight }}
                        >
                          {mediaUrl ? (
                            <img src={mediaUrl} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className={`absolute inset-0 ${item.type === 'song' ? 'bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.34),transparent_52%),linear-gradient(145deg,#020617,#1e1b4b)]' : item.type === 'screen-layout' ? 'bg-[radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.28),transparent_45%),linear-gradient(145deg,#111827,#334155)]' : 'bg-[linear-gradient(145deg,#111827,#374151)]'}`} />
                          )}
                          {item.type === 'song' && (
                            <div className="absolute inset-0 flex items-center justify-center p-1.5 text-center text-[5px] font-bold leading-tight text-white/90">
                              <span className="line-clamp-3">{songLines.join(' ') || item.title}</span>
                            </div>
                          )}
                          <span className="absolute bottom-1 right-1 rounded bg-slate-950/75 px-1 py-0.5 text-[6px] font-bold uppercase tracking-[0.08em] text-white/85">
                            {item.type}
                          </span>
                        </div>

                        <div className="min-w-0 pr-5">
                          <div className="truncate text-xs font-bold text-slate-950 dark:text-slate-50">{item.title}</div>
                          <div className="mt-1 truncate text-[10px] leading-tight text-slate-500 dark:text-slate-400">{context}</div>
                        </div>

                        <div className="min-w-0 pr-4">
                          <div className="truncate text-[11px] font-semibold text-slate-700 dark:text-slate-300">{item.detail}</div>
                          <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                            {item.type === 'preset' ? 'Content Theme' : item.type === 'screen-layout' ? 'Screen Layout' : item.type === 'media' ? media?.mediaType : 'Song'}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-0.5 opacity-55 transition-opacity group-hover:opacity-100">
                          {item.type === 'song' && (
                            <button
                              type="button"
                              title="Edit song"
                              onClick={(event) => {
                                event.stopPropagation();
                                void ipcSongService.getById(item.id, primaryRole).then(onOpenSongEditor);
                              }}
                              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                            >
                              <Edit3 size={13} />
                            </button>
                          )}
                          {item.type === 'preset' && preset && (
                            <>
                              <button
                                type="button"
                                title="Edit Content Theme"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPresetEditor({ kind: 'content-theme', id: preset.id, name: preset.name }, preset);
                                }}
                                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                              >
                                <Edit3 size={13} />
                              </button>
                              <button
                                type="button"
                                title="Delete Content Theme"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void deletePreset(preset);
                                }}
                                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          )}
                          {item.type === 'screen-layout' && screenLayout && (
                            <>
                              <button
                                type="button"
                                title="Edit Screen Layout"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPresetEditor({ kind: 'screen-layout', id: screenLayout.id, name: screenLayout.name }, null, screenLayout);
                                }}
                                className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-blue-600 dark:hover:bg-slate-700 dark:hover:text-blue-400"
                              >
                                <Edit3 size={13} />
                              </button>
                              {!BUILTIN_SCREEN_LAYOUT_IDS.has(screenLayout.id) && (
                                <button
                                  type="button"
                                  title="Delete Screen Layout"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void deleteScreenLayout(screenLayout);
                                  }}
                                  className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </>
                          )}
                          {(item.type === 'song' || item.type === 'media') && (
                            <button
                              type="button"
                              title="Add to schedule"
                              onClick={(event) => {
                                event.stopPropagation();
                                void (async () => {
                                  const id = item.type === 'song'
                                    ? await addItem({ itemType: 'song', songId: item.id, content: item.title, duration: 1 })
                                    : await addItem({ itemType: 'media', mediaId: item.id, content: item.title, duration: 1 });
                                  setSelectedItem(id);
                                })();
                              }}
                              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-indigo-600 dark:hover:bg-slate-700"
                            >
                              <Plus size={13} />
                            </button>
                          )}
                          {(item.type === 'song' || item.type === 'media') && (
                            <button
                              type="button"
                              title={item.isFavorite ? 'Remove favorite' : 'Add favorite'}
                              onClick={(event) => {
                                event.stopPropagation();
                                if (song) void toggleSongFavorite(song);
                                else if (media) void toggleMediaFavorite(media);
                              }}
                              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-white hover:text-amber-500 dark:hover:bg-slate-700"
                            >
                              <Star size={14} className={item.isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {isLibraryPageLoading && displayedTableItems.length === 0 && Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={`visual-list-loading-${index}`}
                      className="grid animate-pulse items-center px-3 py-2"
                      style={{ gridTemplateColumns: visualListGridTemplate, minHeight: visualRowMinHeight }}
                    >
                      <div className="rounded-md bg-slate-200 dark:bg-slate-700" style={{ width: visualThumbnailWidth, height: visualThumbnailHeight }} />
                      <div className="h-3 w-2/5 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="h-3 w-1/3 rounded bg-slate-200 dark:bg-slate-700" />
                      <div />
                    </div>
                  ))}

                  {displayedTableItems.length === 0 && !isLibraryPageLoading && (
                    <div className="flex h-40 items-center justify-center text-center">
                      <div className="text-slate-400">
                        <Search size={22} className="mx-auto mb-2 opacity-55" />
                        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">No library items found</div>
                        <div className="mt-1 text-xs">Try changing the search term or active filters.</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                className="grid gap-4 select-none pb-4"
                style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridThumbnailWidth}px, 1fr))` }}
              >
                {renderedSongs.map(({ song, isFavorite }) => {
                  const active = libraryPreviewSong?.id === song.id;
                  const lyrics = song.rawLyrics || '';
                  const firstLine = lyrics.split('\n')[0] || '';
                  const rest = lyrics.split('\n').slice(1, 3);
                  return (
                    <div
                      key={song.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/json', JSON.stringify({ type: 'song', id: song.id, title: song.title }));
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDragEnd={resetPlaylistDragState}
                      onDragEnter={(event) => {
                        if (event.dataTransfer.types.includes(SONG_PRESET_DRAG_TYPE)) {
                          setDragOverSongId(song.id);
                        }
                      }}
                      onDragLeave={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setDragOverSongId((current) => (current === song.id ? null : current));
                        }
                      }}
                      onDragOver={(event) => {
                        if (event.dataTransfer.types.includes(SONG_PRESET_DRAG_TYPE)) {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = 'copy';
                        }
                      }}
                      onDrop={(event) => handlePresetDropOnSong(event, song.id)}
                      onClick={() => void previewSong(song.id)}
                      onDoubleClick={() => void previewSong(song.id, true)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        setLibraryContextMenu({
                          x: event.clientX,
                          y: event.clientY,
                          songId: song.id
                        });
                      }}
                      className={`${active ? activeCardClass : cardClass} ${
                        dragOverSongId === song.id ? 'ring-2 ring-emerald-500 ring-offset-2' : ''
                      }`}
                      style={cardStyle}
                    >
                      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-slate-900">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.2),transparent_48%),linear-gradient(135deg,#020617,#1e1b4b)]" />
                        <span className="absolute bottom-2 right-2 rounded bg-indigo-500 px-1.5 py-0.5 font-mono text-xs font-bold text-white uppercase tracking-wider scale-[0.85] origin-bottom-right">SONG</span>
                        <div className="absolute inset-0 flex flex-col justify-end p-2.5 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent">
                          <p className="text-[10px] font-bold text-indigo-400 truncate uppercase tracking-wider">{song.author || 'Unknown Artist'}</p>
                          <p className="text-xs font-extrabold text-white truncate leading-tight mt-0.5">{song.title}</p>
                        </div>
                      </div>
                      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: 'minmax(0,1fr) auto' }}>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-medium text-slate-500 italic">{firstLine || '(No lyrics)'}</span>
                          <span className="mt-1 block truncate text-[10px] text-slate-400">{rest.join(' ')}</span>
                        </span>
                        <span className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit song"
                            onClick={(event) => {
                              event.stopPropagation();
                              void (async () => {
                                const songWithSlides = await ipcSongService.getById(song.id, primaryRole);
                                onOpenSongEditor(songWithSlides);
                              })();
                            }}
                            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-blue-600 dark:hover:text-blue-400"
                          >
                            <Edit3 size={14} />
                          </button>
                          <button
                            type="button"
                            title="Add to schedule"
                            onClick={(event) => {
                              event.stopPropagation();
                              void (async () => {
                                const id = await addItem({ itemType: 'song', songId: song.id, content: song.title, duration: 1 });
                                setSelectedItem(id);
                              })();
                            }}
                            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                          >
                            <Plus size={14} />
                          </button>
                          <button type="button" title="Add tag" onClick={(event) => { event.stopPropagation(); void addSongTag(song); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-950">
                            <Tag size={14} />
                          </button>
                          {sidebarFilter.startsWith('playlist:') && (
                            <button
                              type="button"
                              title="Remove from playlist"
                              onClick={(event) => {
                                event.stopPropagation();
                                const plId = sidebarFilter.split(':')[1];
                                setPlaylistsList(prev => prev.map(p => p.id === plId ? { ...p, itemIds: p.itemIds.filter(id => id !== song.id) } : p));
                              }}
                              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <button type="button" title={isFavorite ? 'Remove favorite' : 'Add favorite'} onClick={(event) => { event.stopPropagation(); void toggleSongFavorite(song); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-amber-500">
                            <Star size={16} className={isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {renderedMedia.map(({ media, isFavorite }) => {
                  const active = libraryPreviewMedia?.id === media.id;
                  const isImage = media.mediaType === 'image';
                  const isVideo = media.mediaType === 'video';
                  const isPdf = media.mediaType === 'pdf';
                  const isAudio = media.mediaType === 'audio';
                  const isYoutube = media.mediaType === 'youtube';
                  const mediaUrl = toRenderableMediaUrl(media.filepath);
                  return (
                    <div
                      key={media.id}
                      role="button"
                      tabIndex={0}
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData('application/json', JSON.stringify({
                          type: 'media',
                          id: media.id,
                          title: media.filename,
                          mediaType: media.mediaType,
                          filepath: media.filepath,
                          playbackSettings: media.playbackSettings,
                          duration: media.duration,
                        }));
                        event.dataTransfer.effectAllowed = 'copy';
                      }}
                      onDragEnd={resetPlaylistDragState}
                      onClick={() => previewMedia(media)}
                      onDoubleClick={() => previewMedia(media, true)}
                      className={active ? activeCardClass : cardClass}
                      style={cardStyle}
                    >
                      <div className="relative aspect-video overflow-hidden rounded-t-lg bg-slate-950 flex items-center justify-center">
                        {isImage && (
                          <img src={mediaUrl} alt={media.filename} className="h-full w-full object-cover" />
                        )}
                        {isVideo && (
                          <video src={mediaUrl} className="h-full w-full object-cover" muted playsInline />
                        )}
                        {isYoutube && (
                          <div className="relative h-full w-full bg-slate-950 flex items-center justify-center">
                            {media.thumbnail ? (
                              <img src={media.thumbnail} alt={media.filename} className="h-full w-full object-cover" />
                            ) : null}
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-1 text-red-400">
                              <Globe size={24} />
                              <span className="text-[9px] font-bold text-white tracking-widest uppercase">YouTube</span>
                            </div>
                          </div>
                        )}
                        {isPdf && (
                          <div className="flex flex-col items-center gap-1.5 text-slate-400">
                            <Presentation size={24} />
                            <span className="text-[10px] font-bold">PDF Presentation</span>
                          </div>
                        )}
                        {isAudio && (
                          <div className="flex flex-col items-center gap-1.5 text-slate-400">
                            <Music2 size={24} />
                            <span className="text-[10px] font-bold">Audio Track</span>
                          </div>
                        )}
                        <span className={`absolute bottom-2 right-2 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold text-white uppercase tracking-wider scale-[0.85] origin-bottom-right ${isYoutube ? 'bg-red-600' : 'bg-indigo-500'}`}>
                          {media.mediaType}
                        </span>
                      </div>
                      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: 'minmax(0,1fr) 56px' }}>
                        <span className="min-w-0">
                          <span className="block truncate text-xs font-bold text-slate-900 leading-tight">{media.filename}</span>
                          <span className="mt-1 block truncate text-[10px] text-slate-400">
                            {isVideo && media.duration ? formatDuration(media.duration) : media.mediaType}
                          </span>
                        </span>
                        <span className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Add to schedule"
                            onClick={(event) => {
                              event.stopPropagation();
                              void (async () => {
                                const id = await addItem({ itemType: 'media', mediaId: media.id, content: media.filename || null, duration: 1 });
                                setSelectedItem(id);
                              })();
                            }}
                            className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-indigo-600"
                          >
                            <Plus size={14} />
                          </button>
                          <button type="button" title="Add tag" onClick={(event) => { event.stopPropagation(); void addMediaTag(media); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-950">
                            <Tag size={14} />
                          </button>
                          {sidebarFilter.startsWith('playlist:') && (
                            <button
                              type="button"
                              title="Remove from playlist"
                              onClick={(event) => {
                                event.stopPropagation();
                                const plId = sidebarFilter.split(':')[1];
                                setPlaylistsList(prev => prev.map(p => p.id === plId ? { ...p, itemIds: p.itemIds.filter(id => id !== media.id) } : p));
                              }}
                              className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          <button type="button" title={isFavorite ? 'Remove favorite' : 'Add favorite'} onClick={(event) => { event.stopPropagation(); void toggleMediaFavorite(media); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-amber-500">
                            <Star size={16} className={isFavorite ? 'fill-amber-400 text-amber-400' : ''} />
                          </button>
                        </span>
                      </div>
                    </div>
                  );
                })}

                {renderedPresets.map(({ preset }) => (
                  <div
                    key={preset.id}
                    draggable={(preset.contentType || 'song') === 'song'}
                    onDragStart={(event) => {
                      if ((preset.contentType || 'song') !== 'song') {
                        event.preventDefault();
                        return;
                      }
                      event.dataTransfer.setData(SONG_PRESET_DRAG_TYPE, preset.id);
                      event.dataTransfer.setData('application/json', JSON.stringify({
                        type: 'song-preset',
                        id: preset.id,
                        name: preset.name,
                      } satisfies SongPresetDragPayload));
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onDragEnd={resetPlaylistDragState}
                    className={`${cardClass} ${(preset.contentType || 'song') === 'song' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${selectedPresetPreviewKey === `content-theme:${preset.id}` ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
                    style={cardStyle}
                    title={(preset.contentType || 'song') === 'song' ? 'Drag this Content Theme onto a song to apply it' : `${preset.contentType || 'Content'} Theme`}
                    onClick={() => previewContentTheme(preset)}
                    onDoubleClick={() => openPresetEditor({ kind: 'content-theme', id: preset.id, name: preset.name }, preset)}
                  >
                    <div className="relative aspect-video overflow-hidden rounded-t-lg bg-slate-900">
                      {preset.previewUrl ? (
                        <img
                          src={toRenderableMediaUrl(preset.previewUrl)}
                          alt={`${preset.name} thumbnail`}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <>
                          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.24),transparent_36%),linear-gradient(135deg,#020617,#334155)]" />
                          <span className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl bg-slate-950/25 text-white/75 backdrop-blur-sm">
                            <Sparkles size={23} />
                          </span>
                        </>
                      )}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/55 to-transparent" />
                      <span className="absolute bottom-2 right-2 rounded bg-emerald-500 px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-white">{preset.contentType || 'song'}</span>
                    </div>
                    <div className="grid gap-2 p-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) 56px' }}>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-slate-950">{preset.name}</span>
                        <span className="mt-1 block truncate text-xs text-slate-500">{preset.category || 'Content Theme'}</span>
                      </span>
                      <span className="flex items-center justify-end gap-1">
                        <button type="button" title="Edit Content Theme" onClick={(event) => { event.stopPropagation(); openPresetEditor({ kind: 'content-theme', id: preset.id, name: preset.name }, preset); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950">
                          <Edit3 size={14} />
                        </button>
                        <button type="button" title="Delete Content Theme" onClick={(event) => { event.stopPropagation(); void deletePreset(preset); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}

                {renderedScreenLayouts.map(({ layout }) => {
                  const isBuiltin = BUILTIN_SCREEN_LAYOUT_IDS.has(layout.id);
                  return (
                    <div
                      key={layout.id}
                      className={`${cardClass} cursor-pointer ${selectedPresetPreviewKey === `screen-layout:${layout.id}` ? 'ring-2 ring-inset ring-indigo-500' : ''}`}
                      style={cardStyle}
                      title={`${layout.purpose} Screen Layout · ${layout.widgets.length} widgets`}
                      onClick={() => previewScreenLayout(layout)}
                      onDoubleClick={() => {
                        openPresetEditor({ kind: 'screen-layout', id: layout.id, name: layout.name }, null, layout);
                      }}
                    >
                      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-t-lg bg-slate-900">
                        {layout.thumbnail ? (
                          <img
                            src={toRenderableMediaUrl(layout.thumbnail)}
                            alt={`${layout.name} thumbnail`}
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                        ) : (
                          <>
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.3),transparent_42%),linear-gradient(145deg,#111827,#334155)]" />
                            <div className="relative grid h-12 w-12 place-items-center rounded-xl border border-white/10 bg-slate-950/25 text-white/80 backdrop-blur-sm">
                              <ScreenShare size={23} />
                            </div>
                          </>
                        )}
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-slate-950/55 to-transparent" />
                        <span className="absolute bottom-2 right-2 rounded bg-amber-500 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-slate-950">{layout.purpose}</span>
                        {isBuiltin && <span className="absolute left-2 top-2 rounded border border-white/10 bg-slate-950/55 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-white/70">Built-in</span>}
                      </div>
                      <div className="grid gap-2 p-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) 56px' }}>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-bold text-slate-950">{layout.name}</span>
                          <span className="mt-1 block truncate text-xs text-slate-500">{layout.role} · {layout.widgets.length} widgets</span>
                        </span>
                        <span className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="Edit Screen Layout"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPresetEditor({ kind: 'screen-layout', id: layout.id, name: layout.name }, null, layout);
                            }}
                            className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-950"
                          >
                            <Edit3 size={14} />
                          </button>
                          {!isBuiltin && (
                            <button type="button" title="Delete Screen Layout" onClick={(event) => { event.stopPropagation(); void deleteScreenLayout(layout); }} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {emptyLibrary && !isLibraryPageLoading && (
                  <div className="col-span-full flex h-36 items-center justify-center rounded-lg border border-dashed border-slate-200 text-sm font-semibold text-slate-400">
                    No library items match the current filters.
                  </div>
                )}
              </div>
            )}
          </div>

        )}
      </div>
      {(editingPreset || editingScreenLayout || isCreatingPreset) && (
        <SongPresetEditorModal
          template={editingPreset}
          outputPreset={editingScreenLayout}
          initialPresetType={
            editingScreenLayout || (isCreatingPreset && presetFamilyFilter === 'screen-layout')
              ? 'output'
              : editingPreset || (isCreatingPreset && presetFamilyFilter === 'content-theme')
                ? 'song'
                : undefined
          }
          onClose={() => {
            setEditingPreset(null);
            setEditingScreenLayout(null);
            setIsCreatingPreset(false);
          }}
          onSaved={() => void loadLibrary()}
        />
      )}
      {isBibleSettingsOpen && (
        <BibleSettingsModal onClose={() => setIsBibleSettingsOpen(false)} />
      )}
      {isAddOnlineOpen && (
        <AddOnlineMediaModal
          onClose={() => setIsAddOnlineOpen(false)}
          onSuccess={() => void loadLibrary()}
        />
      )}
      {libraryContextMenu && (
        <div
          className="fixed z-[9999] min-w-[140px] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-[0_4px_12px_rgba(15,23,42,0.15)] dark:border-slate-800 dark:bg-slate-900"
          style={{ top: libraryContextMenu.y, left: libraryContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => {
              const songId = libraryContextMenu.songId;
              setLibraryContextMenu(null);
              void (async () => {
                const songWithSlides = await ipcSongService.getById(songId, primaryRole);
                onOpenSongEditor(songWithSlides);
              })();
            }}
            className="flex w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
          >
            <Edit3 size={14} />
            <span>Edit Song</span>
          </button>
        </div>
      )}
    </section>
  );
}

export default function ControllerView() {
  const {
    currentSchedule,
    selectedItemId,
    libraryPreviewSong,
    libraryPreviewMedia,
    libraryPreviewMode,
    refreshPresetDrivenSongs,
    loadSchedule,
    loadSchedules,
    setSelectedItem,
    setLibraryPreviewSong,
    setLibraryPreviewMedia,
    setLibraryPreviewMode,
  } = useScheduleStore();
  const { activeView, isSettingsOpen, closeSettings, setActiveView } = useUIStore();
  const {
    currentSlide,
    previewSlide,
    isBlack,
    isClear,
    isLogo,
    setPreviewSlide,
    goLive,
    setBlack,
    setClear,
    setLogo,
  } = usePresentationStore();
  const { commands: hotkeyCommands } = useHotkeysStore();
  const slideLabels = useSlideLabelSettingsStore((state) => state.labels);
  const restoreLastRundown = useGeneralSettingsStore((state) => state.restoreLastRundown);
  const defaultKeyboardFocus = useGeneralSettingsStore((state) => state.defaultKeyboardFocus);
  
  const primaryRole = useSettingsStore((state) => state.outputs.find((output) => output.enabled && output.isPrimary)?.role || 'audience');
  const toast = useToast();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showScheduleManager, setShowScheduleManager] = useState(false);
  const [editorSong, setEditorSong] = useState<SongWithSlides | null>(null);
  const [isSongEditorOpen, setIsSongEditorOpen] = useState(false);
  const [libraryRefreshToken, setLibraryRefreshToken] = useState(0);

  useEffect(() => {
    void (async () => {
      await loadSchedules();
      if (!restoreLastRundown) return;
      const lastRundownId = localStorage.getItem(LAST_RUNDOWN_KEY);
      if (!lastRundownId) return;
      const exists = useScheduleStore.getState().schedules.some((schedule) => schedule.id === lastRundownId);
      if (exists) await loadSchedule(lastRundownId);
      else localStorage.removeItem(LAST_RUNDOWN_KEY);
    })();
  }, [loadSchedule, loadSchedules, restoreLastRundown]);

  const selectedItem = useMemo(
    () => currentSchedule?.items.find((item) => item.id === selectedItemId) || null,
    [currentSchedule, selectedItemId],
  );
  const slides = useMemo(
    () => getSelectedSlides(selectedItem, libraryPreviewSong, libraryPreviewMedia),
    [selectedItem, libraryPreviewSong, libraryPreviewMedia],
  );

  const [liveItem, setLiveItem] = useState<any>(null);
  const [libraryLiveSong, setLibraryLiveSong] = useState<SongWithSlides | null>(null);
  const [libraryLiveMedia, setLibraryLiveMedia] = useState<Media | null>(null);
  const [keyboardFocus, setKeyboardFocus] = useState<'preview' | 'live'>(defaultKeyboardFocus);

  useEffect(() => setKeyboardFocus(defaultKeyboardFocus), [defaultKeyboardFocus]);

  useEffect(() => {
    if (libraryPreviewMode === 'liveControl') {
      setKeyboardFocus('live');
      if (selectedItem) {
        setLiveItem(selectedItem);
        setLibraryLiveSong(null);
        setLibraryLiveMedia(null);
      } else if (libraryPreviewSong) {
        setLibraryLiveSong(libraryPreviewSong);
        setLiveItem(null);
        setLibraryLiveMedia(null);
      } else if (libraryPreviewMedia) {
        setLibraryLiveMedia(libraryPreviewMedia);
        setLiveItem(null);
        setLibraryLiveSong(null);
      }
    }
  }, [libraryPreviewMode, selectedItemId, libraryPreviewSong, libraryPreviewMedia, selectedItem]);

  const liveSlides = useMemo(
    () => getSelectedSlides(liveItem, libraryLiveSong, libraryLiveMedia),
    [liveItem, libraryLiveSong, libraryLiveMedia],
  );

  useEffect(() => {
    const liveSource = liveItem || libraryLiveSong || libraryLiveMedia || selectedItem;
    const getItemTitle = (item: any) => (
      item?.songData?.title || item?.mediaData?.filename || item?.title || item?.content || 'Untitled item'
    );
    const context: RemoteControllerContext = {
      revision: Date.now(),
      activeSchedule: currentSchedule
        ? { id: currentSchedule.id, name: currentSchedule.name, isTemporary: currentSchedule.id === TEMP_SCHEDULE_ID }
        : null,
      currentItem: liveSource
        ? {
            id: liveSource.id,
            title: getItemTitle(liveSource),
            itemType: liveSource.itemType || (libraryLiveSong ? 'song' : libraryLiveMedia ? 'media' : 'custom'),
          }
        : null,
      selectedItemId,
      slides: liveSlides.map((slide: any, index: number) => ({
        id: slide.id,
        label: getSlideLabel(slide, index),
        content: slide.content || '',
      })),
      currentSlideId: currentSlide?.id || null,
      rundown: (currentSchedule?.items || []).map((item: any) => ({
        id: item.id,
        title: getItemTitle(item),
        subtitle: item.songData?.author || item.mediaData?.mediaType || null,
        itemType: item.itemType || 'custom',
        isSelected: item.id === selectedItemId,
        isLive: item.id === liveItem?.id,
      })),
    };
    sync.broadcast('REMOTE_CONTEXT_UPDATE', context);
  }, [
    currentSchedule,
    selectedItemId,
    selectedItem,
    liveItem,
    libraryLiveSong,
    libraryLiveMedia,
    liveSlides,
    currentSlide?.id,
  ]);

  useEffect(() => {
    return sync.subscribe('REMOTE_COMMAND', (rawCommand) => {
      const command = rawCommand as RemoteCommand;
      const run = async () => {
        switch (command.type) {
          case 'next-slide': {
            const currentIndex = liveSlides.findIndex((slide: any) => slide.id === currentSlide?.id);
            const target = currentIndex >= 0 ? liveSlides[currentIndex + 1] : liveSlides[0];
            if (target) await goLive(target as any);
            break;
          }
          case 'previous-slide': {
            const currentIndex = liveSlides.findIndex((slide: any) => slide.id === currentSlide?.id);
            if (currentIndex > 0) await goLive(liveSlides[currentIndex - 1] as any);
            break;
          }
          case 'go-to-slide': {
            const target = liveSlides.find((slide: any) => slide.id === command.payload?.slideId);
            if (!target) throw new Error('Slide not found');
            await goLive(target as any);
            break;
          }
          case 'toggle-black':
            setBlack(!usePresentationStore.getState().isBlack);
            break;
          case 'toggle-clear':
            setClear(!usePresentationStore.getState().isClear);
            break;
          case 'toggle-logo':
            setLogo(!usePresentationStore.getState().isLogo);
            break;
          case 'select-item': {
            const state = useScheduleStore.getState();
            const item = state.currentSchedule?.items.find((entry) => entry.id === command.payload?.itemId);
            if (!item) throw new Error('Rundown item not found');
            state.setSelectedItem(item.id, 'liveControl');
            const itemSlides = getSelectedSlides(item, null, null);
            if (itemSlides[0]) await goLive(itemSlides[0] as any);
            break;
          }
          case 'add-song': {
            const songId = command.payload?.songId;
            if (!songId) throw new Error('Song ID is required');
            const song = await ipcSongService.getById(songId, primaryRole);
            if (!song) throw new Error('Song not found');
            const stateBefore = useScheduleStore.getState();
            const nextId = await stateBefore.addItem({
              itemType: 'song',
              songId,
              orderIndex: stateBefore.currentSchedule?.items.length || 0,
            });
            if (command.payload?.position === 'after-current') {
              const stateAfter = useScheduleStore.getState();
              const items = stateAfter.currentSchedule?.items || [];
              const anchorId = liveItem?.id || stateAfter.selectedItemId;
              const anchorIndex = items.findIndex((item) => item.id === anchorId);
              if (anchorIndex >= 0) {
                const ids = items.filter((item) => item.id !== nextId).map((item) => item.id);
                ids.splice(anchorIndex + 1, 0, nextId);
                await stateAfter.reorderItems(ids);
              }
            }
            setLibraryRefreshToken((current) => current + 1);
            toast.success(`“${song.title}” added to rundown.`);
            break;
          }
        }
      };
      void run()
        .then(() => {
          sync.broadcast('REMOTE_COMMAND_RESULT', { commandId: command.commandId, ok: true });
        })
        .catch((error) => {
          const message = (error as Error).message || 'Remote command failed.';
          console.error('[Remote] Command failed:', error);
          toast.error(message);
          sync.broadcast('REMOTE_COMMAND_RESULT', { commandId: command.commandId, ok: false, error: message });
        });
    });
  }, [
    currentSlide?.id,
    liveSlides,
    liveItem?.id,
    primaryRole,
    goLive,
    setBlack,
    setClear,
    setLogo,
    toast,
  ]);

  useEffect(() => {
    return window.api?.appMenu?.onCommand((command) => {
      const presentation = usePresentationStore.getState();
      if (command === 'toggle-black') {
        presentation.setBlack(!presentation.isBlack);
      } else if (command === 'toggle-clear') {
        presentation.setClear(!presentation.isClear);
      } else if (command === 'toggle-logo') {
        if (useSettingsStore.getState().logoOutput.mediaId) {
          presentation.setLogo(!presentation.isLogo);
        } else {
          toast.info('Configure a logo in Settings before enabling Logo Output.');
        }
      }
    }) ?? (() => {});
  }, [toast]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Check if user is typing in an input field
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.getAttribute('contenteditable') === 'true'
      );
      if (isInput) return;

      // Parse the keyboard combination
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey) parts.push('Meta');

      const key = e.key;
      if (key !== 'Control' && key !== 'Shift' && key !== 'Alt' && key !== 'Meta') {
        let keyName = key;
        if (keyName === ' ') keyName = 'Space';
        
        if (keyName === 'ArrowRight') keyName = 'ArrowRight';
        if (keyName === 'ArrowLeft') keyName = 'ArrowLeft';
        if (keyName === 'ArrowUp') keyName = 'ArrowUp';
        if (keyName === 'ArrowDown') keyName = 'ArrowDown';
        
        if (keyName.length === 1) keyName = keyName.toUpperCase();
        parts.push(keyName);
      }

      const keyCombination = parts.join('+');
      if (!keyCombination) return;

      // Find matching hotkey command
      const cmd = hotkeyCommands.find(c => c.keybinding === keyCombination);
      const slideLabelCommand = slideLabels.find((item) => item.shortcut && item.shortcut.toUpperCase() === keyCombination.toUpperCase());
      if (!cmd && !slideLabelCommand) return;

      // We found a match, prevent default browser behavior
      e.preventDefault();
      e.stopPropagation();

      const activeFocus = keyboardFocus;

      if (!cmd && slideLabelCommand) {
        const list = activeFocus === 'live' ? liveSlides : slides;
        const target = list.find((slide: any) => findSlideLabel([slideLabelCommand], slide)?.id === slideLabelCommand.id);
        if (target) {
          if (activeFocus === 'live') goLive(target);
          else setPreviewSlide(target);
        }
        return;
      }

      if (!cmd) return;

      if (cmd.id === 'next-slide' || cmd.id === 'live-next-slide') {
        if (activeFocus === 'live') {
          if (currentSlide && liveSlides.length > 0) {
            const currentIndex = liveSlides.findIndex((s: any) => s.id === currentSlide.id);
            if (currentIndex >= 0 && currentIndex < liveSlides.length - 1) {
              goLive(liveSlides[currentIndex + 1]);
            }
          } else if (liveSlides.length > 0) {
            goLive(liveSlides[0]);
          }
        } else {
          // preview focus
          const activeSlide = previewSlide || (slides.length > 0 ? slides[0] : null);
          if (activeSlide) {
            const currentIndex = slides.findIndex((s: any) => s.id === activeSlide.id);
            if (currentIndex >= 0 && currentIndex < slides.length - 1) {
              setPreviewSlide(slides[currentIndex + 1]);
            }
          }
        }
      } else if (cmd.id === 'prev-slide' || cmd.id === 'live-prev-slide') {
        if (activeFocus === 'live') {
          if (currentSlide && liveSlides.length > 0) {
            const currentIndex = liveSlides.findIndex((s: any) => s.id === currentSlide.id);
            if (currentIndex > 0) {
              goLive(liveSlides[currentIndex - 1]);
            }
          }
        } else {
          // preview focus
          const activeSlide = previewSlide || (slides.length > 0 ? slides[0] : null);
          if (activeSlide) {
            const currentIndex = slides.findIndex((s: any) => s.id === activeSlide.id);
            if (currentIndex > 0) {
              setPreviewSlide(slides[currentIndex - 1]);
            }
          }
        }
      } else if (cmd.id === 'go-live') {
        if (previewSlide) {
          goLive(previewSlide);
          setLibraryPreviewMode('liveControl');
          setKeyboardFocus('live');
          
          if (selectedItem) {
            setSelectedItem(selectedItem.id, 'liveControl');
          } else if (libraryPreviewSong) {
            setLibraryPreviewSong(libraryPreviewSong, 'liveControl');
          } else if (libraryPreviewMedia) {
            setLibraryPreviewMedia(libraryPreviewMedia, 'liveControl');
          }
          window.dispatchEvent(new CustomEvent('rumedia:focus-live-preview'));
        }
      } else if (cmd.id === 'toggle-black') {
        setBlack(!isBlack);
      } else if (cmd.id === 'toggle-clear') {
        setClear(!isClear);
      } else if (cmd.id === 'toggle-logo') {
        if (useSettingsStore.getState().logoOutput.mediaId) setLogo(!isLogo);
      } else if (cmd.id === 'next-item') {
        const items = currentSchedule?.items || [];
        const curIndex = items.findIndex(item => item.id === selectedItemId);
        if (curIndex >= 0 && curIndex < items.length - 1) {
          const nextItem = items[curIndex + 1];
          setSelectedItem(nextItem.id, libraryPreviewMode);
          const nextSlides = getSelectedSlides(nextItem, null, null);
          if (nextSlides[0]) {
            setPreviewSlide(nextSlides[0]);
            if (libraryPreviewMode === 'liveControl') {
              goLive(nextSlides[0]);
              setKeyboardFocus('live');
            }
          }
        }
      } else if (cmd.id === 'prev-item') {
        const items = currentSchedule?.items || [];
        const curIndex = items.findIndex(item => item.id === selectedItemId);
        if (curIndex > 0) {
          const prevItem = items[curIndex - 1];
          setSelectedItem(prevItem.id, libraryPreviewMode);
          const prevSlides = getSelectedSlides(prevItem, null, null);
          if (prevSlides[0]) {
            setPreviewSlide(prevSlides[0]);
            if (libraryPreviewMode === 'liveControl') {
              goLive(prevSlides[0]);
              setKeyboardFocus('live');
            }
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [
    hotkeyCommands,
    slideLabels,
    slides,
    liveSlides,
    previewSlide,
    currentSlide,
    libraryPreviewMode,
    isBlack,
    isClear,
    isLogo,
    currentSchedule,
    selectedItemId,
    selectedItem,
    libraryPreviewSong,
    libraryPreviewMedia,
    goLive,
    setPreviewSlide,
    setBlack,
    setClear,
    setLogo,
    setSelectedItem,
    setLibraryPreviewSong,
    setLibraryPreviewMedia,
    setLibraryPreviewMode,
    setActiveView,
    keyboardFocus
  ]);

  const handleSongSaved = () => {
    setLibraryRefreshToken((current) => current + 1);
    if (currentSchedule?.id) void loadSchedule(currentSchedule.id);
  };

  const openSongEditor = (song: SongWithSlides | null) => {
    if (window.api?.workspaceWindow) {
      void window.api.workspaceWindow.open({
        kind: 'song-editor',
        id: song?.id || null,
        name: song?.title || null,
      }).catch(() => {
        setEditorSong(song);
        setIsSongEditorOpen(true);
      });
      return;
    }
    setEditorSong(song);
    setIsSongEditorOpen(true);
  };

  const resolveDraggedMedia = async (payload: LibraryMediaDragPayload) => {
    if (payload.mediaType && payload.filepath) {
      return {
        id: payload.id,
        filename: payload.title || payload.id,
        filepath: payload.filepath,
        mediaType: payload.mediaType,
        playbackSettings: payload.playbackSettings || null,
        duration: payload.duration || null,
      } as Media;
    }

    const mediaItems = await ipcMediaService.getAll();
    return mediaItems.find((item) => item.id === payload.id) || null;
  };

  const handleApplyMediaToSongSlides = async (payload: LibraryMediaDragPayload, slideId?: string, explicitSongId?: string) => {
    const songId = explicitSongId || (selectedItem?.itemType === 'song'
      ? selectedItem.songId || selectedItem.songData?.id
      : libraryPreviewSong?.id);
    if (!songId) return;

    const media = await resolveDraggedMedia(payload);
    if (!media || !['image', 'video'].includes(media.mediaType)) {
      toast.warning('Only image and video media can be applied to song slides.');
      return;
    }

    try {
      const song = await ipcSongService.getById(songId, primaryRole);
      if (!song?.slides?.length) return;

      const targetSlideIds = new Set(slideId ? [slideId] : song.slides.map((slide) => slide.id));
      const nextSlides = song.slides.map((slide) => (
        targetSlideIds.has(slide.id) ? applyMediaBackgroundToSlide(slide, media) : slide
      ));

      await ipcSongService.update(songId, { slides: nextSlides });
      await refreshPresetDrivenSongs();

      const refreshedSong = await ipcSongService.getById(songId, primaryRole);
      const refreshedSlide = refreshedSong?.slides?.find((slide) => slide.id === (slideId || song.slides[0]?.id));
      const selectedSongId = selectedItem?.itemType === 'song'
        ? selectedItem.songId || selectedItem.songData?.id
        : libraryPreviewSong?.id;
      if (refreshedSlide && (!explicitSongId || selectedSongId === explicitSongId)) {
        setPreviewSlide(refreshedSlide as any);
      }
      toast.success(slideId ? 'Background applied to slide.' : 'Background applied to all song slides.');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to apply background.');
    }
  };

  const handleApplyMediaToRundownSong = async (item: any, payload: LibraryMediaDragPayload) => {
    const songId = item?.itemType === 'song' ? item.songId || item.songData?.id : null;
    if (!songId) {
      toast.warning('Media backgrounds can only be dropped onto song items.');
      return;
    }

    await handleApplyMediaToSongSlides(payload, undefined, songId);
  };

  const handleClearMediaFromSongSlides = async (slideId?: string) => {
    const songId = selectedItem?.itemType === 'song'
      ? selectedItem.songId || selectedItem.songData?.id
      : libraryPreviewSong?.id;
    if (!songId) return;

    try {
      const song = await ipcSongService.getById(songId, primaryRole);
      if (!song?.slides?.length) return;

      const targetSlideIds = new Set(slideId ? [slideId] : song.slides.map((slide) => slide.id));
      const nextSlides = song.slides.map((slide) => (
        targetSlideIds.has(slide.id) ? clearMediaBackgroundFromSlide(slide) : slide
      ));

      await ipcSongService.update(songId, { slides: nextSlides });
      await refreshPresetDrivenSongs();

      const refreshedSong = await ipcSongService.getById(songId, primaryRole);
      const refreshedSlide = refreshedSong?.slides?.find((slide) => slide.id === (slideId || song.slides[0]?.id));
      if (refreshedSlide) setPreviewSlide(refreshedSlide as any);
      toast.success(slideId ? 'Slide background cleared.' : 'All song backgrounds cleared.');
    } catch (error) {
      toast.error((error as Error).message || 'Failed to clear background.');
    }
  };

  useEffect(() => {
    const handleTemplatesChanged = () => {
      setLibraryRefreshToken((current) => current + 1);
      void refreshPresetDrivenSongs();
    };

    const handleDetachedPresetSaved = () => {
      setLibraryRefreshToken((current) => current + 1);
      void useSettingsStore.getState().hydrateSettings();
      void refreshPresetDrivenSongs();
    };

    const handleDetachedWorkspaceSaved = (payload: { kind: 'song' | 'settings' | 'bible-settings'; id?: string | null }) => {
      handleSongSaved();
      if (payload.kind === 'settings' || payload.kind === 'bible-settings') {
        void useSettingsStore.getState().hydrateSettings();
        void refreshPresetDrivenSongs();
      }
    };

    window.addEventListener('rumedia:templates-changed', handleTemplatesChanged);
    const unsubscribePresetEditor = window.api?.presetEditor?.onSaved(handleDetachedPresetSaved);
    const unsubscribeWorkspaceWindow = window.api?.workspaceWindow?.onSaved(handleDetachedWorkspaceSaved);
    return () => {
      window.removeEventListener('rumedia:templates-changed', handleTemplatesChanged);
      unsubscribePresetEditor?.();
      unsubscribeWorkspaceWindow?.();
    };
  }, [refreshPresetDrivenSongs]);

  return (
    <div className="theme-scope flex h-[100dvh] min-w-[1180px] flex-col overflow-hidden bg-background text-text">
      <div className="flex min-h-0 flex-1">
        <Group orientation="vertical" className="min-h-0 min-w-0 flex-1">
          <Panel defaultSize={62} minSize={34} className="min-h-0">
            <Group orientation="horizontal" className="min-h-0 min-w-0 flex-1">
              <Panel defaultSize={20} minSize={15} className="min-h-0 min-w-0">
                <RundownPanel
                  onOpenScheduleManager={() => setShowScheduleManager(true)}
                  onAddItem={() => setShowAddItem(true)}
                  onApplyMediaToSong={handleApplyMediaToRundownSong}
                />
              </Panel>
              <ResizeHandle direction="horizontal" />

              <Panel defaultSize={38} minSize={25} className="min-h-0 min-w-0">
                <div 
                  onClickCapture={() => setKeyboardFocus('preview')} 
                  className={`h-full w-full transition-all duration-200 ${
                    keyboardFocus === 'preview' 
                      ? 'ring-2 ring-indigo-500/20 ring-offset-0 rounded-xl overflow-hidden' 
                      : ''
                  }`}
                >
                  <MainEditorPanel
                    slides={slides}
                    selectedItem={selectedItem}
                    libraryPreviewSong={libraryPreviewSong}
                    libraryPreviewMedia={libraryPreviewMedia}
                    libraryPreviewMode={libraryPreviewMode}
                    onApplyMediaToSongSlides={handleApplyMediaToSongSlides}
                    onClearMediaFromSongSlides={handleClearMediaFromSongSlides}
                  />
                </div>
              </Panel>
              <ResizeHandle direction="horizontal" />
              <Panel defaultSize={42} minSize={25} className="min-h-0 min-w-0">
                <div 
                  onClickCapture={() => setKeyboardFocus('live')} 
                  className={`h-full w-full transition-all duration-200 ${
                    keyboardFocus === 'live' 
                      ? 'ring-2 ring-emerald-500/20 ring-offset-0 rounded-xl overflow-hidden' 
                      : ''
                  }`}
                >
                  <PreviewPanel 
                    liveSlides={liveSlides} 
                    liveItem={liveItem} 
                    libraryLiveSong={libraryLiveSong} 
                    libraryLiveMedia={libraryLiveMedia}
                  />
                </div>
              </Panel>
            </Group>
          </Panel>
          <ResizeHandle direction="vertical" />
          <Panel defaultSize={38} minSize={20} className="min-h-0">
            <ControllerLibraryPanel
              onOpenSongEditor={openSongEditor}
              refreshToken={libraryRefreshToken}
            />
          </Panel>
        </Group>
      </div>



      <AddScheduleItemModal isOpen={showAddItem} onClose={() => setShowAddItem(false)} />

      {showScheduleManager && (
        <ScheduleManagerModal
          isOpen={showScheduleManager}
          onClose={() => setShowScheduleManager(false)}
          onSelect={(id) => {
            void loadSchedule(id);
            setShowScheduleManager(false);
          }}
          mode="select"
        />
      )}

      {isSongEditorOpen && (
        <SongEditorModal
          song={editorSong}
          onClose={() => setIsSongEditorOpen(false)}
          onSave={handleSongSaved}
        />
      )}

      {isSettingsOpen && <SettingsModal onClose={closeSettings} onLibraryChanged={handleSongSaved} />}
      {activeView === 'bible' && <BiblePanel />}
      {activeView === 'audio' && <AudioPanel />}
      {activeView === 'prd' && <PrdPresenterPanel />}
      {activeView === 'capture' && <CapturePanel />}
    </div>
  );
}
