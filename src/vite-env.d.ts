/// <reference types="vite/client" />

interface Window {
  api: {
    getAppVersion: () => Promise<string>;
    system: {
      getInfo: () => Promise<{ version: string; platform: string; userDataPath: string; databasePath: string; logsPath: string }>;
      openPath: (target: 'userData' | 'database' | 'logs') => Promise<boolean>;
    };
    appMenu?: {
      onCommand: (callback: (command: import('./core/windows/appMenu').AppMenuCommand) => void) => () => void;
    };
    window: {
      openOutput: () => Promise<{ isOpen: boolean; isFullscreen: boolean; openCount: number; totalLocalOutputs: number }>;
      closeOutput: () => Promise<boolean>;
      toggleOutputFullscreen: () => Promise<boolean>;
      getOutputState: () => Promise<{ isOpen: boolean; isFullscreen: boolean; openCount: number; totalLocalOutputs: number }>;
    };
    presetEditor?: {
      open: (payload: import('./core/presets/presetEditorWindow').OpenPresetEditorPayload) => Promise<{ ok: boolean; key: string }>;
      close: () => void;
      setDirty: (dirty: boolean) => void;
      notifySaved: (payload: import('./core/presets/presetEditorWindow').PresetEditorSavedPayload) => void;
      onSaved: (callback: (payload: import('./core/presets/presetEditorWindow').PresetEditorSavedPayload) => void) => () => void;
    };
    workspaceWindow?: {
      open: (payload: import('./core/windows/workspaceWindow').OpenWorkspaceWindowPayload) => Promise<{ ok: boolean; key: string }>;
      close: () => void;
      setDirty: (dirty: boolean) => void;
      notifySaved: (payload: import('./core/windows/workspaceWindow').WorkspaceWindowSavedPayload) => void;
      onSaved: (callback: (payload: import('./core/windows/workspaceWindow').WorkspaceWindowSavedPayload) => void) => () => void;
    };
    screen: {
      getDefaultProfile: () => Promise<string>;
      setDefaultProfile: (profileId: string) => Promise<boolean>;
      getDisplays: () => Promise<Array<{ id: string; label: string; isPrimary: boolean; width: number; height: number }>>;
      onChanged?: (callback: (displays: Array<{ id: string; label: string; isPrimary: boolean; width: number; height: number }>) => void) => () => void;
    };
    capture: {
      getScreenSources: () => Promise<Array<{
        id: string;
        name: string;
        type: 'screen' | 'window';
        displayId: string;
        thumbnail: string | null;
      }>>;
      setActiveSource: (payload: { sourceId: string; sourceName: string; includeAudio?: boolean }) => Promise<boolean>;
      clearActiveSource: () => Promise<boolean>;
    };
    outputSettings: {
      getSettings: () => Promise<any>;
      setSettings: (settings: Record<string, unknown>) => Promise<any>;
      getBrowserRuntime: () => Promise<{
        isRunning: boolean;
        port: number;
        urls: string[];
        clients: Array<{
          id: string;
          pairingCode: string;
          isConnected: boolean;
          activeConnections: number;
          lastSeen: string | null;
          url: string;
        }>;
      }>; 
    };
    remote: {
      getRuntime: () => Promise<import('./core/remote/types').RemoteRuntimeSummary>;
      setSettings: (settings: Partial<import('./core/remote/types').RemoteSettings>) => Promise<import('./core/remote/types').RemoteRuntimeSummary>;
      regenerateCode: () => Promise<import('./core/remote/types').RemoteRuntimeSummary>;
      revokeSession: (sessionId?: string | null) => Promise<import('./core/remote/types').RemoteRuntimeSummary>;
    };
    webrtc: {
      prepareProgramCapture: () => Promise<{ ok: boolean; sourceId?: string; sourceName?: string; error?: string }>;
      getPendingOffers: () => Promise<Array<{ peerId: string; pairingCode: string; offer: RTCSessionDescriptionInit }>>;
      sendAnswer: (payload: { peerId: string; answer: RTCSessionDescriptionInit }) => Promise<boolean>;
      sendHostIce: (payload: { peerId: string; candidate: RTCIceCandidateInit }) => Promise<boolean>;
      getBrowserIce: (payload: { peerId: string; after: number }) => Promise<{ candidates: RTCIceCandidateInit[]; next: number }>;
    };
    ndi: {
      getRuntimeStatus: () => Promise<{
        helperAvailable: boolean;
        helperPath: string | null;
        platform: string;
        outputs: Array<{
          outputId: string;
          outputName: string;
          sourceName: string;
          resolution: '1080p' | '720p';
          fps: 30 | 60;
          includeAudio: boolean;
          alphaEnabled: boolean;
          state: 'idle' | 'starting' | 'live' | 'error' | 'unavailable';
          lastStartedAt: string | null;
          error: string | null;
        }>;
      }>;
      startOutput: (outputId: string) => Promise<any>;
      stopOutput: (outputId: string) => Promise<any>;
    };
    audioSettings: {
      getMasterVolume: () => Promise<number>;
      setMasterVolume: (volume: number) => Promise<boolean>;
    };
    sync: {
      broadcast: (channel: string, data: unknown) => void;
      getPresentationSnapshot: (outputId?: string | null) => Promise<any>;
      subscribe: (callback: (event: { channel: string; data: unknown }) => void) => () => void;
    };
    bible: {
      getVersions: () => Promise<any[]>;
      getActiveVersion: () => Promise<any | undefined>;
      setActiveVersion: (id: string) => Promise<void>;
      deleteVersion: (id: string) => Promise<void>;
      load: (versionId?: string) => Promise<any>;
      getActiveBuffer: () => Promise<ArrayBuffer | null>;
      getStorageStats: () => Promise<{
        rumediaPath: string;
        biblesPath: string;
        totalBiblesSize: number;
        biblesCount: number;
        totalSizeInMB: number;
      }>;
      clearCache: () => Promise<void>;
      setApiKey: (key: string | null) => Promise<void>;
      importFile: () => Promise<any>;
      getCloudBibles: () => Promise<any[]>;
      searchCloudBibles: (query: string) => Promise<any[]>;
      getCountries: (query?: string) => Promise<any[]>;
      getLanguages: (payload?: { countryId?: string; query?: string }) => Promise<any[]>;
      getBibles: (payload: { language: string; query?: string }) => Promise<any[]>;
      downloadCloud: (payload: { abbr: string; name: string; filesetId: string; language?: string }) => Promise<any>;
      subscribeDownloadProgress: (
        callback: (event: { code: string; loaded: number; total: number; percent: number }) => void
      ) => () => void;
    };
    song: {
      getAll: () => Promise<any[]>;
      getLibraryPage: (payload: {
        offset?: number;
        limit?: number;
        query?: string;
        searchBy?: 'all' | 'title' | 'lyrics' | 'author';
        favoritesOnly?: boolean;
        tag?: string | null;
        songIds?: string[] | null;
        sortBy?: 'title' | 'author' | 'copyright';
        sortDirection?: 'asc' | 'desc';
      }) => Promise<{ items: any[]; total: number; offset: number; limit: number }>;
      getLibraryTags: () => Promise<string[]>;
      getById: (id: string, role?: string | null, outputId?: string | null) => Promise<any>;
      search: (query: string) => Promise<any[]>;
      create: (title: string, lyrics: string, author?: string) => Promise<string>;
      update: (id: string, data: any) => Promise<void>;
      delete: (id: string) => Promise<void>;
      scanEasyWorship: () => Promise<{
        folderPath: string;
        total: number;
        songs: Array<{
          sourceId: number;
          title: string;
          author: string | null;
          copyright: string | null;
          ccliNumber: string | null;
          slideCount: number;
          alreadyExists: boolean;
        }>;
      } | null>;
      importEasyWorship: (payload: { folderPath: string; sourceIds: number[] }) => Promise<{
        folderPath: string;
        imported: number;
        skipped: number;
        failed: number;
        total: number;
        errors: Array<{ title: string; reason: string }>;
      }>;
      deleteEasyWorshipImports: () => Promise<{ deleted: number }>;
    };
    media: {
      getAll: () => Promise<any[]>;
      getLibraryPage: (payload: {
        offset?: number;
        limit?: number;
        query?: string;
        mediaTypes?: string[] | null;
        favoritesOnly?: boolean;
        tag?: string | null;
        mediaIds?: string[] | null;
        sortBy?: 'filename' | 'mediaType' | 'createdAt';
        sortDirection?: 'asc' | 'desc';
      }) => Promise<{ items: any[]; total: number; offset: number; limit: number }>;
      getLibraryTags: () => Promise<string[]>;
      getById: (id: string) => Promise<any>;
      create: (data: any) => Promise<string>;
      update: (id: string, data: any) => Promise<void>;
      delete: (id: string) => Promise<void>;
      importFile: () => Promise<any>;
      importPdfFile: () => Promise<any>;
      selectPdfFiles: () => Promise<string[]>;
      saveCompiledPdf: (payload: { filename: string, buffers: ArrayBuffer[], width: number, height: number }) => Promise<any>;
      updateCompiledPdf: (payload: { id: string, filename: string, buffers: ArrayBuffer[], width: number, height: number }) => Promise<any>;
      cleanupOrphans: () => Promise<any>;
    };
    audio: {
      getAll: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      update: (id: string, data: any) => Promise<void>;
      delete: (id: string) => Promise<void>;
      readFile: (source: string) => Promise<ArrayBuffer>;
      importFile: () => Promise<any>;
      importFiles: (paths: string[]) => Promise<any>;
    };
    theme: {
      getAll: () => Promise<any[]>;
      create: (data: any) => Promise<string>;
      update: (id: string, data: any) => Promise<void>;
      delete: (id: string) => Promise<void>;
    };
    schedule: {
      getAll: () => Promise<any[]>;
      getById: (id: string) => Promise<any>;
      create: (data: any) => Promise<string>;
      update: (id: string, data: any) => Promise<void>;
      delete: (id: string) => Promise<void>;
      // Items
      addItem: (data: any) => Promise<string>;
      updateItem: (id: string, data: any) => Promise<void>;
      deleteItem: (id: string) => Promise<void>;
      reorderItems: (scheduleId: string, itemIds: string[]) => Promise<void>;
      duplicateItem: (itemId: string) => Promise<string>;
      cloneSchedule: (scheduleId: string, newName: string) => Promise<string>;
    };
    template: {
      getAll: () => Promise<any[]>;
      getLibraryPage: (payload: {
        offset?: number;
        limit?: number;
        query?: string;
        category?: string | null;
        contentType?: 'song' | 'scripture' | 'presentation' | 'media' | null;
        sortBy?: 'name' | 'category' | 'createdAt';
        sortDirection?: 'asc' | 'desc';
      }) => Promise<{ items: any[]; total: number; offset: number; limit: number }>;
      getLibraryCategories: () => Promise<string[]>;
      getById: (id: string) => Promise<any>;
      create: (data: any) => Promise<string>;
      update: (id: string, data: any) => Promise<void>;
      updatePreview: (id: string, previewUrl: string | null) => Promise<void>;
      delete: (id: string) => Promise<void>;
    };
    presetPreview: {
      save: (payload: { id: string; dataUrl: string; previousUrl?: string | null }) => Promise<string>;
      delete: (previewUrl: string) => Promise<void>;
    };
    dbManager: {
      backup: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
      restore: () => Promise<{ success: boolean; error?: string }>;
      getCacheStats: () => Promise<{ totalBytes: number; folders: Array<{ name: string; size: number }> }>;
      listCacheAssets: () => Promise<any[]>;
      deleteCacheAsset: (id: string) => Promise<boolean>;
      clearUnusedCache: () => Promise<{ deletedCount: number; savedBytes: number }>;
      deleteSong: (id: string) => Promise<void>;
      deleteSongsBatch: (ids: string[]) => Promise<void>;
    };
    ai?: {
      getStatus: () => Promise<{
        enabled: boolean;
        modelDownloaded: boolean;
        downloading: boolean;
        downloadProgress: number;
        downloadedBytes: number;
        totalBytes: number;
        error?: string | null;
      }>;
      toggleEnable: (enabled: boolean) => Promise<any>;
      cancelDownload: () => Promise<void>;
      formatLyric: (rawLyric: string, options?: { maxCharsPerLine?: number; maxLinesPerSlide?: number; autoFixTypos?: boolean }) => Promise<{ title?: string; slides: Array<{ title: string; content: string }> }>;
      runAutoTagging: () => Promise<{ processedSongs: number; totalSongs: number; createdPlaylists: number; tagsAssigned: number }>;
      onStatusChanged: (callback: (status: any) => void) => () => void;
      onAutoTaggingProgress: (callback: (progress: { processed: number; total: number; log: string }) => void) => () => void;
    };
    shell?: {
      openExternal: (url: string) => Promise<void>;
    };
  };
}
