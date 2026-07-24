import type { Schedule, ScheduleItem } from '../../electron/database/schema';
import type { EnrichedScheduleItem, ScheduleWithItems } from '../../electron/database/scheduleService';

// Mock service for Web Mode (LocalStorage)
const webScheduleService = {
  getAll: async (): Promise<Schedule[]> => {
    const data = localStorage.getItem('rumedia_schedules');
    return data ? JSON.parse(data) : [];
  },
  
  getById: async (id: string): Promise<ScheduleWithItems | null> => {
    const schedules = await webScheduleService.getAll();
    const schedule = schedules.find(s => s.id === id);
    if (!schedule) return null;
    
    // Get items for this schedule
    const allItems = await webScheduleService.getItems();
    const items = allItems.filter(item => item.scheduleId === id);
    
    return { ...schedule, items };
  },
  
  create: async (data: Partial<Schedule>): Promise<string> => {
    const schedules = await webScheduleService.getAll();
    const newSchedule: Schedule = {
      id: crypto.randomUUID(),
      name: data.name || 'New Schedule',
      date: data.date || null,
      serviceType: data.serviceType || null,
      notes: data.notes || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    schedules.push(newSchedule);
    localStorage.setItem('rumedia_schedules', JSON.stringify(schedules));
    return newSchedule.id;
  },
  
  update: async (id: string, data: Partial<Schedule>): Promise<void> => {
    const schedules = await webScheduleService.getAll();
    const index = schedules.findIndex(s => s.id === id);
    if (index !== -1) {
      schedules[index] = {
        ...schedules[index],
        ...data,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('rumedia_schedules', JSON.stringify(schedules));
    }
  },
  
  delete: async (id: string): Promise<void> => {
    const schedules = await webScheduleService.getAll();
    const newSchedules = schedules.filter(s => s.id !== id);
    localStorage.setItem('rumedia_schedules', JSON.stringify(newSchedules));
    
    // Also delete associated items
    const items = await webScheduleService.getItems();
    const newItems = items.filter(item => item.scheduleId !== id);
    localStorage.setItem('rumedia_schedule_items', JSON.stringify(newItems));
  },
  
  // Schedule Items
  getItems: async (): Promise<EnrichedScheduleItem[]> => {
    const data = localStorage.getItem('rumedia_schedule_items');
    return data ? JSON.parse(data) : [];
  },
  
  addItem: async (data: Partial<ScheduleItem>): Promise<string> => {
    const items = await webScheduleService.getItems();
    const newItem: ScheduleItem = {
      id: crypto.randomUUID(),
      scheduleId: data.scheduleId || '',
      orderIndex: data.orderIndex || items.filter(i => i.scheduleId === data.scheduleId).length,
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
      createdAt: new Date().toISOString()
    };
    items.push(newItem);
    localStorage.setItem('rumedia_schedule_items', JSON.stringify(items));
    return newItem.id;
  },
  
  updateItem: async (id: string, data: Partial<ScheduleItem>): Promise<void> => {
    const items = await webScheduleService.getItems();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data };
      localStorage.setItem('rumedia_schedule_items', JSON.stringify(items));
    }
  },
  
  deleteItem: async (id: string): Promise<void> => {
    const items = await webScheduleService.getItems();
    const newItems = items.filter(i => i.id !== id);
    localStorage.setItem('rumedia_schedule_items', JSON.stringify(newItems));
  },
  
  reorderItems: async (_scheduleId: string, itemIds: string[]): Promise<void> => {
    const items = await webScheduleService.getItems();
    itemIds.forEach((itemId, index) => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        item.orderIndex = index;
      }
    });
    localStorage.setItem('rumedia_schedule_items', JSON.stringify(items));
  }
};

// IPC Service (works with both Electron and Web fallback)
export const ipcScheduleService = {
  // Schedule CRUD
  getAll: async (): Promise<Schedule[]> => {
    if (window.api?.schedule) return await window.api.schedule.getAll();
    return await webScheduleService.getAll();
  },

  getById: async (id: string): Promise<ScheduleWithItems | null> => {
    if (window.api?.schedule) return await window.api.schedule.getById(id);
    return await webScheduleService.getById(id);
  },

  create: async (data: Partial<Schedule>): Promise<string> => {
    if (window.api?.schedule) return await window.api.schedule.create(data);
    return await webScheduleService.create(data);
  },

  update: async (id: string, data: Partial<Schedule>): Promise<void> => {
    if (window.api?.schedule) {
      await window.api.schedule.update(id, data);
    } else {
      await webScheduleService.update(id, data);
    }
  },

  delete: async (id: string): Promise<void> => {
    if (window.api?.schedule) {
      await window.api.schedule.delete(id);
    } else {
      await webScheduleService.delete(id);
    }
  },

  // Schedule Items
  addItem: async (data: Partial<ScheduleItem>): Promise<string> => {
    if (window.api?.schedule) return await window.api.schedule.addItem(data);
    return await webScheduleService.addItem(data);
  },

  updateItem: async (id: string, data: Partial<ScheduleItem>): Promise<void> => {
    if (window.api?.schedule) {
      await window.api.schedule.updateItem(id, data);
    } else {
      await webScheduleService.updateItem(id, data);
    }
  },

  deleteItem: async (id: string): Promise<void> => {
    if (window.api?.schedule) {
      await window.api.schedule.deleteItem(id);
    } else {
      await webScheduleService.deleteItem(id);
    }
  },

  reorderItems: async (scheduleId: string, itemIds: string[]): Promise<void> => {
    if (window.api?.schedule) {
      await window.api.schedule.reorderItems(scheduleId, itemIds);
    } else {
      await webScheduleService.reorderItems(scheduleId, itemIds);
    }
  },

  duplicateItem: async (itemId: string): Promise<string> => {
    if (window.api?.schedule) return await window.api.schedule.duplicateItem(itemId);
    // Web fallback - manual duplicate
    const items = await webScheduleService.getItems();
    const item = items.find(i => i.id === itemId);
    if (!item) throw new Error('Item not found');
    const { id, ...itemData } = item;
    return await webScheduleService.addItem(itemData);
  },

  cloneSchedule: async (scheduleId: string, newName: string): Promise<string> => {
    if (window.api?.schedule) return await window.api.schedule.cloneSchedule(scheduleId, newName);
    // Web fallback
    const schedule = await webScheduleService.getById(scheduleId);
    if (!schedule) throw new Error('Schedule not found');
    const newId = await webScheduleService.create({ ...schedule, name: newName });
    for (const item of schedule.items) {
      const { id, scheduleId: _, createdAt, ...itemData } = item;
      await webScheduleService.addItem({ ...itemData, scheduleId: newId });
    }
    return newId;
  }
};
