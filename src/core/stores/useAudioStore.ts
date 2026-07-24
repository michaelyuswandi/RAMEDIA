import { create } from 'zustand';
import type { Media } from '../../electron/database/schema';
import { ipcAudioService } from '../services/ipcAudioService';
import { ipcAudioSettingsService } from '../services/ipcAudioSettingsService';
import { toRenderableMediaUrl } from '../utils/mediaUrl';

type AudioStatus = 'idle' | 'playing' | 'paused' | 'stopped';

interface AudioPlaybackSettings {
  volume: number;
  loop: boolean;
  startTime: number;
  endTime: number;
  fadeInMs: number;
  fadeOutMs: number;
}

interface AudioState {
  tracks: Media[];
  selectedTrack: Media | null;
  currentTrack: Media | null;
  status: AudioStatus;
  currentTime: number;
  duration: number;
  trackVolume: number;
  masterVolume: number;
  muted: boolean;
  loop: boolean;
  initialized: boolean;
  loadTracks: () => Promise<void>;
  importTracks: () => Promise<void>;
  selectTrack: (track: Media | null) => void;
  playTrack: (track?: Media | null) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => Promise<void>;
  setTrackVolume: (volume: number) => Promise<void>;
  setMasterVolume: (volume: number) => Promise<void>;
  updatePlaybackSettings: (updates: Partial<AudioPlaybackSettings>) => Promise<void>;
  toggleMute: () => void;
  toggleLoop: () => Promise<void>;
  deleteTrack: (id: string) => Promise<void>;
}

let audioElement: HTMLAudioElement | null = null;
let eventsAttached = false;
let fadeInterval: number | null = null;
let pendingSeekTime: number | null = null;
let audioBlobSourceUrl: string | null = null;
let audioBlobTrackId: string | null = null;

function getAudioElement() {
  if (typeof Audio === 'undefined') return null;
  if (!audioElement) {
    audioElement = new Audio();
    audioElement.preload = 'metadata';
  }
  return audioElement;
}

function parsePlaybackSettings(track: Media | null | undefined): AudioPlaybackSettings {
  const defaults: AudioPlaybackSettings = {
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
    const playback = parsed.playback || parsed;
    return {
      volume: typeof playback.volume === 'number' ? playback.volume : defaults.volume,
      loop: typeof playback.loop === 'boolean' ? playback.loop : defaults.loop,
      startTime: typeof playback.startTime === 'number' ? playback.startTime : defaults.startTime,
      endTime: typeof playback.endTime === 'number' ? playback.endTime : defaults.endTime,
      fadeInMs: typeof playback.fadeInMs === 'number' ? playback.fadeInMs : defaults.fadeInMs,
      fadeOutMs: typeof playback.fadeOutMs === 'number' ? playback.fadeOutMs : defaults.fadeOutMs,
    };
  } catch {
    return defaults;
  }
}

function stringifyPlaybackSettings(settings: AudioPlaybackSettings) {
  return JSON.stringify({ playback: settings });
}

function clearFadeInterval() {
  if (fadeInterval) {
    window.clearInterval(fadeInterval);
    fadeInterval = null;
  }
}

function isSameLoadedSource(player: HTMLAudioElement, source: string) {
  return player.currentSrc === source || player.src === source;
}

function revokeAudioBlobSource() {
  if (audioBlobSourceUrl?.startsWith('blob:')) {
    URL.revokeObjectURL(audioBlobSourceUrl);
  }
  audioBlobSourceUrl = null;
  audioBlobTrackId = null;
}

async function getPlayableAudioSource(track: Media) {
  const originalSource = toRenderableMediaUrl(track.filepath);
  if (typeof window === 'undefined' || typeof fetch === 'undefined' || typeof URL === 'undefined') {
    return originalSource;
  }

  if (audioBlobSourceUrl && audioBlobTrackId === track.id) {
    return audioBlobSourceUrl;
  }

  const response = await fetch(originalSource);
  if (!response.ok) {
    throw new Error(`Failed to load audio source: ${response.status}`);
  }

  const blob = await response.blob();
  revokeAudioBlobSource();
  audioBlobSourceUrl = URL.createObjectURL(blob);
  audioBlobTrackId = track.id;
  return audioBlobSourceUrl;
}

