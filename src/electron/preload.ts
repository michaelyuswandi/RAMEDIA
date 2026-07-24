import { contextBridge, ipcRenderer } from 'electron';
import type { AppMenuCommand } from '../core/windows/appMenu';

contextBridge.exposeInMainWorld('api', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  system: {
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    openPath: (target: 'userData' | 'database' | 'logs') => ipcRenderer.invoke('system:openPath', target),
  },
  appMenu: {
    onCommand: (callback: (command: AppMenuCommand) => void) => {
      const listener = (_event: unknown, command: AppMenuCommand) => callback(command);
      ipcRenderer.on('appMenu:command', listener);
      return () => ipcRenderer.removeListener('appMenu:command', listener);
    },
  },
  window: {
    openOutput: () => ipcRenderer.invoke('window:openOutput'),
    closeOutput: () => ipcRenderer.invoke('window:closeOutput'),
    toggleOutputFullscreen: () => ipcRenderer.invoke('window:toggleOutputFullscreen'),
    getOutputState: () => ipcRenderer.invoke('window:getOutputState'),
  },
  presetEditor: {
    open: (payload: { kind: 'content-theme' | 'screen-layout' | 'choose'; id?: string | null; name?: string | null }) =>
      ipcRenderer.invoke('presetEditor:open', payload),
    close: () => ipcRenderer.send('presetEditor:close'),
    setDirty: (dirty: boolean) => ipcRenderer.send('presetEditor:setDirty', dirty),
    notifySaved: (payload: { kind: 'content-theme' | 'screen-layout'; id?: string | null }) =>
      ipcRenderer.send('presetEditor:saved', payload),
    onSaved: (callback: (payload: { kind: 'content-theme' | 'screen-layout'; id?: string | null }) => void) => {
      const listener = (_event: unknown, payload: { kind: 'content-theme' | 'screen-layout'; id?: string | null }) => callback(payload);
      ipcRenderer.on('presetEditor:saved', listener);
      return () => ipcRenderer.removeListener('presetEditor:saved', listener);
    },
  },
  workspaceWindow: {
    open: (payload: { kind: 'song-editor' | 'settings' | 'bible-settings'; id?: string | null; name?: string | null }) =>
      ipcRenderer.invoke('workspaceWindow:open', payload),
    close: () => ipcRenderer.send('workspaceWindow:close'),
    setDirty: (dirty: boolean) => ipcRenderer.send('workspaceWindow:setDirty', dirty),
    notifySaved: (payload: { kind: 'song' | 'settings' | 'bible-settings'; id?: string | null }) =>
      ipcRenderer.send('workspaceWindow:saved', payload),
    onSaved: (callback: (payload: { kind: 'song' | 'settings' | 'bible-settings'; id?: string | null }) => void) => {
      const listener = (_event: unknown, payload: { kind: 'song' | 'settings' | 'bible-settings'; id?: string | null }) => callback(payload);
      ipcRenderer.on('workspaceWindow:saved', listener);
      return () => ipcRenderer.removeListener('workspaceWindow:saved', listener);
    },
  },
  screen: {
    getDefaultProfile: () => ipcRenderer.invoke('screen:getDefaultProfile'),
    setDefaultProfile: (profileId: string) => ipcRenderer.invoke('screen:setDefaultProfile', profileId),
    getDisplays: () => ipcRenderer.invoke('screen:getDisplays'),
    onChanged: (callback: (displays: any[]) => void) => {
      const listener = (_event: any, displays: any[]) => callback(displays);
      ipcRenderer.on('screen:changed', listener);
      return () => ipcRenderer.removeListener('screen:changed', listener);
    },
  },
  capture: {
    getScreenSources: () => ipcRenderer.invoke('capture:getScreenSources'),
    setActiveSource: (payload: { sourceId: string; sourceName: string; includeAudio?: boolean }) =>
      ipcRenderer.invoke('capture:setActiveSource', payload),
    clearActiveSource: () => ipcRenderer.invoke('capture:clearActiveSource'),
  },
  outputSettings: {
    getSettings: () => ipcRenderer.invoke('outputSettings:get'),
    setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('outputSettings:set', settings),
    getBrowserRuntime: () => ipcRenderer.invoke('browserOutput:getRuntime'),
  },
  remote: {
    getRuntime: () => ipcRenderer.invoke('remote:getRuntime'),
    setSettings: (settings: Record<string, unknown>) => ipcRenderer.invoke('remote:setSettings', settings),
    regenerateCode: () => ipcRenderer.invoke('remote:regenerateCode'),
    revokeSession: (sessionId?: string | null) => ipcRenderer.invoke('remote:revokeSession', sessionId || null),
  },
  webrtc: {
    prepareProgramCapture: () => ipcRenderer.invoke('webrtc:prepareProgramCapture'),
    getPendingOffers: () => ipcRenderer.invoke('webrtc:getPendingOffers'),
    sendAnswer: (payload: { peerId: string; answer: RTCSessionDescriptionInit }) =>
      ipcRenderer.invoke('webrtc:sendAnswer', payload),
    sendHostIce: (payload: { peerId: string; candidate: RTCIceCandidateInit }) =>
      ipcRenderer.invoke('webrtc:sendHostIce', payload),
    getBrowserIce: (payload: { peerId: string; after: number }) =>
      ipcRenderer.invoke('webrtc:getBrowserIce', payload),
  },
  ndi: {
    getRuntimeStatus: () => ipcRenderer.invoke('ndi:getRuntimeStatus'),
    startOutput: (outputId: string) => ipcRenderer.invoke('ndi:startOutput', outputId),
    stopOutput: (outputId: string) => ipcRenderer.invoke('ndi:stopOutput', outputId),
  },
  audioSettings: {
    getMasterVolume: () => ipcRenderer.invoke('audioSettings:getMasterVolume'),
    setMasterVolume: (volume: number) => ipcRenderer.invoke('audioSettings:setMasterVolume', volume),
  },
  sync: {
    broadcast: (channel: string, data: unknown) => ipcRenderer.send('sync:broadcast', { channel, data }),
    getPresentationSnapshot: (outputId?: string | null) =>
      ipcRenderer.invoke('sync:getPresentationSnapshot', outputId || null),
    subscribe: (callback: (event: { channel: string; data: unknown }) => void) => {
      const listener = (_event: unknown, payload: { channel: string; data: unknown }) => callback(payload);
      ipcRenderer.on('sync:event', listener);
      return () => ipcRenderer.removeListener('sync:event', listener);
    },
  },

  bible: {
    getVersions: () => ipcRenderer.invoke('bible:getVersions'),
    getActiveVersion: () => ipcRenderer.invoke('bible:getActiveVersion'),
    setActiveVersion: (id: string) => ipcRenderer.invoke('bible:setActiveVersion', id),
    deleteVersion: (id: string) => ipcRenderer.invoke('bible:deleteVersion', id),
    load: (versionId?: string) => ipcRenderer.invoke('bible:load', versionId),
    getActiveBuffer: () => ipcRenderer.invoke('bible:getActiveBuffer'),
    getStorageStats: () => ipcRenderer.invoke('bible:getStorageStats'),
    clearCache: () => ipcRenderer.invoke('bible:clearCache'),
    setApiKey: (key: string | null) => ipcRenderer.invoke('bible:setApiKey', key),
    importFile: () => ipcRenderer.invoke('bible:importFile'),
    getCloudBibles: () => ipcRenderer.invoke('bible:getCloudBibles'),
    searchCloudBibles: (query: string) => ipcRenderer.invoke('bible:searchCloudBibles', query),
    getCountries: (query?: string) => ipcRenderer.invoke('bible:getCountries', query),
    getLanguages: (payload?: { countryId?: string; query?: string }) => ipcRenderer.invoke('bible:getLanguages', payload),
    getBibles: (payload: { language: string; query?: string }) => ipcRenderer.invoke('bible:getBibles', payload),
    downloadCloud: (payload: { abbr: string; name: string; filesetId: string; language?: string }) =>
      ipcRenderer.invoke('bible:downloadCloud', payload),
    subscribeDownloadProgress: (callback: (event: { code: string; loaded: number; total: number; percent: number }) => void) => {
      const listener = (_event: unknown, payload: { code: string; loaded: number; total: number; percent: number }) => callback(payload);
      ipcRenderer.on('bible:downloadProgress', listener);
      return () => ipcRenderer.removeListener('bible:downloadProgress', listener);
    },
  },
  
  // Song API
  song: {
    getAll: () => ipcRenderer.invoke('song:getAll'),
    getLibraryPage: (payload: any) => ipcRenderer.invoke('song:getLibraryPage', payload),
    getLibraryTags: () => ipcRenderer.invoke('song:getLibraryTags'),
    getById: (id: string, role?: string | null, outputId?: string | null) =>
      ipcRenderer.invoke('song:getById', role || outputId ? { id, role: role || null, outputId: outputId || null } : id),
    search: (query: string) => ipcRenderer.invoke('song:search', query),
    create: (title: string, lyrics: string, author?: string) => 
      ipcRenderer.invoke('song:create', { title, lyrics, author }),
    update: (id: string, data: any) => ipcRenderer.invoke('song:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('song:delete', id),
    scanEasyWorship: () => ipcRenderer.invoke('song:scanEasyWorship'),
    importEasyWorship: (payload: { folderPath: string; sourceIds: number[] }) =>
      ipcRenderer.invoke('song:importEasyWorship', payload),
    deleteEasyWorshipImports: () => ipcRenderer.invoke('song:deleteEasyWorshipImports'),
  },

  // Media API
  media: {
    getAll: () => ipcRenderer.invoke('media:getAll'),
    getLibraryPage: (payload: any) => ipcRenderer.invoke('media:getLibraryPage', payload),
    getLibraryTags: () => ipcRenderer.invoke('media:getLibraryTags'),
    getById: (id: string) => ipcRenderer.invoke('media:getById', id),
    create: (data: any) => ipcRenderer.invoke('media:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('media:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('media:delete', id),
    importFile: () => ipcRenderer.invoke('media:importFile'),
    importPdfFile: () => ipcRenderer.invoke('media:importPdfFile'),
    selectPdfFiles: () => ipcRenderer.invoke('media:selectPdfFiles'),
    saveCompiledPdf: (payload: { filename: string, buffers: ArrayBuffer[], width: number, height: number }) => 
      ipcRenderer.invoke('media:saveCompiledPdf', payload),
    updateCompiledPdf: (payload: { id: string, filename: string, buffers: ArrayBuffer[], width: number, height: number }) =>
      ipcRenderer.invoke('media:updateCompiledPdf', payload),
    cleanupOrphans: () => ipcRenderer.invoke('media:cleanupOrphans'),
  },

  audio: {
    getAll: () => ipcRenderer.invoke('audio:getAll'),
    getById: (id: string) => ipcRenderer.invoke('audio:getById', id),
    update: (id: string, data: any) => ipcRenderer.invoke('audio:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('audio:delete', id),
    readFile: (source: string) => ipcRenderer.invoke('audio:readFile', source),
    importFile: () => ipcRenderer.invoke('audio:importFile'),
    importFiles: (paths: string[]) => ipcRenderer.invoke('audio:importFiles', paths),
  },

  // Theme API
  theme: {
    getAll: () => ipcRenderer.invoke('theme:getAll'),
    create: (data: any) => ipcRenderer.invoke('theme:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('theme:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('theme:delete', id),
  },

  // Schedule API
  schedule: {
    getAll: () => ipcRenderer.invoke('schedule:getAll'),
    getById: (id: string) => ipcRenderer.invoke('schedule:getById', id),
    create: (data: any) => ipcRenderer.invoke('schedule:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('schedule:update', { id, data }),
    delete: (id: string) => ipcRenderer.invoke('schedule:delete', id),
    
    // Items
    addItem: (data: any) => ipcRenderer.invoke('schedule:addItem', data),
    updateItem: (id: string, data: any) => ipcRenderer.invoke('schedule:updateItem', { id, data }),
    deleteItem: (id: string) => ipcRenderer.invoke('schedule:deleteItem', id),
    reorderItems: (scheduleId: string, itemIds: string[]) => 
      ipcRenderer.invoke('schedule:reorderItems', { scheduleId, itemIds }),
    duplicateItem: (itemId: string) => ipcRenderer.invoke('schedule:duplicateItem', itemId),
    cloneSchedule: (scheduleId: string, newName: string) => 
      ipcRenderer.invoke('schedule:cloneSchedule', { scheduleId, newName }),
  },
  template: {
    getAll: () => ipcRenderer.invoke('template:getAll'),
    getLibraryPage: (payload: any) => ipcRenderer.invoke('template:getLibraryPage', payload),
    getLibraryCategories: () => ipcRenderer.invoke('template:getLibraryCategories'),
    getById: (id: string) => ipcRenderer.invoke('template:getById', id),
    create: (data: any) => ipcRenderer.invoke('template:create', data),
    update: (id: string, data: any) => ipcRenderer.invoke('template:update', { id, data }),
    updatePreview: (id: string, previewUrl: string | null) => ipcRenderer.invoke('template:updatePreview', { id, previewUrl }),
    delete: (id: string) => ipcRenderer.invoke('template:delete', id),
  },
  presetPreview: {
    save: (payload: { id: string; dataUrl: string; previousUrl?: string | null }) => ipcRenderer.invoke('presetPreview:save', payload),
    delete: (previewUrl: string) => ipcRenderer.invoke('presetPreview:delete', previewUrl),
  },
  dbManager: {
    backup: () => ipcRenderer.invoke('db:backup'),
    restore: () => ipcRenderer.invoke('db:restore'),
    getCacheStats: () => ipcRenderer.invoke('db:getCacheStats'),
    listCacheAssets: () => ipcRenderer.invoke('db:listCacheAssets'),
    deleteCacheAsset: (id: string) => ipcRenderer.invoke('db:deleteCacheAsset', id),
    clearUnusedCache: () => ipcRenderer.invoke('db:clearUnusedCache'),
    deleteSong: (id: string) => ipcRenderer.invoke('db:deleteSong', id),
    deleteSongsBatch: (ids: string[]) => ipcRenderer.invoke('db:deleteSongsBatch', ids),
  },
  ai: {
    getStatus: () => ipcRenderer.invoke('ai:getStatus'),
    toggleEnable: (enabled: boolean) => ipcRenderer.invoke('ai:toggleEnable', enabled),
    cancelDownload: () => ipcRenderer.invoke('ai:cancelDownload'),
    formatLyric: (rawLyric: string, options?: any) => ipcRenderer.invoke('ai:formatLyric', rawLyric, options),
    runAutoTagging: () => ipcRenderer.invoke('ai:runAutoTagging'),
    onStatusChanged: (callback: (status: any) => void) => {
      const listener = (_event: unknown, status: any) => callback(status);
      ipcRenderer.on('ai:status-changed', listener);
      return () => ipcRenderer.removeListener('ai:status-changed', listener);
    },
    onAutoTaggingProgress: (callback: (progress: { processed: number; total: number; log: string }) => void) => {
      const listener = (_event: unknown, progress: any) => callback(progress);
      ipcRenderer.on('ai:auto-tagging-progress', listener);
      return () => ipcRenderer.removeListener('ai:auto-tagging-progress', listener);
    },
  },
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  },
});
