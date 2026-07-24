import { db, schema } from './index';
import { eq } from 'drizzle-orm';
import type { NewSchedule, NewScheduleItem, Schedule, ScheduleItem } from './schema';
import { songService } from './songService';

// Enriched types with joined data
export interface EnrichedScheduleItem extends ScheduleItem {
  songData?: any;
  mediaData?: any;
  themeData?: any;
}

export interface ScheduleWithItems extends Schedule {
  items: EnrichedScheduleItem[];
}

export const scheduleService = {
  // ========== SCHEDULE CRUD ==========
  
  getAll: () => {
    const schedules = db
      .select()
      .from(schema.schedules)
      .orderBy(schema.schedules.date)
      .all();

    return schedules.map(schedule => {
      const stats = db
        .select({
          count: schema.scheduleItems.id,
          totalDuration: schema.scheduleItems.duration
        })
        .from(schema.scheduleItems)
        .where(eq(schema.scheduleItems.scheduleId, schedule.id))
        .all();

      const itemCount = stats.length;
      const totalDuration = stats.reduce((sum, s) => sum + (s.totalDuration || 0), 0);

      return {
        ...schedule,
        itemCount,
        totalDuration
      };
    });
  },

  getById: (id: string): ScheduleWithItems | null => {
    const schedule = db
      .select()
      .from(schema.schedules)
      .where(eq(schema.schedules.id, id))
      .get();
      
    if (!schedule) return null;
    
    const items = scheduleService.getItems(id);
    
    return { ...schedule, items };
  },

  create: (data: NewSchedule): string => {
    const id = crypto.randomUUID();
    db.insert(schema.schedules)
      .values({ 
        ...data, 
        id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .run();
    return id;
  },

  update: (id: string, data: Partial<Schedule>): void => {
    db.update(schema.schedules)
      .set({ 
        ...data, 
        updatedAt: new Date().toISOString() 
      })
      .where(eq(schema.schedules.id, id))
      .run();
  },

  delete: (id: string): void => {
    db.delete(schema.schedules)
      .where(eq(schema.schedules.id, id))
      .run();
  },

  // ========== SCHEDULE ITEMS CRUD ==========
  
  getItems: (scheduleId: string): EnrichedScheduleItem[] => {
    const items = db
      .select()
      .from(schema.scheduleItems)
      .where(eq(schema.scheduleItems.scheduleId, scheduleId))
      .orderBy(schema.scheduleItems.orderIndex)
      .all();

    // Enrich with joined data
    return items.map(item => {
      const enriched: EnrichedScheduleItem = { ...item };

      // Fetch song data if songId exists (Full data with slides and layers)
      if (item.songId) {
        try {
           enriched.songData = songService.getById(item.songId);
        } catch (e) {
           console.error('[ScheduleService] Error fetching song data:', e);
        }
      }

      // Fetch media data if mediaId exists
      if (item.mediaId) {
        enriched.mediaData = db
          .select()
          .from(schema.media)
          .where(eq(schema.media.id, item.mediaId))
          .get();
      }

      // Fetch theme data if themeId exists
      if (item.themeId) {
        enriched.themeData = db
          .select()
          .from(schema.themes)
          .where(eq(schema.themes.id, item.themeId))
          .get();
      }

      return enriched;
    });
  },

  addItem: (data: NewScheduleItem): string => {
    const id = crypto.randomUUID();
    
    db.insert(schema.scheduleItems)
      .values({
        ...data,
        id,
        createdAt: new Date().toISOString()
      })
      .run();
      
    return id;
  },

  updateItem: (id: string, data: Partial<ScheduleItem>): void => {
    db.update(schema.scheduleItems)
      .set(data)
      .where(eq(schema.scheduleItems.id, id))
      .run();
  },

  deleteItem: (id: string): void => {
    db.delete(schema.scheduleItems)
      .where(eq(schema.scheduleItems.id, id))
      .run();
  },

  // ========== ADVANCED OPERATIONS ==========
  
  reorderItems: (_scheduleId: string, itemIds: string[]): void => {
    // Batch update orderIndex for all items
    itemIds.forEach((itemId, index) => {
      db.update(schema.scheduleItems)
        .set({ orderIndex: index })
        .where(eq(schema.scheduleItems.id, itemId))
        .run();
    });
  },

  duplicateItem: (itemId: string): string => {
    const item = db
      .select()
      .from(schema.scheduleItems)
      .where(eq(schema.scheduleItems.id, itemId))
      .get();

    if (!item) throw new Error('Item not found');

    const newId = crypto.randomUUID();
    const { id, createdAt, ...itemData } = item;

    db.insert(schema.scheduleItems)
      .values({
        ...itemData,
        id: newId,
        orderIndex: item.orderIndex + 1,
        createdAt: new Date().toISOString()
      })
      .run();

    return newId;
  },

  // Clone entire schedule with all items
  cloneSchedule: (scheduleId: string, newName: string): string => {
    const schedule = scheduleService.getById(scheduleId);
    if (!schedule) throw new Error('Schedule not found');

    // Create new schedule with explicit fields
    const newScheduleId = crypto.randomUUID();
    db.insert(schema.schedules)
      .values({
        id: newScheduleId,
        name: newName,
        date: schedule.date,
        serviceType: schedule.serviceType,
        notes: schedule.notes,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .run();

    // Clone all items
    schedule.items.forEach(item => {
      const { id, createdAt, songData, mediaData, themeData, ...itemData } = item;
      scheduleService.addItem({
        ...(itemData as NewScheduleItem),
        scheduleId: newScheduleId,
      });
    });

    return newScheduleId;
  }
};
