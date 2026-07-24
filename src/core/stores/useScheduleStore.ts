import { create } from 'zustand';
import type { Schedule, ScheduleItem } from '../../electron/database/schema';
import type { EnrichedScheduleItem, ScheduleWithItems } from '../../electron/database/scheduleService';
import { ipcScheduleService } from '../services/ipcScheduleService';
import { ipcSongService, type SongWithSlides } from '../services/ipcSongService';
import { ipcMediaService } from '../services/ipcMediaService';
import type { Media } from '../../electron/database/schema';
import { isScheduleOnlyMedia } from '../utils/mediaVisibility';
import { useSettingsStore } from './useSettingsStore';
import { resolvePrimaryOutputChannel } from '../models/outputSettings';
import { LAST_RUNDOWN_KEY } from './useGeneralSettingsStore';


export const TEMP_SCHEDULE_ID = '__temporary_rundown__';

interface ScheduleState {
  // Current loaded schedule
  currentSchedule: ScheduleWithItems | null;
  schedules: Schedule[];  // List of all schedules
  
  // UI state
  selectedItemId: string | null;
  libraryPreviewSong: SongWithSlides | null;
  libraryPreviewMedia: Media | null;
  libraryPreviewMode: 'preview' | 'liveControl';
  presenterMedia: Media | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions - Schedule CRUD
  loadSchedules: () => Promise<void>;
  loadSchedule: (id: string) => Promise<void>;
  createSchedule: (data: Partial<Schedule>) => Promise<string>;
  updateSchedule: (id: string, data: Partial<Schedule>) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  cloneSchedule: (id: string, newName: string) => Promise<string>;
  saveTemporarySchedule: (data: Partial<Schedule>) => Promise<string>;
  
  // Actions - Item CRUD
  addItem: (data: Partial<ScheduleItem>) => Promise<string>;
  updateItem: (id: string, data: Partial<ScheduleItem>) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  duplicateItem: (id: string) => Promise<void>;
  reorderItems: (itemIds: string[]) => Promise<void>;
  
  // UI Actions
  setSelectedItem: (id: string | null, mode?: 'preview' | 'liveControl') => void;
  setLibraryPreviewSong: (song: SongWithSlides | null, mode?: 'preview' | 'liveControl') => void;
  setLibraryPreviewMedia: (media: Media | null, mode?: 'preview' | 'liveControl') => void;
  setPresenterMedia: (media: Media | null) => void;
  setLibraryPreviewMode: (mode: 'preview' | 'liveControl') => void;
  refreshPresetDrivenSongs: () => Promise<void>;
  clearError: () => void;
  
  // Computed getters
  getTotalDuration: () => number;
  getEstimatedEndTime: (startTime: string) => string;
}

