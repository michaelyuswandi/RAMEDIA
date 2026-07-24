import { create } from 'zustand';
import {
  EMPTY_LIVE_CAPTURE_STATE,
  Slide,
  LayerState,
  PointerState,
  SlideAnnotation,
  TransitionMode,
  LiveCaptureState,
  MediaPlaybackState,
  OutputAlertMessage,
  OutputAlertTone,
} from '../models/types';
import { sync } from '../sync/index';
import { findPrimaryVideoLayer, getVideoPlaybackId } from '../utils/videoLayers';
import { useSettingsStore } from './useSettingsStore';

interface PresentationState {
  // Live State
  currentSlide: Slide | null;
  previousSlide: Slide | null;
  nextSlide: Slide | null;
  previewSlide: Slide | null; // New Preview State
  layers: LayerState[];
  isBlack: boolean;
  isClear: boolean;
  isLogo: boolean;
  pointer: PointerState;
  transitionMode: TransitionMode;
  annotations: Record<string, SlideAnnotation[]>;
  liveCapture: LiveCaptureState;
  mediaPlayback: MediaPlaybackState | null;
  manualAlert: OutputAlertMessage | null;
  showName: string | null;
  slideIndex: number;
  totalSlides: number;
  
  // Actions
  goLive: (slide: Slide, context?: { showName?: string | null; slideIndex?: number; totalSlides?: number; nextSlide?: Slide | null }) => Promise<void>;
  setPreviewSlide: (slide: Slide | null) => void;
  controlLiveMediaPlayback: (updates: Partial<Omit<MediaPlaybackState, 'commandId' | 'updatedAt'>>) => void;
  startCapture: (capture: Omit<LiveCaptureState, 'active' | 'startedAt' | 'error'> & { startedAt?: string | null }) => void;
  stopCapture: () => void;
  setCaptureError: (error: string) => void;
  setBlack: (black: boolean) => void;
  setClear: (clear: boolean) => void;
  setLogo: (logo: boolean) => void;
  showAlert: (alert: {
    text: string;
    tone?: OutputAlertTone;
    targetOutputIds: string[];
    position: 'top' | 'bottom';
    durationMs: number | null;
  }) => void;
  hideAlert: () => void;
  setPointerEnabled: (enabled: boolean) => void;
  updatePointer: (x: number, y: number, visible?: boolean) => void;
  hidePointer: () => void;
  setTransitionMode: (mode: TransitionMode) => void;
  addAnnotation: (slideId: string, annotation: SlideAnnotation) => void;
  clearAnnotations: (slideId: string) => void;
  undoAnnotation: (slideId: string) => void;
  updateLayer: (id: string, updates: Partial<LayerState>) => void;
  receiveUpdate: (type: string, payload: any) => void;
}

let latestGoLiveRequest = 0;
let manualAlertTimer: number | null = null;

