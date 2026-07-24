import type { Media } from '../../electron/database/schema';

const AUDIO_STORAGE_KEY = 'rumedia_audio';

const webAudioService = {
  getAll: async (): Promise<Media[]> => {
    const data = localStorage.getItem(AUDIO_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  },

  update: async (id: string, data: Partial<Media>): Promise<void> => {
    const items = await webAudioService.getAll();
    const nextItems = items.map((item) => (item.id === id ? { ...item, ...data } : item));
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(nextItems));
  },

  delete: async (id: string): Promise<void> => {
    const items = await webAudioService.getAll();
    localStorage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(items.filter((item) => item.id !== id)));
  },
};

export const ipcAudioService = {
  getAll: async (): Promise<Media[]> => {
    if (window.api?.audio) return await window.api.audio.getAll();
    return await webAudioService.getAll();
  },

  getById: async (id: string): Promise<Media | null> => {
    if (window.api?.audio) return await window.api.audio.getById(id);
    const items = await webAudioService.getAll();
    return items.find((item) => item.id === id) || null;
  },

  update: async (id: string, data: Partial<Media>): Promise<void> => {
    if (window.api?.audio) {
      await window.api.audio.update(id, data);
      return;
    }
    await webAudioService.update(id, data);
  },

  delete: async (id: string): Promise<void> => {
    if (window.api?.audio) {
      await window.api.audio.delete(id);
      return;
    }
    await webAudioService.delete(id);
  },

  readFile: async (source: string): Promise<ArrayBuffer | null> => {
    if (window.api?.audio?.readFile) return await window.api.audio.readFile(source);
    return null;
  },

  importFile: async (): Promise<Media[] | null> => {
    if (window.api?.audio) return await window.api.audio.importFile();
    console.warn('Audio import is not supported in web mode');
    return null;
  },

  importFiles: async (paths: string[]): Promise<Media[] | null> => {
    if (window.api?.audio?.importFiles) return await window.api.audio.importFiles(paths);
    console.warn('Audio drag import is not supported in web mode');
    return null;
  },
};
