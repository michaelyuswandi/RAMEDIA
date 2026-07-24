import { type DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CalendarPlus,
  Check,
  ChevronDown,
  UploadCloud,
  Filter,
  Heart,
  MoreVertical,
  Music,
  Pause,
  Play,
  Plus,
  Search,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAudioStore } from '../../core/stores/useAudioStore';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import { useUIStore } from '../../core/stores/useUIStore';
import { ipcAudioService } from '../../core/services/ipcAudioService';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import type { Media } from '../../electron/database/schema';
import { useI18n } from '../../i18n';

type AudioAnalysis = {
  peaks: number[];
  sampleRate: number | null;
  bitrateKbps: number | null;
  duration: number | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
};

const EMPTY_ANALYSIS: AudioAnalysis = {
  peaks: [],
  sampleRate: null,
  bitrateKbps: null,
  duration: null,
  status: 'idle',
};

function formatTime(time: number) {
  if (!Number.isFinite(time) || time < 0) return '00:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function parsePlayback(track: Media | null | undefined) {
  const defaults = {
    volume: 100,
    loop: false,
    startTime: 0,
    endTime: 0,
    fadeInMs: 0,
    fadeOutMs: 0,
  };

  if (!track?.playbackSettings) return defaults;

  try {
    const parsed = JSON.parse(track.playbackSettings);
    return { ...defaults, ...(parsed.playback || parsed) };
  } catch {
    return defaults;
  }
}

function getTrackCategory(track: Media) {
  const tags = getTrackTags(track).filter((tag) => tag !== 'favorite');
  return tags[0] || 'Audio';
}

function getTrackTags(track: Media) {
  try {
    const tags = track.tags ? JSON.parse(track.tags) : [];
    return Array.isArray(tags) ? tags.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function isFavoriteTrack(track: Media | null | undefined) {
  return !!track && getTrackTags(track).includes('favorite');
}

function formatFileSize(bytes?: number | null) {
  if (!bytes) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatBitrate(kbps?: number | null) {
  return kbps ? `${Math.round(kbps)} kbps` : '-';
}

function formatSampleRate(sampleRate?: number | null) {
  return sampleRate ? `${(sampleRate / 1000).toFixed(sampleRate % 1000 === 0 ? 0 : 1)} kHz` : '-';
}

function formatAudioFormat(track?: Media | null) {
  const type = track?.mimeType?.split('/').pop()?.toUpperCase();
  return type || track?.filename.split('.').pop()?.toUpperCase() || 'AUDIO';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    promise
      .then((value) => resolve(value))
      .catch((error) => reject(error))
      .finally(() => window.clearTimeout(timeoutId));
  });
}

function buildAudioModeLabel(mode: 'background' | 'segment' | 'custom') {
  if (mode === 'background') return 'Background Music';
  if (mode === 'segment') return 'Segment Music';
  return 'Custom Item';
}

async function analyzeTrack(track: Media, barCount = 160): Promise<AudioAnalysis> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return { ...EMPTY_ANALYSIS, status: 'error' };
  }

  const AudioContextCtor = window.AudioContext || (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) {
    return { ...EMPTY_ANALYSIS, status: 'error' };
  }

  const ipcBuffer = await ipcAudioService.readFile(track.filepath);
  let arrayBuffer = ipcBuffer;

  if (!arrayBuffer) {
    const response = await withTimeout(fetch(toRenderableMediaUrl(track.filepath)), 8000, 'Audio fetch');
    if (!response.ok) {
      throw new Error(`Audio analysis failed: ${response.status}`);
    }
    arrayBuffer = await withTimeout(response.arrayBuffer(), 8000, 'Audio read');
  }

  const context = new AudioContextCtor();
  try {
    const audioBuffer = await withTimeout(context.decodeAudioData(arrayBuffer.slice(0)), 10000, 'Audio decode');
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerBar = Math.max(1, Math.floor(channelData.length / barCount));
    const peaks = Array.from({ length: barCount }, (_, barIndex) => {
      const start = barIndex * samplesPerBar;
      const end = Math.min(channelData.length, start + samplesPerBar);
      let sum = 0;
      let peak = 0;

      for (let index = start; index < end; index += 1) {
        const value = Math.abs(channelData[index]);
        peak = Math.max(peak, value);
        sum += value * value;
      }

      const rms = Math.sqrt(sum / Math.max(1, end - start));
      return Math.min(1, Math.max(peak * 0.7, rms * 1.8));
    });
    const maxPeak = Math.max(...peaks, 0.01);
    const normalizedPeaks = peaks.map((peak) => Math.max(0.06, peak / maxPeak));
    const bitrateKbps = track.fileSize && audioBuffer.duration > 0 ? (track.fileSize * 8) / audioBuffer.duration / 1000 : null;

    return {
      peaks: normalizedPeaks,
      sampleRate: audioBuffer.sampleRate,
      bitrateKbps,
      duration: audioBuffer.duration,
      status: 'ready',
    };
  } finally {
    void context.close();
  }
}