function runFade(player: HTMLAudioElement, from: number, to: number, durationMs: number, onDone?: () => void) {
  clearFadeInterval();

  if (!durationMs || durationMs <= 0) {
    player.volume = to;
    onDone?.();
    return;
  }

  const startedAt = Date.now();
  const tickMs = 50;

  fadeInterval = window.setInterval(() => {
    const elapsed = Date.now() - startedAt;
    const progress = Math.min(1, elapsed / durationMs);
    player.volume = from + (to - from) * progress;

    if (progress >= 1) {
      clearFadeInterval();
      onDone?.();
    }
  }, tickMs);
}

function getEffectiveVolume(masterVolume: number, trackVolume: number, muted: boolean) {
  if (muted) return 0;
  return (Math.max(0, Math.min(100, masterVolume)) / 100) * (Math.max(0, Math.min(100, trackVolume)) / 100);
}

async function probeTrackDuration(track: Media) {
  if (typeof Audio === 'undefined') return track.duration || 0;

  return await new Promise<number>((resolve) => {
    const probe = new Audio();
    probe.preload = 'metadata';
    probe.src = toRenderableMediaUrl(track.filepath);
    probe.onloadedmetadata = () => resolve(Math.round(probe.duration || 0));
    probe.onerror = () => resolve(track.duration || 0);
  });
}