export const usePresentationStore = create<PresentationState>((set, _get) => ({
  currentSlide: null,
  previousSlide: null,
  nextSlide: null,
  previewSlide: null,
  layers: [
    { id: 'bg', type: 'background', zIndex: 100, visible: true, opacity: 1, content: '#000000' },
    { id: 'media', type: 'media', zIndex: 200, visible: true, opacity: 1 },
    { id: 'overlay', type: 'overlay', zIndex: 300, visible: true, opacity: 1 },
    { id: 'text', type: 'text', zIndex: 400, visible: true, opacity: 1 },
  ],
  isBlack: false,
  isClear: false,
  isLogo: false,
  pointer: {
    enabled: false,
    visible: false,
    x: 0.5,
    y: 0.5,
  },
  transitionMode: 'fade',
  annotations: {},
  liveCapture: EMPTY_LIVE_CAPTURE_STATE,
  mediaPlayback: null,
  manualAlert: null,
  showName: null,
  slideIndex: 0,
  totalSlides: 0,

  goLive: async (slide, context) => {
    const requestId = ++latestGoLiveRequest;
    const previousPlayback = _get().mediaPlayback;
    const videoLayer = findPrimaryVideoLayer(slide);
    const playbackSettings = videoLayer?.playbackSettings || {};
    const isSongBackground = Boolean(videoLayer) && (
      videoLayer?.style.isSongBackground === true
      || (Boolean((slide as any).songId) && videoLayer?.layer.layerType === 'background')
    );
    const nextMediaId = getVideoPlaybackId(videoLayer);
    const continuesPreviousVideo = Boolean(
      previousPlayback?.mediaId
      && nextMediaId
      && previousPlayback.mediaId === nextMediaId
    );
    const now = Date.now();
    const stoppedPlayback: MediaPlaybackState | null = previousPlayback?.mediaId && !continuesPreviousVideo
      ? {
          ...previousPlayback,
          status: 'stopped',
          currentTime: 0,
          commandId: crypto.randomUUID(),
          updatedAt: now,
        }
      : null;
    const nextMediaPlayback: MediaPlaybackState | null = continuesPreviousVideo && previousPlayback
      ? previousPlayback
      : videoLayer
        ? {
          mediaId: nextMediaId,
          status: 'playing',
          currentTime: Number(playbackSettings.startTime) || 0,
          volume: isSongBackground
            ? 0
            : typeof playbackSettings.volume === 'number' ? playbackSettings.volume : 100,
          playbackRate: Number(playbackSettings.speed) || 1,
          behavior: ['loop', 'stop', 'hold'].includes(String(playbackSettings.behavior)) ? playbackSettings.behavior : 'loop',
          commandId: crypto.randomUUID(),
          updatedAt: now,
        }
        : null;

    const nextSlideVal = context?.nextSlide ?? null;
    const showNameVal = context?.showName ?? _get().showName;
    const slideIndexVal = typeof context?.slideIndex === 'number' ? context.slideIndex : 0;
    const totalSlidesVal = typeof context?.totalSlides === 'number' ? context.totalSlides : 0;

    set((state) => ({
      previousSlide: state.currentSlide,
      currentSlide: slide,
      nextSlide: nextSlideVal,
      showName: showNameVal,
      slideIndex: slideIndexVal,
      totalSlides: totalSlidesVal,
      isBlack: false,
      isClear: false,
      isLogo: false,
      liveCapture: EMPTY_LIVE_CAPTURE_STATE,
      mediaPlayback: nextMediaPlayback,
    }));

    if (window.api?.window?.openOutput) {
      try {
        let outputState = await window.api.window.getOutputState();
        if (!outputState.isOpen) {
          outputState = await window.api.window.openOutput();
        }
        window.dispatchEvent(new CustomEvent('rumedia:output-state-changed', { detail: outputState }));
      } catch (error) {
        console.error('[PresentationStore] Failed to check/open output windows:', error);
      }
    }

    if (requestId !== latestGoLiveRequest) return;

    if (stoppedPlayback) {
      sync.broadcast('STATE_UPDATE', { type: 'MEDIA_PLAYBACK', payload: stoppedPlayback });
    }
    if (!continuesPreviousVideo) {
      sync.broadcast('STATE_UPDATE', { type: 'MEDIA_PLAYBACK', payload: nextMediaPlayback });
    }
    sync.broadcast('STATE_UPDATE', { 
      type: 'STATE_SNAPSHOT', 
      payload: {
        currentSlide: slide,
        previousSlide: _get().previousSlide,
        nextSlide: nextSlideVal,
        showName: showNameVal,
        slideIndex: slideIndexVal,
        totalSlides: totalSlidesVal,
        isBlack: false,
        isClear: false,
        isLogo: false,
        transitionMode: _get().transitionMode,
        annotations: _get().annotations,
        liveCapture: EMPTY_LIVE_CAPTURE_STATE,
        mediaPlayback: nextMediaPlayback,
        pointer: _get().pointer,
      } 
    });
    sync.broadcast('STATE_UPDATE', { type: 'CAPTURE_STOP' });
  },

  setPreviewSlide: (slide) => {
    set({ previewSlide: slide });
  },

  controlLiveMediaPlayback: (updates) => {
    const current = _get().mediaPlayback;
    const next: MediaPlaybackState = {
      mediaId: updates.mediaId ?? current?.mediaId ?? null,
      status: updates.status ?? current?.status ?? 'paused',
      currentTime: Math.max(0, Number(updates.currentTime ?? current?.currentTime ?? 0) || 0),
      volume: Math.max(0, Math.min(100, Number(updates.volume ?? current?.volume ?? 100) || 0)),
      playbackRate: Math.max(0.1, Number(updates.playbackRate ?? current?.playbackRate ?? 1) || 1),
      behavior: updates.behavior ?? current?.behavior ?? 'loop',
      commandId: crypto.randomUUID(),
      updatedAt: Date.now(),
    };
    set({ mediaPlayback: next });
    sync.broadcast('STATE_UPDATE', { type: 'MEDIA_PLAYBACK', payload: next });
  },

  startCapture: (capture) => {
    const nextCapture: LiveCaptureState = {
      active: true,
      sourceType: capture.sourceType,
      sourceId: capture.sourceId,
      sourceName: capture.sourceName,
      includeAudio: capture.includeAudio,
      startedAt: capture.startedAt || new Date().toISOString(),
      error: null,
    };

    set({ liveCapture: nextCapture, isBlack: false, isClear: false, isLogo: false });
    sync.broadcast('STATE_UPDATE', { type: 'CAPTURE_START', payload: nextCapture });
  },

  stopCapture: () => {
    set({ liveCapture: EMPTY_LIVE_CAPTURE_STATE });
    sync.broadcast('STATE_UPDATE', { type: 'CAPTURE_STOP' });
  },

  setCaptureError: (error) => {
    set((state) => ({
      liveCapture: {
        ...state.liveCapture,
        active: false,
        error,
      },
    }));
    sync.broadcast('STATE_UPDATE', { type: 'CAPTURE_ERROR', payload: error });
  },

  setBlack: (black) => {
    set({ isBlack: black, ...(black ? { isClear: false, isLogo: false } : {}) });
    sync.broadcast('STATE_UPDATE', { type: 'BLACK_TOGGLE', payload: black });
  },

  setClear: (clear) => {
    set({ isClear: clear, ...(clear ? { isBlack: false, isLogo: false } : {}) });
    sync.broadcast('STATE_UPDATE', { type: 'CLEAR_TOGGLE', payload: clear });
  },

  setLogo: (logo) => {
    set({ isLogo: logo, ...(logo ? { isBlack: false, isClear: false } : {}) });
    sync.broadcast('STATE_UPDATE', { type: 'LOGO_TOGGLE', payload: logo });
  },

  showAlert: ({ text, tone = 'info', targetOutputIds, position, durationMs }) => {
    const normalizedText = text.trim().slice(0, 160);
    const normalizedTargets = Array.from(new Set(targetOutputIds.filter(Boolean)));
    if (!normalizedText || normalizedTargets.length === 0) return;

    if (manualAlertTimer !== null) {
      window.clearTimeout(manualAlertTimer);
      manualAlertTimer = null;
    }

    const createdAt = Date.now();
    const normalizedDuration = durationMs === null
      ? null
      : Math.max(1000, Math.min(30000, Math.round(durationMs)));
    const nextAlert: OutputAlertMessage = {
      id: crypto.randomUUID(),
      text: normalizedText,
      tone,
      targetOutputIds: normalizedTargets,
      position,
      durationMs: normalizedDuration,
      createdAt,
      expiresAt: normalizedDuration === null ? null : createdAt + normalizedDuration,
    };

    set({ manualAlert: nextAlert });
    sync.broadcast('STATE_UPDATE', { type: 'ALERT_SHOW', payload: nextAlert });

    if (normalizedDuration !== null) {
      manualAlertTimer = window.setTimeout(() => {
        if (_get().manualAlert?.id !== nextAlert.id) return;
        set({ manualAlert: null });
        sync.broadcast('STATE_UPDATE', { type: 'ALERT_HIDE', payload: { id: nextAlert.id } });
        manualAlertTimer = null;
      }, normalizedDuration);
    }
  },

  hideAlert: () => {
    const currentAlertId = _get().manualAlert?.id || null;
    if (manualAlertTimer !== null) {
      window.clearTimeout(manualAlertTimer);
      manualAlertTimer = null;
    }
    set({ manualAlert: null });
    sync.broadcast('STATE_UPDATE', { type: 'ALERT_HIDE', payload: { id: currentAlertId } });
  },

  setPointerEnabled: (enabled) => {
    set((state) => ({
      pointer: {
        ...state.pointer,
        enabled,
        visible: enabled ? state.pointer.visible : false,
      },
    }));
    sync.broadcast('STATE_UPDATE', { type: 'POINTER_ENABLED', payload: enabled });
    if (!enabled) {
      sync.broadcast('STATE_UPDATE', { type: 'POINTER_HIDE' });
    }
  },

  updatePointer: (x, y, visible = true) => {
    set((state) => ({
      pointer: {
        ...state.pointer,
        x,
        y,
        visible,
      },
    }));
    sync.broadcast('STATE_UPDATE', {
      type: 'POINTER_MOVE',
      payload: { x, y, visible },
    });
  },

  hidePointer: () => {
    set((state) => ({
      pointer: {
        ...state.pointer,
        visible: false,
      },
    }));
    sync.broadcast('STATE_UPDATE', { type: 'POINTER_HIDE' });
  },

  setTransitionMode: (mode) => {
    set({ transitionMode: mode });
    sync.broadcast('STATE_UPDATE', { type: 'TRANSITION_CHANGE', payload: mode });
  },

  addAnnotation: (slideId, annotation) => {
    set((state) => ({
      annotations: {
        ...state.annotations,
        [slideId]: [...(state.annotations[slideId] || []), annotation],
      },
    }));
    sync.broadcast('STATE_UPDATE', { type: 'ANNOTATIONS_SET', payload: { slideId, annotations: [...((_get().annotations[slideId] || [])), annotation] } });
  },

  clearAnnotations: (slideId) => {
    set((state) => ({
      annotations: {
        ...state.annotations,
        [slideId]: [],
      },
    }));
    sync.broadcast('STATE_UPDATE', { type: 'ANNOTATIONS_SET', payload: { slideId, annotations: [] } });
  },

  undoAnnotation: (slideId) => {
    const nextAnnotations = (_get().annotations[slideId] || []).slice(0, -1);
    set((state) => ({
      annotations: {
        ...state.annotations,
        [slideId]: nextAnnotations,
      },
    }));
    sync.broadcast('STATE_UPDATE', { type: 'ANNOTATIONS_SET', payload: { slideId, annotations: nextAnnotations } });
  },

  updateLayer: (id, updates) => {
    set((state) => ({
      layers: state.layers.map(l => l.id === id ? { ...l, ...updates } : l)
    }));
  },

  receiveUpdate: (type: string, payload: any) => {
    switch (type) {
      case 'OUTPUT_SETTINGS_CHANGED':
        useSettingsStore.getState().setSettings(payload);
        break;
      case 'SLIDE_CHANGE':
        set((state) => ({
          previousSlide: state.currentSlide,
          currentSlide: payload,
          nextSlide: null,
          isBlack: false,
          isClear: false,
          isLogo: false,
          liveCapture: EMPTY_LIVE_CAPTURE_STATE,
        }));
        break;
      case 'MEDIA_PLAYBACK':
        set({ mediaPlayback: payload || null });
        break;
      case 'CAPTURE_START':
        set({
          liveCapture: {
            ...EMPTY_LIVE_CAPTURE_STATE,
            ...payload,
            active: true,
            error: null,
          },
          isBlack: false,
          isClear: false,
          isLogo: false,
        });
        break;
      case 'CAPTURE_STOP':
        set({ liveCapture: EMPTY_LIVE_CAPTURE_STATE });
        break;
      case 'CAPTURE_ERROR':
        set((state) => ({
          liveCapture: {
            ...state.liveCapture,
            active: false,
            error: typeof payload === 'string' ? payload : 'Capture failed',
          },
        }));
        break;
      case 'BLACK_TOGGLE': set({ isBlack: !!payload, ...(payload ? { isClear: false, isLogo: false } : {}) }); break;
      case 'CLEAR_TOGGLE': set({ isClear: !!payload, ...(payload ? { isBlack: false, isLogo: false } : {}) }); break;
      case 'LOGO_TOGGLE': set({ isLogo: !!payload, ...(payload ? { isBlack: false, isClear: false } : {}) }); break;
      case 'ALERT_SHOW':
        set({ manualAlert: payload || null });
        break;
      case 'ALERT_HIDE':
        set((state) => (
          !payload?.id || state.manualAlert?.id === payload.id
            ? { manualAlert: null }
            : { manualAlert: state.manualAlert }
        ));
        break;
      case 'POINTER_ENABLED':
        set((state) => ({
          pointer: {
            ...state.pointer,
            enabled: !!payload,
            visible: payload ? state.pointer.visible : false,
          },
        }));
        break;
      case 'POINTER_MOVE':
        set((state) => ({
          pointer: {
            ...state.pointer,
            x: typeof payload?.x === 'number' ? payload.x : state.pointer.x,
            y: typeof payload?.y === 'number' ? payload.y : state.pointer.y,
            visible: payload?.visible ?? true,
          },
        }));
        break;
      case 'POINTER_HIDE':
        set((state) => ({
          pointer: {
            ...state.pointer,
            visible: false,
          },
        }));
        break;
      case 'TRANSITION_CHANGE':
        set({ transitionMode: payload });
        break;
      case 'ANNOTATIONS_SET':
        if (payload?.slideId) {
          set((state) => ({
            annotations: {
              ...state.annotations,
              [payload.slideId]: Array.isArray(payload.annotations) ? payload.annotations : [],
            },
          }));
        }
        break;
      case 'STATE_SNAPSHOT':
        set({
          currentSlide: payload.currentSlide,
          previousSlide: payload.previousSlide ?? null,
          nextSlide: payload.nextSlide ?? null,
          isBlack: payload.isBlack,
          isClear: payload.isClear,
          isLogo: payload.isLogo ?? false,
          transitionMode: payload.transitionMode ?? 'fade',
          annotations: payload.annotations ?? {},
          liveCapture: payload.liveCapture ?? EMPTY_LIVE_CAPTURE_STATE,
          mediaPlayback: payload.mediaPlayback ?? null,
          manualAlert: payload.manualAlert ?? null,
          showName: payload.showName ?? null,
          slideIndex: typeof payload.slideIndex === 'number' ? payload.slideIndex : 0,
          totalSlides: typeof payload.totalSlides === 'number' ? payload.totalSlides : 0,
          pointer: payload.pointer ?? {
            enabled: false,
            visible: false,
            x: 0.5,
            y: 0.5,
          },
        });
        break;
    }
  }
}));
