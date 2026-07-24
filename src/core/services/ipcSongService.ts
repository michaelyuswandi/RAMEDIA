import type { Song } from '../../electron/database/schema';
import { parseSongLyrics } from '../../utils/songParser';
import type { SlideLayer, Slide, Template } from '../../electron/database/schema';
import { buildLayersFromSongPreset } from '../songEditor/songPresets';
import { useSettingsStore } from '../stores/useSettingsStore';
import { DEFAULT_SCREEN_PROFILE_ID, isScreenProfileId } from '../screens/screenProfiles';

import { resolvePrimaryOutputChannel, resolveSongPresetIdForOutput, resolveSongPresetIdForRole, shouldForceSongThemeForOutput } from '../models/outputSettings';

// Helper interface
export interface SongWithSlides extends Song {
  slides: any[];
}

export type SongEditorSlide = Slide & { layers: SlideLayer[] };

export interface SongUpdatePayload extends Partial<Song> {
  slides?: SongEditorSlide[];
}

export type SongLibraryQuery = {
  offset?: number;
  limit?: number;
  query?: string;
  searchBy?: 'all' | 'title' | 'lyrics' | 'author';
  favoritesOnly?: boolean;
  tag?: string | null;
  songIds?: string[] | null;
  sortBy?: 'title' | 'author' | 'copyright';
  sortDirection?: 'asc' | 'desc';
};

export type SongLibraryPage = {
  items: Song[];
  total: number;
  offset: number;
  limit: number;
};

export interface EasyWorshipImportResult {
  folderPath: string;
  imported: number;
  skipped: number;
  failed: number;
  total: number;
  errors: Array<{ title: string; reason: string }>;
}

export interface EasyWorshipSongPreview {
  sourceId: number;
  title: string;
  author: string | null;
  copyright: string | null;
  ccliNumber: string | null;
  slideCount: number;
  alreadyExists: boolean;
}

export interface EasyWorshipScanResult {
  folderPath: string;
  total: number;
  songs: EasyWorshipSongPreview[];
}