export default function AudioPanel() {
  const { t } = useI18n();
  const setActiveView = useUIStore((state) => state.setActiveView);
  const { addItem, setSelectedItem, currentSchedule } = useScheduleStore();
  const {
    tracks,
    selectedTrack,
    currentTrack,
    status,
    currentTime,
    duration,
    trackVolume,
    masterVolume,
    muted,
    loop,
    initialized,
    loadTracks,
    importTracks,
    selectTrack,
    playTrack,
    pause,
    stop,
    seek,
    setTrackVolume,
    setMasterVolume,
    toggleMute,
    toggleLoop,
    updatePlaybackSettings,
    deleteTrack,
  } = useAudioStore();

  useEffect(() => {
    if (!initialized) {
      void loadTracks();
    }
  }, [initialized, loadTracks]);

  const activeTrack = selectedTrack || currentTrack;
  const isPlaying = status === 'playing';
  const playback = useMemo(() => parsePlayback(activeTrack), [activeTrack]);
  const activeDuration = duration || activeTrack?.duration || 0;
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [scheduleMode, setScheduleMode] = useState<'background' | 'segment' | 'custom'>('custom');
  const [scheduleId, setScheduleId] = useState<string | null>(currentSchedule?.id || null);
  const [queueTrackIds, setQueueTrackIds] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sortMode, setSortMode] = useState<'name' | 'duration' | 'recent'>('name');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showTrackMenuId, setShowTrackMenuId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [analysisCache, setAnalysisCache] = useState<Record<string, AudioAnalysis>>({});
  const isScrubbingRef = useRef(false);
  const volumePopoverRef = useRef<HTMLDivElement | null>(null);
  const filterPopoverRef = useRef<HTMLDivElement | null>(null);

  const activeAnalysis = activeTrack ? analysisCache[activeTrack.id] || EMPTY_ANALYSIS : EMPTY_ANALYSIS;
  const displayDuration = activeAnalysis.duration || activeDuration;
  const displayBitrate = activeAnalysis.bitrateKbps;
  const displaySampleRate = activeAnalysis.sampleRate;
  const waveformPeaks = activeAnalysis.peaks.length
    ? activeAnalysis.peaks
    : Array.from({ length: 120 }, (_, index) => activeAnalysis.status === 'loading' ? 0.18 + ((index * 13) % 60) / 100 : 0.12);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    tracks.forEach((track) => {
      const category = getTrackCategory(track);
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return ['All', ...Array.from(counts.keys())].map((category) => ({
      label: category,
      count: category === 'All' ? tracks.length : counts.get(category) || 0,
    }));
  }, [tracks]);

  const filteredTracks = useMemo(() => {
    const normalized = searchQuery.trim().toLowerCase();
    const filtered = tracks.filter((track) => {
      const category = getTrackCategory(track);
      const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
      const matchesSearch = !normalized || track.filename.toLowerCase().includes(normalized);
      const matchesFavorite = !favoritesOnly || isFavoriteTrack(track);
      return matchesCategory && matchesSearch && matchesFavorite;
    });

    return filtered.sort((a, b) => {
      if (sortMode === 'duration') return (b.duration || 0) - (a.duration || 0);
      if (sortMode === 'recent') return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      return a.filename.localeCompare(b.filename);
    });
  }, [favoritesOnly, searchQuery, selectedCategory, sortMode, tracks]);

  const queueTracks = useMemo(() => (
    queueTrackIds
      .map((id) => tracks.find((track) => track.id === id))
      .filter(Boolean) as Media[]
  ), [queueTrackIds, tracks]);

  const totalQueueDuration = queueTracks.reduce((sum, track) => sum + (track.duration || 0), 0);

  const selectedSchedule = useMemo(() => {
    if (!scheduleId) return currentSchedule;
    return currentSchedule?.id === scheduleId ? currentSchedule : null;
  }, [currentSchedule, scheduleId]);

  const handleSaveToSchedule = async () => {
    if (!activeTrack) return;
    const itemId = await addItem({
      itemType: 'media',
      mediaId: activeTrack.id,
      content: JSON.stringify({
        title: activeTrack.filename,
        audioMode: scheduleMode,
        playback,
      }),
      duration: Math.max(1, Math.round(activeTrack.duration || activeDuration || 1)),
    });
    setSelectedItem(itemId);
  };

  const addTrackToQueue = (track: Media | null | undefined) => {
    if (!track) return;
    setQueueTrackIds((ids) => ids.includes(track.id) ? ids : [...ids, track.id]);
  };

  const removeTrackFromQueue = (trackId: string) => {
    setQueueTrackIds((ids) => ids.filter((id) => id !== trackId));
  };

  const moveQueueTrack = (trackId: string, direction: -1 | 1) => {
    setQueueTrackIds((ids) => {
      const index = ids.indexOf(trackId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= ids.length) return ids;
      const next = [...ids];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  const handleShuffle = () => {
    const source = queueTracks.length > 1 ? queueTracks : filteredTracks;
    if (!source.length) return;
    const candidates = source.filter((track) => track.id !== activeTrack?.id);
    const nextTrack = candidates[Math.floor(Math.random() * candidates.length)] || source[0];
    selectTrack(nextTrack);
    void playTrack(nextTrack);
  };

  const toggleFavorite = async (track: Media | null | undefined) => {
    if (!track) return;
    const tags = getTrackTags(track);
    const nextTags = tags.includes('favorite') ? tags.filter((tag) => tag !== 'favorite') : [...tags, 'favorite'];
    await ipcAudioService.update(track.id, { tags: JSON.stringify(nextTags) });
    await loadTracks();
    setShowTrackMenuId(null);
  };

  const handleDropImport = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    const paths = Array.from(event.dataTransfer.files)
      .map((file) => (file as File & { path?: string }).path)
      .filter((path): path is string => Boolean(path));

    if (paths.length > 0) {
      void ipcAudioService.importFiles(paths).then(async (imported) => {
        await loadTracks();
        if (imported?.[0]) {
          selectTrack(imported[0]);
          addTrackToQueue(imported[0]);
        }
      });
      return;
    }

    void importTracks();
  };

  useEffect(() => {
    if (!isScrubbingRef.current) {
      setScrubTime(currentTime);
    }
  }, [currentTime]);

  useEffect(() => {
    if (!activeTrack || analysisCache[activeTrack.id]?.status === 'ready' || analysisCache[activeTrack.id]?.status === 'loading') return;

    let cancelled = false;
    setAnalysisCache((cache) => ({
      ...cache,
      [activeTrack.id]: { ...(cache[activeTrack.id] || EMPTY_ANALYSIS), status: 'loading' },
    }));

    void analyzeTrack(activeTrack)
      .then((analysis) => {
        if (cancelled) return;
        setAnalysisCache((cache) => ({ ...cache, [activeTrack.id]: analysis }));
      })
      .catch(() => {
        if (cancelled) return;
        setAnalysisCache((cache) => ({
          ...cache,
          [activeTrack.id]: { ...(cache[activeTrack.id] || EMPTY_ANALYSIS), status: 'error' },
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [activeTrack, analysisCache]);

  useEffect(() => {
    setQueueTrackIds((ids) => {
      const validIds = ids.filter((id) => tracks.some((track) => track.id === id));
      if (validIds.length) return validIds;
      const seed = activeTrack ? [activeTrack.id] : [];
      return [...seed, ...tracks.filter((track) => track.id !== activeTrack?.id).slice(0, 3).map((track) => track.id)];
    });
  }, [activeTrack, tracks]);

  useEffect(() => {
    if (currentSchedule?.id && !scheduleId) setScheduleId(currentSchedule.id);
  }, [currentSchedule, scheduleId]);

  useEffect(() => {
    if (!showVolumeControl && !showFilterMenu && !showTrackMenuId) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (volumePopoverRef.current && target && !volumePopoverRef.current.contains(target)) {
        setShowVolumeControl(false);
      }
      if (filterPopoverRef.current && target && !filterPopoverRef.current.contains(target)) {
        setShowFilterMenu(false);
      }
      if (showTrackMenuId && target instanceof Element && !target.closest('[data-audio-track-menu]')) {
        setShowTrackMenuId(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showFilterMenu, showTrackMenuId, showVolumeControl]);

  return (
    <div className="theme-scope absolute inset-0 z-40 flex bg-background font-sans text-text">
      <aside className="flex w-[390px] shrink-0 flex-col border-r border-text/10 bg-surface">
        <div className="flex h-18 items-center gap-3 border-b border-text/10 px-4 py-4">
          <button
            onClick={() => setActiveView('songs')}
            className="control-button flex h-10 items-center gap-2 px-3 text-sm font-semibold"
            title={t('audioPanel.backToLibrary')}
          >
            <ArrowLeft size={15} /> {t('common.back')}
          </button>
          <div className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-[0.28em]">
            <Music size={18} className="text-primary" />
            {t('audioPanel.title')}
          </div>
          <button
            onClick={() => void importTracks()}
            className="ml-auto flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-bold text-black transition hover:brightness-105 active:scale-[0.98]"
          >
            <Plus size={16} /> {t('audioPanel.import')}
          </button>
        </div>

        <div className="border-b border-text/10 p-4">
          <div className="flex gap-2">
            <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-text/10 bg-text/[0.03] px-3 text-text/42">
              <Search size={15} />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text/38"
                placeholder={t('audioPanel.searchTracksPlaceholder')}
              />
            </label>
            <div ref={filterPopoverRef} className="relative">
              <button
                onClick={() => setShowFilterMenu((value) => !value)}
                className={`grid h-10 w-10 place-items-center rounded-lg border text-text/58 ${showFilterMenu || favoritesOnly ? 'border-primary/35 bg-primary/10 text-primary' : 'border-text/10 bg-text/[0.03]'}`}
                title="Filter audio"
              >
                <Filter size={16} />
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-12 z-20 w-56 rounded-xl border border-text/10 bg-surface p-3 shadow-[0_18px_44px_rgba(var(--color-shadow-rgb),0.2)]">
                  <button
                    onClick={() => setFavoritesOnly((value) => !value)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-text/[0.05]"
                  >
                    Favorites only
                    {favoritesOnly && <Check size={15} className="text-primary" />}
                  </button>
                  <div className="my-2 h-px bg-text/10" />
                  {[
                    ['name', 'Name'],
                    ['duration', 'Duration'],
                    ['recent', 'Recently Added'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      onClick={() => setSortMode(value as typeof sortMode)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-text/[0.05]"
                    >
                      Sort by {label}
                      {sortMode === value && <Check size={15} className="text-primary" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {categories.map((category) => (
              <button
                key={category.label}
                onClick={() => setSelectedCategory(category.label)}
                className={`inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${
                  selectedCategory === category.label
                    ? 'border-primary/35 bg-primary/14 text-primary'
                    : 'border-transparent bg-text/[0.03] text-text/58 hover:bg-text/[0.06] hover:text-text'
                }`}
              >
                {category.label}
                <span className="font-mono text-text/45">{category.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            {filteredTracks.map((track) => {
              const isSelected = activeTrack?.id === track.id;
              const isCurrent = currentTrack?.id === track.id;
              const category = getTrackCategory(track);
              return (
                <div
                  key={track.id}
                  onClick={() => selectTrack(track)}
                  onDoubleClick={() => void playTrack(track)}
                  className={`group relative grid cursor-pointer grid-cols-[40px_1fr_auto_auto_auto_auto] items-center gap-3 rounded-xl border p-3 transition ${
                    isSelected ? 'border-primary/45 bg-primary/10 shadow-[0_10px_24px_rgba(var(--color-primary-rgb),0.12)]' : 'border-text/10 bg-text/[0.02] hover:bg-text/[0.05]'
                  }`}
                >
                  <div className={`grid h-10 w-10 place-items-center rounded-lg ${isCurrent ? 'bg-primary text-black' : 'bg-text/[0.07] text-text/64'}`}>
                    <Music size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-text">{track.filename}</div>
                    <span className="mt-1 inline-flex rounded-md bg-primary/14 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      {category}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-text/52">{formatTime(track.duration || 0)}</div>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      void toggleFavorite(track);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-text/10 bg-surface text-text/60 hover:text-primary"
                    title={isFavoriteTrack(track) ? 'Remove favorite' : 'Add favorite'}
                  >
                    <Heart size={14} className={isFavoriteTrack(track) ? 'fill-amber-400 text-amber-400' : ''} />
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      if (isCurrent && isPlaying) pause();
                      else void playTrack(track);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-text/10 bg-surface text-text/70 hover:text-primary"
                  >
                    {isCurrent && isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button
                    data-audio-track-menu
                    onClick={(event) => {
                      event.stopPropagation();
                      setShowTrackMenuId((value) => value === track.id ? null : track.id);
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg border border-text/10 bg-surface text-text/60 hover:text-primary"
                    title="Track actions"
                  >
                    <MoreVertical size={14} />
                  </button>
                  {showTrackMenuId === track.id && (
                    <div
                      data-audio-track-menu
                      onClick={(event) => event.stopPropagation()}
                      className="absolute right-3 top-12 z-20 w-44 rounded-xl border border-text/10 bg-surface p-2 shadow-[0_18px_44px_rgba(var(--color-shadow-rgb),0.2)]"
                    >
                      <button onClick={() => addTrackToQueue(track)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-text/[0.05]">
                        <Plus size={14} /> Add to queue
                      </button>
                      <button onClick={() => void toggleFavorite(track)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold hover:bg-text/[0.05]">
                        <Heart size={14} className={isFavoriteTrack(track) ? 'fill-amber-400 text-amber-400' : ''} /> Favorite
                      </button>
                      <button
                        onClick={() => {
                          const confirmed = window.confirm(`Delete ${track.filename}?`);
                          if (confirmed) void deleteTrack(track.id);
                          setShowTrackMenuId(null);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold text-error hover:bg-error/10"
                      >
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredTracks.length === 0 && (
            <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-text/14 text-center text-text/38">
              <Music size={36} className="mb-3 opacity-45" />
              <div className="text-xs font-bold uppercase tracking-[0.18em]">No audio tracks</div>
            </div>
          )}
        </div>

        <div className="border-t border-text/10 p-4">
          <div
            onDrop={handleDropImport}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            className={`rounded-xl border border-dashed p-4 text-center text-sm transition ${dragActive ? 'border-primary/50 bg-primary/10 text-primary' : 'border-text/14 text-text/52'}`}
          >
            <UploadCloud size={18} className="mx-auto mb-2" />
            Drop audio files here<br />
            <button onClick={() => void importTracks()} className="font-semibold text-primary">or click to browse</button>
          </div>
          <div className="mt-4 flex justify-between text-xs text-text/52">
            <span>Total {tracks.length} tracks</span>
            <span>{formatTime(tracks.reduce((sum, track) => sum + (track.duration || 0), 0))}</span>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-18 items-center justify-between border-b border-text/10 bg-surface px-5 py-4">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-text/52">Audio Player</div>
            <div className="text-lg font-extrabold text-text">Now Playing</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => void handleSaveToSchedule()}
              disabled={!activeTrack}
              className="flex h-10 items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-4 text-sm font-bold text-primary disabled:opacity-40"
            >
              <CalendarPlus size={16} /> Save to Schedule
            </button>
            <button className="grid h-10 w-10 place-items-center rounded-lg border border-text/10 bg-text/[0.03]">
              <MoreVertical size={16} />
            </button>
            <span className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-bold uppercase tracking-[0.12em] ${isPlaying ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-500' : 'border-text/10 bg-text/[0.03] text-text/48'}`}>
              <span className={`h-2 w-2 rounded-full ${isPlaying ? 'bg-emerald-500' : 'bg-text/30'}`} />
              On Air
            </span>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[minmax(520px,1fr)_330px] gap-4 overflow-hidden p-5">
          <div className="min-h-0 overflow-y-auto">
            {activeTrack ? (
              <section className="rounded-xl border border-text/10 bg-surface p-5 shadow-[0_16px_44px_rgba(var(--color-shadow-rgb),0.08)]">
                <div className="flex items-start gap-5">
                  <div className="grid h-32 w-32 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-text/12 to-text/[0.03] text-text shadow-inner">
                    <Music size={48} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-lg font-extrabold text-text">{activeTrack.filename}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-text/52">
                      <span>{formatAudioFormat(activeTrack)}</span>
                      <span>{activeAnalysis.status === 'loading' ? 'Analyzing...' : activeAnalysis.status === 'error' ? 'Waveform unavailable' : formatBitrate(displayBitrate)}</span>
                      <span>{formatSampleRate(displaySampleRate)}</span>
                      <span>{formatFileSize(activeTrack.fileSize)}</span>
                    </div>
                    <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-extrabold uppercase tracking-[0.18em] text-text/64">
                      <span>Selected</span>
                      <span>{formatTime(displayDuration)}</span>
                      <span>In {formatTime(playback.startTime)}</span>
                      <span>Out {playback.endTime > 0 ? formatTime(playback.endTime) : formatTime(displayDuration)}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => void updatePlaybackSettings({ startTime: Math.min(currentTime, playback.endTime || currentTime) })} className="rounded-lg border border-text/10 bg-text/[0.03] px-3 py-2 text-sm font-semibold text-text/72">Set In <span className="ml-2 font-mono">{formatTime(currentTime)}</span></button>
                      <button onClick={() => void updatePlaybackSettings({ endTime: Math.max(currentTime, playback.startTime) })} className="rounded-lg border border-text/10 bg-text/[0.03] px-3 py-2 text-sm font-semibold text-text/72">Set Out <span className="ml-2 font-mono">{formatTime(currentTime)}</span></button>
                      <button onClick={() => void updatePlaybackSettings({ endTime: 0 })} className="rounded-lg border border-text/10 bg-text/[0.03] px-3 py-2 text-sm font-semibold text-text/62">Clear Out</button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => void toggleFavorite(activeTrack)}
                      className="grid h-10 w-10 place-items-center rounded-lg border border-text/10 bg-text/[0.03] text-text/62 hover:text-primary"
                      title={isFavoriteTrack(activeTrack) ? 'Remove favorite' : 'Add favorite'}
                    >
                      <Heart size={17} className={isFavoriteTrack(activeTrack) ? 'fill-amber-400 text-amber-400' : ''} />
                    </button>
                    <button onClick={() => void toggleLoop()} className={`h-10 rounded-lg border px-3 text-sm font-bold ${loop ? 'border-primary/45 bg-primary/14 text-primary' : 'border-text/10 bg-text/[0.03] text-text/62'}`}>Loop</button>
                    <div ref={volumePopoverRef} className="relative">
                      <button onClick={() => setShowVolumeControl((value) => !value)} className="grid h-10 w-10 place-items-center rounded-lg border border-text/10 bg-text/[0.03] text-text/62">
                        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
                      </button>
                      {showVolumeControl && (
                        <div className="absolute right-0 top-12 z-20 w-64 rounded-xl border border-text/10 bg-surface p-4 shadow-[0_18px_44px_rgba(var(--color-shadow-rgb),0.22)]">
                          <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-[0.14em] text-text/52">
                            Output Level
                            <button onClick={toggleMute}>{muted ? <VolumeX size={15} /> : <Volume2 size={15} />}</button>
                          </div>
                          <label className="mb-3 block text-xs text-text/54">Track <span className="float-right font-mono">{trackVolume}%</span>
                            <input type="range" min={0} max={100} value={trackVolume} onInput={(e) => void setTrackVolume(parseInt((e.target as HTMLInputElement).value, 10))} className="mt-2 h-2 w-full accent-primary" />
                          </label>
                          <label className="block text-xs text-text/54">Master <span className="float-right font-mono">{masterVolume}%</span>
                            <input type="range" min={0} max={100} value={masterVolume} onInput={(e) => void setMasterVolume(parseInt((e.target as HTMLInputElement).value, 10))} className="mt-2 h-2 w-full accent-primary" />
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <div className="mb-3 flex justify-between font-mono text-sm text-text/58">
                    <span>{formatTime(isScrubbing ? scrubTime : currentTime)}</span>
                    <span>{formatTime(displayDuration)}</span>
                  </div>
                  <div className="relative rounded-xl bg-text/[0.03] px-2 py-8">
                    <div className="absolute inset-x-6 top-1/2 z-10 h-16 -translate-y-1/2 overflow-hidden">
                      <div className={`flex h-full items-center gap-0.5 opacity-90 ${activeAnalysis.status === 'loading' ? 'animate-pulse' : ''}`}>
                        {waveformPeaks.map((peak, index) => {
                          const progress = displayDuration ? (index / Math.max(1, waveformPeaks.length - 1)) * displayDuration : 0;
                          const isPlayed = progress <= (isScrubbing ? scrubTime : currentTime);
                          return (
                          <span
                            key={index}
                            className={`w-1 rounded-full transition-colors ${isPlayed ? 'bg-primary' : activeAnalysis.status === 'loading' ? 'bg-text/28' : 'bg-text/20'}`}
                            style={{ height: `${8 + peak * 56}px` }}
                          />
                          );
                        })}
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={displayDuration || 0}
                      step={0.05}
                      value={Math.min(isScrubbing ? scrubTime : currentTime, displayDuration || 0)}
                      onMouseDown={(e) => {
                        isScrubbingRef.current = true;
                        setIsScrubbing(true);
                        setScrubTime(parseFloat((e.target as HTMLInputElement).value));
                      }}
                      onInput={(e) => setScrubTime(parseFloat((e.target as HTMLInputElement).value))}
                      onMouseUp={(e) => {
                        const finalValue = parseFloat((e.target as HTMLInputElement).value);
                        isScrubbingRef.current = false;
                        setIsScrubbing(false);
                        void seek(finalValue);
                      }}
                      disabled={!displayDuration}
                      className="relative z-20 h-16 w-full cursor-pointer appearance-none bg-transparent accent-primary disabled:opacity-40"
                    />
                  </div>
                </div>

                <div className="mt-7 flex items-center justify-center gap-4 border-t border-text/10 pt-5">
                  <button onClick={handleShuffle} className="grid h-11 w-11 place-items-center rounded-full text-text/58 hover:text-primary" title="Shuffle queue"><Shuffle size={18} /></button>
                  <button onClick={() => void seek(Math.max(0, currentTime - 10))} className="grid h-12 w-12 place-items-center rounded-full border border-text/10 bg-text/[0.03]"><SkipBack size={20} /></button>
                  <button onClick={() => currentTrack?.id === activeTrack.id && isPlaying ? pause() : void playTrack(activeTrack)} className="grid h-14 w-14 place-items-center rounded-full bg-primary text-black shadow-[0_16px_34px_rgba(var(--color-primary-rgb),0.28)]">
                    {currentTrack?.id === activeTrack.id && isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                  </button>
                  <button onClick={() => void seek(Math.min(displayDuration, currentTime + 10))} className="grid h-12 w-12 place-items-center rounded-full border border-text/10 bg-text/[0.03]"><SkipForward size={20} /></button>
                  <button onClick={stop} className="grid h-12 w-12 place-items-center rounded-full border border-text/10 bg-text/[0.03]"><Square size={18} fill="currentColor" /></button>
                  <div className="ml-6 flex items-center gap-3">
                    <Volume2 size={18} />
                    <input type="range" min={0} max={100} value={trackVolume} onInput={(e) => void setTrackVolume(parseInt((e.target as HTMLInputElement).value, 10))} className="w-32 accent-primary" />
                  </div>
                </div>
              </section>
            ) : (
              <section className="grid min-h-[420px] place-items-center rounded-xl border border-dashed border-text/14 bg-surface text-center text-text/42">
                <div>
                  <Music size={48} className="mx-auto mb-4" />
                  <div className="font-bold">Select an audio track</div>
                  <div className="mt-1 text-sm">Choose a track from the library.</div>
                </div>
              </section>
            )}

            <section className="mt-4 rounded-xl border border-text/10 bg-surface p-4">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-extrabold uppercase tracking-[0.14em]">Playlist / Queue</h3>
                  <span className="rounded-full bg-text/[0.05] px-2 py-1 text-xs text-text/52">{queueTracks.length} Tracks ({formatTime(totalQueueDuration)})</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => addTrackToQueue(filteredTracks.find((track) => !queueTrackIds.includes(track.id)) || activeTrack)}
                    className="flex h-9 items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 text-sm font-bold text-primary"
                  >
                    <Plus size={15} /> Add Track
                  </button>
                  <button onClick={() => setQueueTrackIds([])} className="flex h-9 items-center gap-2 rounded-lg border border-text/10 bg-text/[0.03] px-3 text-sm font-bold text-text/60">
                    Clear All
                  </button>
                </div>
              </div>
              <div className="divide-y divide-text/10 rounded-lg border border-text/10">
                {queueTracks.length > 0 ? queueTracks.map((track, index) => (
                  <div key={`${track.id}-${index}`} className={`grid w-full grid-cols-[32px_1fr_80px_80px_80px_112px] items-center gap-3 px-3 py-3 text-left text-sm ${activeTrack?.id === track.id ? 'bg-primary/10 text-primary' : 'hover:bg-text/[0.03]'}`}>
                    <button onClick={() => selectTrack(track)} className="font-mono text-text/42">{index + 1}</button>
                    <button onClick={() => selectTrack(track)} className="truncate text-left font-semibold">{track.filename}</button>
                    <span className="font-mono text-text/64">{formatTime(track.duration || 0)}</span>
                    <span className="font-mono text-text/54">{activeTrack?.id === track.id ? formatTime(playback.startTime) : '-'}</span>
                    <span className="font-mono text-text/54">{activeTrack?.id === track.id && playback.endTime > 0 ? formatTime(playback.endTime) : '-'}</span>
                    <span className="flex justify-end gap-1">
                      <button onClick={() => moveQueueTrack(track.id, -1)} disabled={index === 0} className="grid h-7 w-7 place-items-center rounded-md border border-text/10 disabled:opacity-30"><ChevronDown size={14} className="rotate-180" /></button>
                      <button onClick={() => moveQueueTrack(track.id, 1)} disabled={index === queueTracks.length - 1} className="grid h-7 w-7 place-items-center rounded-md border border-text/10 disabled:opacity-30"><ChevronDown size={14} /></button>
                      <button onClick={() => void playTrack(track)} className="grid h-7 w-7 place-items-center rounded-md border border-text/10"><Play size={14} /></button>
                      <button onClick={() => removeTrackFromQueue(track.id)} className="grid h-7 w-7 place-items-center rounded-md border border-error/20 text-error"><X size={14} /></button>
                    </span>
                  </div>
                )) : (
                  <div className="px-3 py-8 text-center text-sm text-text/42">Queue is empty.</div>
                )}
              </div>
              <div className="mt-4 text-center text-sm text-text/52">Total Duration: {formatTime(totalQueueDuration)}</div>
            </section>
          </div>

          <aside className="min-h-0 overflow-y-auto">
            <section className="rounded-xl border border-text/10 bg-surface p-4">
              <h3 className="mb-4 text-sm font-extrabold uppercase tracking-[0.16em]">Track Details</h3>
              {activeTrack ? (
                <div className="space-y-4 text-sm">
                  {[
                    ['File Name', activeTrack.filename],
                    ['Category', getTrackCategory(activeTrack)],
                    ['Duration', formatTime(displayDuration)],
                    ['File Size', formatFileSize(activeTrack.fileSize)],
                    ['Format', formatAudioFormat(activeTrack)],
                    ['Bitrate', activeAnalysis.status === 'loading' ? 'Analyzing...' : activeAnalysis.status === 'error' ? '-' : formatBitrate(displayBitrate)],
                    ['Sample Rate', formatSampleRate(displaySampleRate)],
                    ['Added', activeTrack.createdAt ? new Date(activeTrack.createdAt).toLocaleString() : '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <span className="text-text/52">{label}</span>
                      <span className="max-w-[170px] truncate text-right font-semibold text-text/76">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text/48">No track selected.</p>
              )}
            </section>

            <section className="mt-4 rounded-xl border border-text/10 bg-surface p-4">
              <h3 className="mb-4 text-sm font-extrabold uppercase tracking-[0.16em]">Schedule Options</h3>
              <div className="space-y-2">
                {[
                  ['background', 'Background Music', 'Akan diputar sebagai musik latar'],
                  ['segment', 'Segment Music', 'Diputar di antara item rundown'],
                  ['custom', 'Custom Item', 'Ditambahkan sebagai item khusus'],
                ].map(([value, title, desc]) => (
                  <button key={value} onClick={() => setScheduleMode(value as typeof scheduleMode)} className={`w-full rounded-lg border p-3 text-left ${scheduleMode === value ? 'border-primary/45 bg-primary/10' : 'border-text/10 bg-text/[0.03]'}`}>
                    <span className="block text-sm font-bold">{title}</span>
                    <span className="mt-1 block text-xs text-text/52">{desc}</span>
                  </button>
                ))}
              </div>
              <div className="mt-4 space-y-3 text-sm">
                <label className="block text-text/60">Rundown
                  <select
                    value={scheduleId || currentSchedule?.id || ''}
                    onChange={(event) => setScheduleId(event.target.value || null)}
                    className="mt-1 w-full rounded-lg border border-text/10 bg-text/[0.03] px-3 py-2 font-semibold text-text/76 outline-none"
                  >
                    <option value={currentSchedule?.id || ''}>{selectedSchedule?.name || currentSchedule?.name || 'Quick Rundown'}</option>
                  </select>
                </label>
                <label className="block text-text/60">Add as
                  <div className="mt-1 rounded-lg border border-text/10 bg-text/[0.03] px-3 py-2 font-semibold text-text/76">{buildAudioModeLabel(scheduleMode)}</div>
                </label>
              </div>
              <button onClick={() => void handleSaveToSchedule()} disabled={!activeTrack} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary text-sm font-bold text-black disabled:opacity-40">
                <CalendarPlus size={16} />
                Save to Schedule
              </button>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
