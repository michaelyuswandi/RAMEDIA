import type { Media } from '../../electron/database/schema';

export type MediaLibraryQuery = {
  offset?: number;
  limit?: number;
  query?: string;
  mediaTypes?: string[] | null;
  favoritesOnly?: boolean;
  tag?: string | null;
  mediaIds?: string[] | null;
  sortBy?: 'filename' | 'mediaType' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
};

export type MediaLibraryPage = { items: Media[]; total: number; offset: number; limit: number };

// Mock service for Web Mode
const webMediaService = {
  getAll: async (): Promise<Media[]> => {
    const data = localStorage.getItem('rumedia_media');
    return data ? JSON.parse(data) : [];
  },
  getLibraryPage: async (payload: MediaLibraryQuery = {}): Promise<MediaLibraryPage> => {
    const items = await webMediaService.getAll();
    const query = (payload.query || '').trim().toLocaleLowerCase();
    const mediaTypes = payload.mediaTypes ? new Set(payload.mediaTypes) : null;
    const mediaIds = payload.mediaIds ? new Set(payload.mediaIds) : null;
    const filtered = items.filter((media) => {
      if (mediaTypes && !mediaTypes.has(media.mediaType)) return false;
      if (mediaIds && !mediaIds.has(media.id)) return false;
      let tags: string[] = [];
      try {
        const parsed = JSON.parse(media.tags || '[]');
        if (Array.isArray(parsed)) tags = parsed.map(String);
      } catch {
        // Ignore malformed legacy tags.
      }
      if (payload.favoritesOnly && !tags.includes('favorite')) return false;
      if (payload.tag && !tags.includes(payload.tag)) return false;
      return !query || media.filename.toLocaleLowerCase().includes(query) || media.mediaType.toLocaleLowerCase().includes(query);
    });
    const sortKey = payload.sortBy || 'filename';
    const direction = payload.sortDirection === 'desc' ? -1 : 1;
    filtered.sort((a, b) => String(a[sortKey] || '').localeCompare(String(b[sortKey] || '')) * direction);
    const offset = Math.max(0, Math.floor(payload.offset || 0));
    const limit = Math.min(250, Math.max(1, Math.floor(payload.limit || 84)));
    return { items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit };
  },
  getLibraryTags: async (): Promise<string[]> => {
    const items = await webMediaService.getAll();
    const tags = new Set<string>();
    items.forEach((media) => {
      try {
        const parsed = JSON.parse(media.tags || '[]');
        if (Array.isArray(parsed)) parsed.forEach((tag) => tags.add(String(tag)));
      } catch {
        // Ignore malformed legacy tags.
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  },
  create: async (data: any): Promise<string> => {
    const items = await webMediaService.getAll();
    const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    items.push(newItem);
    localStorage.setItem('rumedia_media', JSON.stringify(items));
    return newItem.id;
  },
  delete: async (id: string): Promise<void> => {
    const items = await webMediaService.getAll();
    const newItems = items.filter(i => i.id !== id);
    localStorage.setItem('rumedia_media', JSON.stringify(newItems));
  }
};

export const ipcMediaService = {
  getAll: async (): Promise<Media[]> => {
    if (window.api) return await window.api.media.getAll();
    return await webMediaService.getAll();
  },

  getLibraryPage: async (payload: MediaLibraryQuery = {}): Promise<MediaLibraryPage> => {
    if (window.api?.media?.getLibraryPage) return await window.api.media.getLibraryPage(payload);
    return await webMediaService.getLibraryPage(payload);
  },

  getLibraryTags: async (): Promise<string[]> => {
    if (window.api?.media?.getLibraryTags) return await window.api.media.getLibraryTags();
    return await webMediaService.getLibraryTags();
  },

  create: async (data: any): Promise<string> => {
    if (window.api) return await window.api.media.create(data);
    return await webMediaService.create(data);
  },

  update: async (id: string, data: any): Promise<void> => {
    if (window.api) await window.api.media.update(id, data);
    // Add mock logic if needed for web
  },

  delete: async (id: string): Promise<void> => {
    if (window.api) await window.api.media.delete(id);
    else await webMediaService.delete(id);
  },

  importFile: async (): Promise<any> => {
    if (window.api) return await window.api.media.importFile();
    console.warn('Import file not supported in web mode');
    return null;
  },

  importPdfFile: async (): Promise<any> => {
    if (window.api?.media?.importPdfFile) return await window.api.media.importPdfFile();
    console.warn('Import PDF file not supported in web mode');
    return null;
  },

  selectPdfFiles: async (): Promise<string[]> => {
    if (window.api?.media?.selectPdfFiles) return await window.api.media.selectPdfFiles();
    console.warn('Select PDF files not supported in web mode');
    return [];
  },

  saveCompiledPdf: async (payload: { filename: string, buffers: ArrayBuffer[], width: number, height: number }): Promise<any> => {
    if (window.api?.media?.saveCompiledPdf) return await window.api.media.saveCompiledPdf(payload);
    console.warn('Save compiled PDF not supported in web mode');
    return null;
  },

  updateCompiledPdf: async (payload: { id: string, filename: string, buffers: ArrayBuffer[], width: number, height: number }): Promise<any> => {
    if (window.api?.media?.updateCompiledPdf) return await window.api.media.updateCompiledPdf(payload);
    console.warn('Update compiled PDF not supported in web mode');
    return null;
  },

  cleanupOrphans: async (): Promise<any> => {
    if (window.api) return await window.api.media.cleanupOrphans();
    console.warn('Cleanup orphans not supported in web mode');
    return null;
  }
};