// MOCK SERVICE FOR WEB BROWSER (LocalStorage)
const webSongService = {
  getAll: async (): Promise<Song[]> => {
    const data = localStorage.getItem('rumedia_songs');
    return data ? JSON.parse(data) : [];
  },
  getLibraryPage: async (payload: SongLibraryQuery = {}): Promise<SongLibraryPage> => {
    const songs = await webSongService.getAll();
    const query = (payload.query || '').trim().toLocaleLowerCase();
    const searchBy = payload.searchBy || 'all';
    const songIds = payload.songIds ? new Set(payload.songIds) : null;

    const filtered = songs.filter((song) => {
      if (songIds && !songIds.has(song.id)) return false;
      const tags = (() => {
        try {
          const parsed = JSON.parse(song.tags || '[]');
          return Array.isArray(parsed) ? parsed.map(String) : [];
        } catch {
          return [];
        }
      })();
      if (payload.favoritesOnly && !tags.includes('favorite')) return false;
      if (payload.tag && !tags.includes(payload.tag)) return false;
      if (!query) return true;

      const title = song.title.toLocaleLowerCase();
      const author = (song.author || '').toLocaleLowerCase();
      const lyrics = (song.rawLyrics || '').toLocaleLowerCase();
      if (searchBy === 'title') return title.includes(query);
      if (searchBy === 'author') return author.includes(query);
      if (searchBy === 'lyrics') return lyrics.includes(query);
      return title.includes(query) || author.includes(query) || lyrics.includes(query);
    });

    const sortKey = payload.sortBy || 'title';
    const direction = payload.sortDirection === 'desc' ? -1 : 1;
    filtered.sort((a, b) => {
      const aValue = sortKey === 'author' ? a.author : sortKey === 'copyright' ? a.copyright : a.title;
      const bValue = sortKey === 'author' ? b.author : sortKey === 'copyright' ? b.copyright : b.title;
      return String(aValue || '').localeCompare(String(bValue || '')) * direction;
    });

    const offset = Math.max(0, Math.floor(payload.offset || 0));
    const limit = Math.min(250, Math.max(1, Math.floor(payload.limit || 84)));
    return { items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit };
  },
  getLibraryTags: async (): Promise<string[]> => {
    const songs = await webSongService.getAll();
    const tags = new Set<string>();
    songs.forEach((song) => {
      try {
        const parsed = JSON.parse(song.tags || '[]');
        if (Array.isArray(parsed)) parsed.forEach((tag) => tags.add(String(tag)));
      } catch {
        // Ignore malformed legacy tag payloads.
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  },
  getById: async (id: string, role?: string | null, outputId?: string | null): Promise<SongWithSlides | null> => {
    const songs = await webSongService.getAll();
    const song = songs.find(s => s.id === id);
    if (!song) return null;
    const allTemplates = await (window.api?.template?.getAll
      ? window.api.template.getAll()
      : Promise.resolve(JSON.parse(localStorage.getItem('rumedia_templates') || '[]')));
    const settings = useSettingsStore.getState();
    const primaryOutputRole = resolvePrimaryOutputChannel(settings)?.role;
    // Gunakan role yang diberikan, fallback ke primary output agar preset Settings -> Output konsisten.
    const resolvedRole = (role && isScreenProfileId(role as any))
      ? role as any
      : (primaryOutputRole && isScreenProfileId(primaryOutputRole) ? primaryOutputRole : DEFAULT_SCREEN_PROFILE_ID);
    const resolvedOutput = outputId
      ? settings.outputs.find((output) => output.id === outputId) || null
      : settings.outputs.find((output) => output.isPrimary && output.role === resolvedRole)
        || settings.outputs.find((output) => output.enabled && output.role === resolvedRole)
        || null;
    const resolvedTemplateId = resolvedOutput
      ? resolveSongPresetIdForOutput(settings, resolvedOutput.id, song?.defaultTemplateId)
      : song?.defaultTemplateId || resolveSongPresetIdForRole(settings, resolvedRole);
    const songTemplate = (allTemplates as Template[]).find((template) => template.id === resolvedTemplateId) || null;
    const defaultSongStyle = settings.defaultSongStyle;
    const customSlides = (song as any).slides;
    if (Array.isArray(customSlides) && !shouldForceSongThemeForOutput(settings, resolvedOutput?.id)) {
      return { ...song, slides: customSlides };
    }
    return {
          ...song,
          slides: parseSongLyrics(song.rawLyrics || '').map((section, index) => ({
            id: `${song.id}-slide-${index}`,
            songId: song.id,
            orderIndex: index + 1,
            sectionType: section.type,
            sectionNumber: section.number,
            content: section.content,
            layers: buildLayersFromSongPreset(
              `${song.id}-slide-${index}`,
              section.content,
              songTemplate,
              defaultSongStyle,
              {
                songTitle: song.title || 'Song Title',
                sectionLabel: section.type
                  ? `${section.type.charAt(0).toUpperCase()}${section.type.slice(1)}${section.number ? ` ${section.number}` : ''}`
                  : `Slide ${index + 1}`,
              },
            ),
          })),
        };
  },
  search: async (query: string): Promise<Song[]> => {
    const songs = await webSongService.getAll();
    return songs.filter(s => s.title.toLowerCase().includes(query.toLowerCase()));
  },
  createFromLyrics: async (title: string, rawLyrics: string, author?: string): Promise<string> => {
    const songs = await webSongService.getAll();
    const newSong = {
      id: crypto.randomUUID(),
      title,
      rawLyrics,
      author: author || null,
      defaultTemplateId: null,
      tags: '[]',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    } as Song;
    songs.push(newSong);
    localStorage.setItem('rumedia_songs', JSON.stringify(songs));
    return newSong.id;
  },
  update: async (id: string, data: SongUpdatePayload): Promise<void> => {
    const songs = await webSongService.getAll();
    const index = songs.findIndex(s => s.id === id);
    if (index !== -1) {
      songs[index] = { ...songs[index], ...(data as Partial<Song>), updatedAt: new Date().toISOString() };
      if (Array.isArray(data.slides)) {
        (songs[index] as any).slides = data.slides;
      }
      localStorage.setItem('rumedia_songs', JSON.stringify(songs));
    }
  },
  delete: async (id: string): Promise<void> => {
    const songs = await webSongService.getAll();
    const newSongs = songs.filter(s => s.id !== id);
    localStorage.setItem('rumedia_songs', JSON.stringify(newSongs));
  },

  seed: async (): Promise<void> => {
    const songs = await webSongService.getAll();
    if (songs.length > 0) return; // Don't seed if already has data

    const seedSongs: Song[] = [
      {
        id: crypto.randomUUID(),
        title: "Bapa Sentuh Hatiku",
        author: "Jason",
        tags: '["Worship","Slow"]',
        rawLyrics: "Betapa kumencintai\nSegala yang tlah terjadi\nTak pernah sendiri\nJalani hidup ini\nSelalu menyertai\n\nBetapa kumenyadari\nDi dalam hidupku ini\nKau slalu memberi\nRancangan terbaik\nOleh karena kasih\n\nBapa sentuh hatiku\nUbah hidupku\nMenjadi yang baru\nBagai emas yang murni\nKau membentuk bejana hatiku\n\nBapa ajarku mengerti\nSebuah kasih\nYang selalu memberi\nBagai air mengalir\nYang tiada pernah berhenti",
        defaultTemplateId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        title: "Satu-Satunya Harapan",
        author: "NDC Worship",
        tags: '["Praise","Medium"]',
        rawLyrics: "Engkaulah satusatunya\nPenolongku yang sungguh\nTiada yang sepertiMu\nEngkaulah harapanku\n\nReff:\nTuhan Yesus setia\nDia sahabat kita\nDalam sgala susah\nDia tak pernah tinggalkan",
        defaultTemplateId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        title: "Hidup Ini Adalah Kesempatan",
        author: "Pdt. Wilhelmus Latumahina",
        tags: '["Classic","Hymn"]',
        rawLyrics: "Hidup ini adalah kesempatan\nHidup ini untuk melayani Tuhan\nJangan siasiakan waktu yang Tuhan beri\nHidup ini hanya sementara\n\nOh Tuhan pakailah hidupku\nSelagi aku masih kuat\nBila saatnya nanti\nKu tak berdaya lagi\nHidup ini sudah jadi berkat",
        defaultTemplateId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        title: "Seperti Rusa Rindu SungaiMu",
        author: "Asaph",
        tags: '["Worship","Classic"]',
        rawLyrics: "Seperti rusa rindu sungaiMu\nJiwaku rindu Engkau\nKaulah Tuhan hasrat hatiku\nKurindu menyembahMu\n\nEngkau kekuatan dan perisaiku\nKepadaMu rohku berserah\nKaulah Tuhan hasrat hatiku\nKurindu menyembahMu",
        defaultTemplateId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: crypto.randomUUID(),
        title: "Kecaplah dan Lihatlah",
        author: "Franky Sihombing",
        tags: '["Praise","Fast"]',
        rawLyrics: "Kecaplah dan lihatlah\nBetapa baiknya Tuhan itu\nRasakan dan nikmati\nKasih setia Tuhan\n\nSyukur bagiMu Tuhan\nSgala hormat bagiMu Tuhan\nAllah yang mengasihiku\nAllah yang memeliharaku\nSelamanya",
        defaultTemplateId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ] as Song[];

    localStorage.setItem('rumedia_songs', JSON.stringify(seedSongs));
  }
};

export const ipcSongService = {
  getAll: async (): Promise<Song[]> => {
    if (window.api) return await window.api.song.getAll();
    return await webSongService.getAll();
  },

  getLibraryPage: async (payload: SongLibraryQuery = {}): Promise<SongLibraryPage> => {
    if (window.api?.song?.getLibraryPage) return await window.api.song.getLibraryPage(payload);
    return await webSongService.getLibraryPage(payload);
  },

  getLibraryTags: async (): Promise<string[]> => {
    if (window.api?.song?.getLibraryTags) return await window.api.song.getLibraryTags();
    return await webSongService.getLibraryTags();
  },

  getById: async (id: string, role?: string | null, outputId?: string | null): Promise<SongWithSlides | null> => {
    if (window.api) return await window.api.song.getById(id, role, outputId);
    return await webSongService.getById(id, role, outputId);
  },

  search: async (query: string): Promise<Song[]> => {
    if (window.api) return await window.api.song.search(query);
    return await webSongService.search(query);
  },

  createFromLyrics: async (title: string, rawLyrics: string, author?: string): Promise<string> => {
    if (window.api) return await window.api.song.create(title, rawLyrics, author);
    return await webSongService.createFromLyrics(title, rawLyrics, author);
  },

  update: async (id: string, data: SongUpdatePayload): Promise<void> => {
    if (window.api) {
      await window.api.song.update(id, data);
    } else {
      await webSongService.update(id, data as Partial<Song>);
    }
  },

  delete: async (id: string): Promise<void> => {
    if (window.api) {
      await window.api.song.delete(id);
    } else {
      await webSongService.delete(id);
    }
  },

  scanEasyWorship: async (): Promise<EasyWorshipScanResult | null> => {
    if (!window.api?.song?.scanEasyWorship) {
      throw new Error('Import EasyWorship hanya tersedia di Electron desktop mode.');
    }

    return await window.api.song.scanEasyWorship();
  },

  importEasyWorship: async (folderPath: string, sourceIds: number[]): Promise<EasyWorshipImportResult> => {
    if (!window.api?.song?.importEasyWorship) {
      throw new Error('Import EasyWorship hanya tersedia di Electron desktop mode.');
    }

    return await window.api.song.importEasyWorship({ folderPath, sourceIds });
  },

  deleteEasyWorshipImports: async (): Promise<{ deleted: number }> => {
    if (!window.api?.song?.deleteEasyWorshipImports) {
      throw new Error('Hapus import EasyWorship hanya tersedia di Electron desktop mode.');
    }

    return await window.api.song.deleteEasyWorshipImports();
  },

  seed: async (): Promise<void> => {
    // For now, only web implementation for quick testing
    // In real app, we would add to window.api.song.seed() if it existed
    if (!window.api) {
      await webSongService.seed();
    }
  }
};