export const useAudioStore = create<AudioState>((set, get) => {
  const persistTrackSettings = async (targetTrack: Media, nextSettings: AudioPlaybackSettings) => {
    const nextTrack = { ...targetTrack, playbackSettings: stringifyPlaybackSettings(nextSettings) };
    await ipcAudioService.update(targetTrack.id, { playbackSettings: nextTrack.playbackSettings });
    set((state) => ({
      currentTrack: state.currentTrack?.id === targetTrack.id ? nextTrack : state.currentTrack,
      selectedTrack: state.selectedTrack?.id === targetTrack.id ? nextTrack : state.selectedTrack,
      tracks: state.tracks.map((track) => track.id === targetTrack.id ? nextTrack : track),
    }));
  };

  const attachEvents = () => {
    const player = getAudioElement();
    if (!player || eventsAttached) return;

    player.addEventListener('timeupdate', () => {
      const { currentTrack } = get();
      if (pendingSeekTime !== null) {
        return;
      }
      const settings = parsePlaybackSettings(currentTrack);
      if (settings.endTime > 0 && player.currentTime >= settings.endTime) {
        if (settings.loop) {
          player.currentTime = settings.startTime;
          void player.play();
          return;
        }
        player.pause();
        set({ status: 'stopped', currentTime: settings.endTime });
        return;
      }

      set({ currentTime: player.currentTime });
    });

    player.addEventListener('seeking', () => {
      set({ currentTime: pendingSeekTime ?? player.currentTime });
    });

    player.addEventListener('seeked', () => {
      pendingSeekTime = null;
      set({ currentTime: player.currentTime });
    });

    player.addEventListener('loadedmetadata', async () => {
      const duration = player.duration || 0;
      const roundedDuration = Math.round(duration);
      const { currentTrack } = get();

      set({ duration });

      if (currentTrack && currentTrack.duration !== roundedDuration) {
        await ipcAudioService.update(currentTrack.id, { duration: roundedDuration });
        const nextCurrentTrack = { ...currentTrack, duration: roundedDuration };
        set((state) => ({
          currentTrack: nextCurrentTrack,
          selectedTrack: state.selectedTrack?.id === currentTrack.id ? nextCurrentTrack : state.selectedTrack,
          tracks: state.tracks.map((track) => track.id === currentTrack.id ? nextCurrentTrack : track),
        }));
      }
    });

    player.addEventListener('play', () => set({ status: 'playing' }));
    player.addEventListener('pause', () => {
      const { status } = get();
      if (status !== 'stopped') {
        set({ status: 'paused' });
      }
    });
    player.addEventListener('ended', () => {
      pendingSeekTime = null;
      const { currentTrack } = get();
      const settings = parsePlaybackSettings(currentTrack);
      set({ status: 'stopped', currentTime: settings.startTime || 0 });
    });

    eventsAttached = true;
  };

  return {
    tracks: [],
    selectedTrack: null,
    currentTrack: null,
    status: 'idle',
    currentTime: 0,
    duration: 0,
    trackVolume: 100,
    masterVolume: 100,
    muted: false,
    loop: false,
    initialized: false,

    loadTracks: async () => {
      const tracks = await ipcAudioService.getAll();
      const masterVolume = await ipcAudioSettingsService.getMasterVolume();
      set((state) => ({
        tracks,
        selectedTrack: state.selectedTrack ? tracks.find((track) => track.id === state.selectedTrack?.id) || null : null,
        currentTrack: state.currentTrack ? tracks.find((track) => track.id === state.currentTrack?.id) || state.currentTrack : null,
        masterVolume,
        initialized: true,
      }));
      attachEvents();
    },

    importTracks: async () => {
      const imported = await ipcAudioService.importFile();
      if (!imported?.length) return;
      await get().loadTracks();
      get().selectTrack(imported[0]);
    },

    selectTrack: (track) => {
      const settings = parsePlaybackSettings(track);
      set({
        selectedTrack: track,
        trackVolume: settings.volume,
        loop: settings.loop,
        duration: track?.duration || 0,
        currentTime: settings.startTime || 0,
      });

      if (track && !track.duration) {
        void probeTrackDuration(track).then(async (duration) => {
          if (!duration || duration === track.duration) return;
          await ipcAudioService.update(track.id, { duration });
          set((state) => {
            const nextTrack = { ...track, duration };
            return {
              tracks: state.tracks.map((item) => item.id === track.id ? nextTrack : item),
              selectedTrack: state.selectedTrack?.id === track.id ? nextTrack : state.selectedTrack,
              currentTrack: state.currentTrack?.id === track.id ? nextTrack : state.currentTrack,
              duration: state.selectedTrack?.id === track.id || state.currentTrack?.id === track.id ? duration : state.duration,
            };
          });
        });
      }
    },

    playTrack: async (track) => {
      attachEvents();
      const nextTrack = track || get().selectedTrack || get().currentTrack;
      const player = getAudioElement();
      if (!nextTrack || !player) return;

      const settings = parsePlaybackSettings(nextTrack);
      const nextSource = await getPlayableAudioSource(nextTrack);

      // Consider it the "same track" if either:
      // 1. The player already has this file loaded (src matches and is ready) — meaning user seeked before pressing play
      // 2. The currently playing track has the same ID — meaning it's a resume after pause
      const playerAlreadyHasSource = isSameLoadedSource(player, nextSource) && player.readyState > 0;
      const isSameId = get().currentTrack?.id === nextTrack.id;
      const isSameTrack = playerAlreadyHasSource || isSameId;

      if (!isSameTrack) {
        player.src = nextSource;
        player.currentTime = settings.startTime || 0;
      }
      // If isSameTrack, preserve player.currentTime as-is (respect seeks and pauses)

      player.loop = settings.loop && !settings.endTime;
      player.muted = get().muted;
      const targetVolume = getEffectiveVolume(get().masterVolume, settings.volume, get().muted);
      
      // Only apply fade in if we are at/near the start of the track (new track or restarted)
      const isAtStart = Math.abs(player.currentTime - (settings.startTime || 0)) < 0.2;
      if (settings.fadeInMs > 0 && isAtStart && !get().muted) {
        player.volume = 0;
      } else {
        player.volume = targetVolume;
      }

      set((state) => ({
        currentTrack: nextTrack,
        selectedTrack: nextTrack,
        currentTime: isSameTrack ? state.currentTime : (settings.startTime || 0),
        duration: nextTrack.duration || player.duration || 0,
        trackVolume: settings.volume,
        loop: settings.loop,
      }));

      await player.play();
      
      if (settings.fadeInMs > 0 && isAtStart && !get().muted) {
        runFade(player, 0, targetVolume, settings.fadeInMs);
      }
    },

    pause: () => {
      const player = getAudioElement();
      if (!player) return;
      player.pause();
      set({ status: 'paused' });
    },

    stop: () => {
      const player = getAudioElement();
      const { currentTrack } = get();
      if (!player) return;

      const settings = parsePlaybackSettings(currentTrack);
      const reset = () => {
        player.pause();
        player.currentTime = settings.startTime || 0;
        player.volume = getEffectiveVolume(get().masterVolume, get().trackVolume, get().muted);
        set({
          status: 'stopped',
          currentTime: settings.startTime || 0,
        });
      };

      if (settings.fadeOutMs > 0 && !player.paused) {
        runFade(player, player.volume, 0, settings.fadeOutMs, reset);
        return;
      }

      reset();
    },

    seek: async (time) => {
      const player = getAudioElement();
      const { currentTrack, selectedTrack } = get();
      const targetTrack = currentTrack || selectedTrack;
      if (!player || !targetTrack) return;

      const settings = parsePlaybackSettings(targetTrack);
      const boundedTime = Math.max(
        settings.startTime || 0,
        Math.min(time, settings.endTime > 0 ? settings.endTime : targetTrack.duration || time)
      );

      const applySeek = () => {
        pendingSeekTime = boundedTime;
        player.currentTime = boundedTime;
        set({
          currentTrack: targetTrack,
          selectedTrack: targetTrack,
          currentTime: boundedTime,
          duration: targetTrack.duration || player.duration || 0,
        });
      };

      const nextSource = await getPlayableAudioSource(targetTrack);

      if (!isSameLoadedSource(player, nextSource)) {
        // Source not loaded yet. Load once, then seek after metadata is available.
        player.src = nextSource;
        pendingSeekTime = boundedTime;
        set({
          currentTrack: targetTrack,
          selectedTrack: targetTrack,
          currentTime: boundedTime,
          duration: targetTrack.duration || 0,
        });

        const handleLoadedMetadata = () => {
          player.removeEventListener('loadedmetadata', handleLoadedMetadata);
          player.currentTime = boundedTime;
        };
        player.addEventListener('loadedmetadata', handleLoadedMetadata);
        return;
      }

      applySeek();
    },

    setTrackVolume: async (volume) => {
      const player = getAudioElement();
      const { currentTrack, selectedTrack } = get();
      const targetTrack = currentTrack || selectedTrack;
      if (player) {
        player.muted = get().muted;
        player.volume = getEffectiveVolume(get().masterVolume, volume, get().muted);
      }

      set({ trackVolume: volume });

      if (targetTrack) {
        const settings = parsePlaybackSettings(targetTrack);
        const nextSettings = { ...settings, volume };
        await persistTrackSettings(targetTrack, nextSettings);
      }
    },

    setMasterVolume: async (volume) => {
      const player = getAudioElement();
      const boundedVolume = Math.max(0, Math.min(100, volume));

      if (player) {
        player.muted = get().muted;
        player.volume = getEffectiveVolume(boundedVolume, get().trackVolume, get().muted);
      }

      set({ masterVolume: boundedVolume });
      await ipcAudioSettingsService.setMasterVolume(boundedVolume);
    },

    updatePlaybackSettings: async (updates) => {
      const { currentTrack, selectedTrack } = get();
      const targetTrack = currentTrack || selectedTrack;
      if (!targetTrack) return;

      const currentSettings = parsePlaybackSettings(targetTrack);
      const nextSettings = { ...currentSettings, ...updates };
      const player = getAudioElement();

      if (player && currentTrack?.id === targetTrack.id) {
        player.loop = nextSettings.loop && !nextSettings.endTime;
        if (typeof updates.startTime === 'number' && player.currentTime < updates.startTime) {
          player.currentTime = updates.startTime;
          set({ currentTime: updates.startTime });
        }
      }

      set({
        trackVolume: nextSettings.volume,
        loop: nextSettings.loop,
      });

      await persistTrackSettings(targetTrack, nextSettings);
    },

    toggleMute: () => {
      const player = getAudioElement();
      const muted = !get().muted;
      if (player) {
        player.muted = muted;
        if (!muted) {
          player.volume = getEffectiveVolume(get().masterVolume, get().trackVolume, false);
        }
      }
      set({ muted });
    },

    toggleLoop: async () => {
      const player = getAudioElement();
      const { currentTrack, selectedTrack } = get();
      const targetTrack = currentTrack || selectedTrack;
      const loop = !get().loop;
      if (player) {
        player.loop = loop;
      }
      set({ loop });

      if (targetTrack) {
        const settings = parsePlaybackSettings(targetTrack);
        const nextSettings = { ...settings, loop };
        await persistTrackSettings(targetTrack, nextSettings);
      }
    },

    deleteTrack: async (id) => {
      const player = getAudioElement();
      const { currentTrack, selectedTrack } = get();
      if (currentTrack?.id === id && player) {
        player.pause();
        player.src = '';
        revokeAudioBlobSource();
      }

      await ipcAudioService.delete(id);
      await get().loadTracks();

      set({
        currentTrack: currentTrack?.id === id ? null : get().currentTrack,
        selectedTrack: selectedTrack?.id === id ? null : get().selectedTrack,
        status: currentTrack?.id === id ? 'idle' : get().status,
        currentTime: currentTrack?.id === id ? 0 : get().currentTime,
        duration: currentTrack?.id === id ? 0 : get().duration,
      });
    },
  };
});
