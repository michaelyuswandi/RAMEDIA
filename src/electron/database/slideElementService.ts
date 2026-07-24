import { db, schema } from './index';
import { eq, and } from 'drizzle-orm';
import type { SlideElement, NewSlideElement } from './schema';
import { randomUUID } from 'crypto';

/**
 * Slide Element Service
 * Manages slide elements (text, Bible verses, images, videos)
 */

/**
 * Get all elements for a slide
 */
export async function getSlideElements(slideId: string): Promise<SlideElement[]> {
  return db
    .select()
    .from(schema.slideElements)
    .where(eq(schema.slideElements.slideId, slideId))
    .all();
}

/**
 * Get element by ID
 */
export async function getElementById(id: string): Promise<SlideElement | undefined> {
  const elements = db
    .select()
    .from(schema.slideElements)
    .where(eq(schema.slideElements.id, id))
    .all();
  
  return elements.length > 0 ? elements[0] : undefined;
}

/**
 * Create new slide element (for text content)
 */
export async function createTextElement(data: {
  slideId: string;
  content: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  align?: 'LEFT' | 'CENTER' | 'RIGHT';
  zIndex?: number;
}): Promise<SlideElement> {
  const id = randomUUID();
  const element: NewSlideElement = {
    id,
    slideId: data.slideId,
    type: 'TEXT',
    content: data.content,
    positionX: data.positionX ?? 0,
    positionY: data.positionY ?? 0,
    width: data.width,
    height: data.height,
    fontSize: data.fontSize ?? 24,
    color: data.color ?? '#FFFFFF',
    align: data.align ?? 'CENTER',
    zIndex: data.zIndex ?? 0,
  };

  db.insert(schema.slideElements).values(element).run();

  const created = await getElementById(id);
  if (!created) throw new Error('Failed to create text element');

  return created;
}

/**
 * Create Bible verse element
 */
export async function createBibleElement(data: {
  slideId: string;
  bibleVersionId: string;
  bibleBook: string;
  bibleChapter: number;
  bibleVerseStart: number;
  bibleVerseEnd?: number;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  align?: 'LEFT' | 'CENTER' | 'RIGHT';
  backgroundColor?: string;
  zIndex?: number;
}): Promise<SlideElement> {
  const id = randomUUID();
  const element: NewSlideElement = {
    id,
    slideId: data.slideId,
    type: 'BIBLE_VERSE',
    bibleVersionId: data.bibleVersionId,
    bibleBook: data.bibleBook,
    bibleChapter: data.bibleChapter,
    bibleVerseStart: data.bibleVerseStart,
    bibleVerseEnd: data.bibleVerseEnd,
    positionX: data.positionX ?? 0,
    positionY: data.positionY ?? 0,
    width: data.width,
    height: data.height,
    fontSize: data.fontSize ?? 24,
    color: data.color ?? '#FFFFFF',
    backgroundColor: data.backgroundColor,
    align: data.align ?? 'CENTER',
    zIndex: data.zIndex ?? 0,
  };

  db.insert(schema.slideElements).values(element).run();

  const created = await getElementById(id);
  if (!created) throw new Error('Failed to create Bible element');

  return created;
}

/**
 * Create image/video element
 */
export async function createMediaElement(data: {
  slideId: string;
  type: 'IMAGE' | 'VIDEO';
  mediaId: string;
  positionX?: number;
  positionY?: number;
  width?: number;
  height?: number;
  zIndex?: number;
  opacity?: number;
}): Promise<SlideElement> {
  const id = randomUUID();
  const element: NewSlideElement = {
    id,
    slideId: data.slideId,
    type: data.type,
    mediaId: data.mediaId,
    positionX: data.positionX ?? 0,
    positionY: data.positionY ?? 0,
    width: data.width,
    height: data.height,
    zIndex: data.zIndex ?? 0,
    opacity: data.opacity ?? 1.0,
  };

  db.insert(schema.slideElements).values(element).run();

  const created = await getElementById(id);
  if (!created) throw new Error('Failed to create media element');

  return created;
}

/**
 * Update slide element
 */
export async function updateElement(
  id: string,
  data: Partial<NewSlideElement>
): Promise<void> {
  db.update(schema.slideElements)
    .set(data)
    .where(eq(schema.slideElements.id, id))
    .run();
}

/**
 * Delete element
 */
export async function deleteElement(id: string): Promise<void> {
  db.delete(schema.slideElements)
    .where(eq(schema.slideElements.id, id))
    .run();
}

/**
 * Delete all elements for a slide
 */
export async function deleteSlideElements(slideId: string): Promise<void> {
  db.delete(schema.slideElements)
    .where(eq(schema.slideElements.slideId, slideId))
    .run();
}

/**
 * Get elements by type
 */
export async function getElementsByType(
  slideId: string,
  type: 'TEXT' | 'BIBLE_VERSE' | 'IMAGE' | 'VIDEO'
): Promise<SlideElement[]> {
  return db
    .select()
    .from(schema.slideElements)
    .where(
      and(
        eq(schema.slideElements.slideId, slideId),
        eq(schema.slideElements.type, type)
      )
    )
    .all();
}

/**
 * Reorder elements (update zIndex)
 */
export async function reorderElements(
  elements: { id: string; zIndex: number }[]
): Promise<void> {
  for (const element of elements) {
    db.update(schema.slideElements)
      .set({ zIndex: element.zIndex })
      .where(eq(schema.slideElements.id, element.id))
      .run();
  }
}

/**
 * Get Bible elements for a slide
 */
export async function getBibleElements(slideId: string): Promise<SlideElement[]> {
  return getElementsByType(slideId, 'BIBLE_VERSE');
}