export const useScheduleStore = create<ScheduleState>()((set, get) => ({
  // Initial State
  currentSchedule: null,
  schedules: [],
  selectedItemId: null,
  libraryPreviewSong: null,
  libraryPreviewMedia: null,
  libraryPreviewMode: 'preview',
  presenterMedia: null,
  isLoading: false,
  error: null,
  
  // ========== SCHEDULE CRUD ==========
  
  loadSchedules: async () => {
    set({ isLoading: true, error: null });
    try {
      const schedules = await ipcScheduleService.getAll();
      set({ schedules, isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
  
  loadSchedule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const schedule = await ipcScheduleService.getById(id);
      set({ currentSchedule: schedule, selectedItemId: null, libraryPreviewSong: null, libraryPreviewMedia: null, libraryPreviewMode: 'preview', presenterMedia: null, isLoading: false });
      if (schedule && typeof localStorage !== 'undefined') localStorage.setItem(LAST_RUNDOWN_KEY, id);
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
    }
  },
  
  createSchedule: async (data: Partial<Schedule>) => {
    set({ isLoading: true, error: null });
    try {
      const id = await ipcScheduleService.create(data);
      await get().loadSchedules(); // Refresh list
      await get().loadSchedule(id); // Load new schedule
      set({ isLoading: false });
      return id;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  updateSchedule: async (id: string, data: Partial<Schedule>) => {
    set({ isLoading: true, error: null });
    try {
      await ipcScheduleService.update(id, data);
      
      // Update local state optimistically
      const { currentSchedule } = get();
      if (currentSchedule && currentSchedule.id === id) {
        set({ 
          currentSchedule: { ...currentSchedule, ...data },
          isLoading: false 
        });
      }
      
      await get().loadSchedules(); // Refresh list
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  deleteSchedule: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      await ipcScheduleService.delete(id);
      
      // Clear current if deleted
      const { currentSchedule } = get();
      if (currentSchedule && currentSchedule.id === id) {
        set({ currentSchedule: null, selectedItemId: null, libraryPreviewSong: null, libraryPreviewMedia: null, libraryPreviewMode: 'preview', presenterMedia: null });
      }
      if (typeof localStorage !== 'undefined' && localStorage.getItem(LAST_RUNDOWN_KEY) === id) {
        localStorage.removeItem(LAST_RUNDOWN_KEY);
      }
      
      await get().loadSchedules();
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  cloneSchedule: async (id: string, newName: string) => {
    set({ isLoading: true, error: null });
    try {
      const newId = await ipcScheduleService.cloneSchedule(id, newName);
      await get().loadSchedules();
      set({ isLoading: false });
      return newId;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },

  saveTemporarySchedule: async (data: Partial<Schedule>) => {
    const { currentSchedule } = get();
    if (!currentSchedule || currentSchedule.id !== TEMP_SCHEDULE_ID) {
      throw new Error('No temporary rundown to save');
    }

    set({ isLoading: true, error: null });

    let newScheduleId: string | null = null;

    try {
      newScheduleId = await ipcScheduleService.create({
        name: data.name || currentSchedule.name || 'Quick Rundown',
        date: data.date || new Date().toISOString().split('T')[0],
        serviceType: data.serviceType || 'Custom',
        notes: data.notes || null,
      });

      for (const [index, item] of currentSchedule.items.entries()) {
        const { id, createdAt, songData, mediaData, themeData, ...itemData } = item;
        await ipcScheduleService.addItem({
          ...itemData,
          scheduleId: newScheduleId,
          orderIndex: index,
        });
      }

      await get().loadSchedules();
      await get().loadSchedule(newScheduleId);
      set({ isLoading: false });
      return newScheduleId;
    } catch (error) {
      if (newScheduleId) {
        try {
          await ipcScheduleService.delete(newScheduleId);
        } catch {
          // Ignore rollback failure and surface the original error.
        }
      }

      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  // ========== ITEM CRUD ==========
  
  addItem: async (data: Partial<ScheduleItem>) => {
    let { currentSchedule } = get();

    if (!currentSchedule) {
      currentSchedule = {
        id: TEMP_SCHEDULE_ID,
        name: 'Quick Rundown',
        date: null,
        serviceType: 'Temporary',
        notes: 'Temporary rundown for quick operation',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: [],
      };
      set({ currentSchedule, selectedItemId: null, libraryPreviewSong: null, libraryPreviewMedia: null, libraryPreviewMode: 'preview', presenterMedia: null });
    }

    if (currentSchedule.id === TEMP_SCHEDULE_ID) {
      const newItem: EnrichedScheduleItem = {
        id: crypto.randomUUID(),
        scheduleId: TEMP_SCHEDULE_ID,
        orderIndex: currentSchedule.items.length,
        itemType: data.itemType || 'custom',
        songId: data.songId || null,
        mediaId: data.mediaId || null,
        bibleVersionId: data.bibleVersionId || null,
        bibleBook: data.bibleBook || null,
        bibleChapter: data.bibleChapter || null,
        bibleVerseStart: data.bibleVerseStart || null,
        bibleVerseEnd: data.bibleVerseEnd || null,
        content: data.content || null,
        duration: data.duration || null,
        notes: data.notes || null,
        themeId: data.themeId || null,
        createdAt: new Date().toISOString(),
      };

      // Eagerly fetch full data so slides/thumbnails are immediately available
      if (newItem.songId) {
        try {
          // Gunakan role dari primary output channel agar preset yang benar digunakan
          const primaryRole = resolvePrimaryOutputChannel(useSettingsStore.getState())?.role ?? 'audience';
          newItem.songData = await ipcSongService.getById(newItem.songId, primaryRole);
        } catch (e) {
          console.error('[ScheduleStore] Failed to fetch song data:', e);
        }
      }
      if (newItem.mediaId) {
        try {
          const allMedia = await ipcMediaService.getAll();
          newItem.mediaData = allMedia.find(m => m.id === newItem.mediaId) || null;
        } catch (e) {
          console.error('[ScheduleStore] Failed to fetch media data:', e);
        }
      }

      set({
        currentSchedule: {
          ...currentSchedule,
          updatedAt: new Date().toISOString(),
          items: [...currentSchedule.items, newItem],
        },
        isLoading: false,
      });

      return newItem.id;
    }
    
    set({ isLoading: true, error: null });
    try {
      const itemId = await ipcScheduleService.addItem({
        ...data,
        scheduleId: currentSchedule.id
      });
      
      // Reload schedule to get updated items
      await get().loadSchedule(currentSchedule.id);
      set({ isLoading: false });
      return itemId;
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  updateItem: async (id: string, data: Partial<ScheduleItem>) => {
    const { currentSchedule } = get();
    if (currentSchedule?.id === TEMP_SCHEDULE_ID) {
      const updatedItems = currentSchedule.items.map(item =>
        item.id === id ? { ...item, ...data } : item
      );
      set({
        currentSchedule: { ...currentSchedule, updatedAt: new Date().toISOString(), items: updatedItems },
        isLoading: false,
      });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      await ipcScheduleService.updateItem(id, data);
      
      // Update local state optimistically
      if (currentSchedule) {
        const updatedItems = currentSchedule.items.map(item =>
          item.id === id ? { ...item, ...data } : item
        );
        set({
          currentSchedule: { ...currentSchedule, items: updatedItems },
          isLoading: false
        });
      }
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  deleteItem: async (id: string) => {
    const { currentSchedule } = get();
    if (!currentSchedule) return;
    const targetItem = currentSchedule.items.find((item) => item.id === id) || null;

    const cleanupScheduleOnlyMedia = async () => {
      if (!targetItem?.mediaId) return;

      const mediaRecord =
        targetItem.mediaData ||
        (await ipcMediaService.getAll()).find((item) => item.id === targetItem.mediaId) ||
        null;

      if (isScheduleOnlyMedia(mediaRecord)) {
        await ipcMediaService.delete(mediaRecord.id);
      }
    };

    if (currentSchedule.id === TEMP_SCHEDULE_ID) {
      await cleanupScheduleOnlyMedia();
      const updatedItems = currentSchedule.items
        .filter(item => item.id !== id)
        .map((item, index) => ({ ...item, orderIndex: index }));
      set({
        currentSchedule: { ...currentSchedule, updatedAt: new Date().toISOString(), items: updatedItems },
        selectedItemId: get().selectedItemId === id ? null : get().selectedItemId,
        isLoading: false,
      });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      await ipcScheduleService.deleteItem(id);
      await cleanupScheduleOnlyMedia();
      
      // Remove from local state
      const updatedItems = currentSchedule.items.filter(item => item.id !== id);
      set({
        currentSchedule: { ...currentSchedule, items: updatedItems },
        isLoading: false
      });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  duplicateItem: async (id: string) => {
    const { currentSchedule } = get();
    if (!currentSchedule) return;

    if (currentSchedule.id === TEMP_SCHEDULE_ID) {
      const sourceIndex = currentSchedule.items.findIndex(item => item.id === id);
      if (sourceIndex === -1) return;

      const sourceItem = currentSchedule.items[sourceIndex];
      const duplicate: EnrichedScheduleItem = {
        ...sourceItem,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
      };

      const updatedItems = [...currentSchedule.items];
      updatedItems.splice(sourceIndex + 1, 0, duplicate);

      set({
        currentSchedule: {
          ...currentSchedule,
          updatedAt: new Date().toISOString(),
          items: updatedItems.map((item, index) => ({ ...item, orderIndex: index })),
        },
        isLoading: false,
      });
      return;
    }
    
    set({ isLoading: true, error: null });
    try {
      await ipcScheduleService.duplicateItem(id);
      await get().loadSchedule(currentSchedule.id);
      set({ isLoading: false });
    } catch (error) {
      set({ error: (error as Error).message, isLoading: false });
      throw error;
    }
  },
  
  reorderItems: async (itemIds: string[]) => {
    const { currentSchedule } = get();
    if (!currentSchedule) return;
    
    // Optimistic update
    const reorderedItems = itemIds
      .map(id => currentSchedule.items.find(item => item.id === id))
      .filter(Boolean) as EnrichedScheduleItem[];
    
    set({
      currentSchedule: { ...currentSchedule, items: reorderedItems }
    });

    if (currentSchedule.id === TEMP_SCHEDULE_ID) {
      set({
        currentSchedule: {
          ...currentSchedule,
          updatedAt: new Date().toISOString(),
          items: reorderedItems.map((item, index) => ({ ...item, orderIndex: index })),
        }
      });
      return;
    }
    
    try {
      await ipcScheduleService.reorderItems(currentSchedule.id, itemIds);
    } catch (error) {
      // Revert on error
      await get().loadSchedule(currentSchedule.id);
      set({ error: (error as Error).message });
    }
  },
  
  // ========== UI ACTIONS ==========
  
  setSelectedItem: (id: string | null, mode = 'preview') => {
    set({ selectedItemId: id, libraryPreviewSong: null, libraryPreviewMedia: null, libraryPreviewMode: mode });
  },

  setLibraryPreviewSong: (song, mode = 'preview') => {
    set({ libraryPreviewSong: song, libraryPreviewMedia: null, libraryPreviewMode: mode, selectedItemId: null });
  },

  setLibraryPreviewMedia: (media, mode = 'preview') => {
    set({ libraryPreviewMedia: media, libraryPreviewSong: null, libraryPreviewMode: mode, selectedItemId: null });
  },

  setPresenterMedia: (media) => {
    set({ presenterMedia: media });
  },

  setLibraryPreviewMode: (mode) => {
    set({ libraryPreviewMode: mode });
  },

  refreshPresetDrivenSongs: async () => {
    const { currentSchedule, libraryPreviewSong } = get();
    const primaryRole = resolvePrimaryOutputChannel(useSettingsStore.getState())?.role ?? 'audience';
    const songIds = new Set<string>();

    if (libraryPreviewSong?.id) {
      songIds.add(libraryPreviewSong.id);
    }

    currentSchedule?.items.forEach((item) => {
      if (item.songId) songIds.add(item.songId);
    });

    if (songIds.size === 0) return;

    const refreshedSongs = new Map<string, SongWithSlides | null>();
    for (const songId of songIds) {
      try {
        refreshedSongs.set(songId, await ipcSongService.getById(songId, primaryRole));
      } catch (error) {
        console.error('[ScheduleStore] Failed to refresh preset-driven song:', error);
      }
    }

    set((state) => ({
      libraryPreviewSong: state.libraryPreviewSong?.id
        ? refreshedSongs.get(state.libraryPreviewSong.id) || state.libraryPreviewSong
        : state.libraryPreviewSong,
      currentSchedule: state.currentSchedule
        ? {
            ...state.currentSchedule,
            items: state.currentSchedule.items.map((item) => (
              item.songId && refreshedSongs.has(item.songId)
                ? { ...item, songData: refreshedSongs.get(item.songId) || item.songData }
                : item
            )),
          }
        : state.currentSchedule,
    }));
  },
  
  clearError: () => {
    set({ error: null });
  },
  
  // ========== COMPUTED ==========
  
  getTotalDuration: () => {
    const { currentSchedule } = get();
    if (!currentSchedule) return 0;
    
    return currentSchedule.items.reduce((total, item) => {
      return total + (item.duration || 0);
    }, 0);
  },
  
  getEstimatedEndTime: (startTime: string) => {
    const totalMinutes = get().getTotalDuration();
    const [hours, minutes] = startTime.split(':').map(Number);
    
    const endMinutes = hours * 60 + minutes + totalMinutes;
    const endHours = Math.floor(endMinutes / 60) % 24;
    const endMins = endMinutes % 60;
    
    return `${String(endHours).padStart(2, '0')}:${String(endMins).padStart(2, '0')}`;
  }
}));
