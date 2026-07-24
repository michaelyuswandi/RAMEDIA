import { db, schema } from './index';
import { eq, and } from 'drizzle-orm';
import type { ScheduleItem, NewScheduleItem } from './schema';
import { randomUUID } from 'crypto';

/**
 * Schedule Item Service
 * Manages schedule items (songs, Bible verses, media, etc.)
 */

/**
 * Get all items for a schedule
 */
export async function getScheduleItems(scheduleId: string): Promise<ScheduleItem[]> {
  return db
    .select()
    .from(schema.scheduleItems)
    .where(eq(schema.scheduleItems.scheduleId, scheduleId))
    .all();
}

/**
 * Get item by ID
 */
export async function getItemById(id: string): Promise<ScheduleItem | undefined> {
  const items = db
    .select()
    .from(schema.scheduleItems)
    .where(eq(schema.scheduleItems.id, id))
    .all();

  return items.length > 0 ? items[0] : undefined;
}

/**
 * Add song to schedule
 */
export async function addSongItem(data: {
  scheduleId: string;
  songId: string;
  orderIndex: number;
  duration?: number;
  themeId?: string;
  notes?: string;
}): Promise<ScheduleItem> {
  const id = randomUUID();
  const item: NewScheduleItem = {
    id,
    scheduleId: data.scheduleId,
    orderIndex: data.orderIndex,
    itemType: 'SONG',
    songId: data.songId,
    duration: data.duration,
    themeId: data.themeId,
    notes: data.notes,
  };

  db.insert(schema.scheduleItems).values(item).run();

  const created = await getItemById(id);
  if (!created) throw new Error('Failed to add song to schedule');

  return created;
}

/**
 * Add Bible verse to schedule
 */
export async function addBibleItem(data: {
  scheduleId: string;
  bibleVersionId: string;
  bibleBook: string;
  bibleChapter: number;
  bibleVerseStart: number;
  bibleVerseEnd?: number;
  orderIndex: number;
  duration?: number; // in milliseconds (default 30s)
  notes?: string;
}): Promise<ScheduleItem> {
  const id = randomUUID();
  const item: NewScheduleItem = {
    id,
    scheduleId: data.scheduleId,
    orderIndex: data.orderIndex,
    itemType: 'BIBLE',
    bibleVersionId: data.bibleVersionId,
    bibleBook: data.bibleBook,
    bibleChapter: data.bibleChapter,
    bibleVerseStart: data.bibleVerseStart,
    bibleVerseEnd: data.bibleVerseEnd,
    duration: data.duration ?? 30000, // default 30 seconds
    notes: data.notes,
  };

  db.insert(schema.scheduleItems).values(item).run();

  const created = await getItemById(id);
  if (!created) throw new Error('Failed to add Bible verse to schedule');

  return created;
}

/**
 * Add media to schedule
 */
export async function addMediaItem(data: {
  scheduleId: string;
  mediaId: string;
  orderIndex: number;
  duration?: number;
  notes?: string;
}): Promise<ScheduleItem> {
  const id = randomUUID();
  const item: NewScheduleItem = {
    id,
    scheduleId: data.scheduleId,
    orderIndex: data.orderIndex,
    itemType: 'MEDIA',
    mediaId: data.mediaId,
    duration: data.duration,
    notes: data.notes,
  };

  db.insert(schema.scheduleItems).values(item).run();

  const created = await getItemById(id);
  if (!created) throw new Error('Failed to add media to schedule');

  return created;
}

/**
 * Add custom announcement to schedule
 */
export async function addAnnouncementItem(data: {
  scheduleId: string;
  content: string; // JSON string
  orderIndex: number;
  duration?: number;
  notes?: string;
}): Promise<ScheduleItem> {
  const id = randomUUID();
  const item: NewScheduleItem = {
    id,
    scheduleId: data.scheduleId,
    orderIndex: data.orderIndex,
    itemType: 'ANNOUNCEMENT',
    content: data.content,
    duration: data.duration,
    notes: data.notes,
  };

  db.insert(schema.scheduleItems).values(item).run();

  const created = await getItemById(id);
  if (!created) throw new Error('Failed to add announcement to schedule');

  return created;
}

/**
 * Update schedule item
 */
export async function updateScheduleItem(
  id: string,
  data: Partial<NewScheduleItem>
): Promise<void> {
  db.update(schema.scheduleItems)
    .set(data)
    .where(eq(schema.scheduleItems.id, id))
    .run();
}

/**
 * Delete schedule item
 */
export async function deleteScheduleItem(id: string): Promise<void> {
  db.delete(schema.scheduleItems)
    .where(eq(schema.scheduleItems.id, id))
    .run();
}

/**
 * Reorder schedule items
 */
export async function reorderScheduleItems(
  items: { id: string; orderIndex: number }[]
): Promise<void> {
  for (const item of items) {
    db.update(schema.scheduleItems)
      .set({ orderIndex: item.orderIndex })
      .where(eq(schema.scheduleItems.id, item.id))
      .run();
  }
}

/**
 * Get Bible items for a schedule
 */
export async function getBibleItems(scheduleId: string): Promise<ScheduleItem[]> {
  return db
    .select()
    .from(schema.scheduleItems)
    .where(
      and(
        eq(schema.scheduleItems.scheduleId, scheduleId),
        eq(schema.scheduleItems.itemType, 'BIBLE')
      )
    )
    .all();
}

/**
 * Get items by type
 */
export async function getItemsByType(
  scheduleId: string,
  itemType: 'SONG' | 'BIBLE' | 'MEDIA' | 'ANNOUNCEMENT'
): Promise<ScheduleItem[]> {
  return db
    .select()
    .from(schema.scheduleItems)
    .where(
      and(
        eq(schema.scheduleItems.scheduleId, scheduleId),
        eq(schema.scheduleItems.itemType, itemType)
      )
    )
    .all();
}
