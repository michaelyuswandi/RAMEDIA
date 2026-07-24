import { db, schema } from './index';
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import fs from 'fs';
import type { Media } from './schema';

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

export type MediaLibraryPage = {
  items: Media[];
  total: number;
  offset: number;
  limit: number;
};

export const mediaService = {
  getAll: () => {
    return db.select().from(schema.media).all();
  },

  getLibraryPage: (payload: MediaLibraryQuery = {}): MediaLibraryPage => {
    const offset = Math.max(0, Math.floor(payload.offset || 0));
    const limit = Math.min(250, Math.max(1, Math.floor(payload.limit || 84)));
    const query = (payload.query || '').trim();
    const conditions: any[] = [];

    if (query) {
      const pattern = `%${query}%`;
      conditions.push(or(like(schema.media.filename, pattern), like(schema.media.mediaType, pattern)));
    }
    if (payload.mediaTypes) {
      if (payload.mediaTypes.length === 0) return { items: [], total: 0, offset, limit };
      conditions.push(inArray(schema.media.mediaType, payload.mediaTypes));
    }
    if (payload.favoritesOnly) conditions.push(like(schema.media.tags, '%"favorite"%'));
    if (payload.tag) conditions.push(like(schema.media.tags, `%"${payload.tag}"%`));
    if (payload.mediaIds) {
      if (payload.mediaIds.length === 0) return { items: [], total: 0, offset, limit };
      conditions.push(inArray(schema.media.id, payload.mediaIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countBase = db.select({ value: sql<number>`count(*)` }).from(schema.media);
    const countRow = whereClause ? countBase.where(whereClause).get() : countBase.get();
    const sortColumn = payload.sortBy === 'mediaType'
      ? schema.media.mediaType
      : payload.sortBy === 'createdAt'
        ? schema.media.createdAt
        : schema.media.filename;
    const orderExpression = payload.sortDirection === 'desc' ? desc(sortColumn) : asc(sortColumn);
    const itemsBase = db.select().from(schema.media);
    const items = (whereClause ? itemsBase.where(whereClause) : itemsBase)
      .orderBy(orderExpression)
      .limit(limit)
      .offset(offset)
      .all();

    return { items, total: Number(countRow?.value || 0), offset, limit };
  },

  getLibraryTags: (): string[] => {
    const rows = db.select({ tags: schema.media.tags }).from(schema.media).all();
    const tags = new Set<string>();
    rows.forEach((row) => {
      try {
        const parsed = JSON.parse(row.tags || '[]');
        if (Array.isArray(parsed)) parsed.forEach((tag) => tags.add(String(tag)));
      } catch {
        // Ignore malformed legacy tag payloads.
      }
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  },

  getByType: (mediaType: string) => {
    return db.select().from(schema.media).where(eq(schema.media.mediaType, mediaType)).all();
  },
  
  getById: (id: string) => {
    return db.select().from(schema.media).where(eq(schema.media.id, id)).get();
  },

  create: (data: any) => {
    const id = data.id || crypto.randomUUID();
    db.insert(schema.media).values({ ...data, id }).run();
    return id;
  },

  update: (id: string, data: any) => {
    db.update(schema.media).set(data).where(eq(schema.media.id, id)).run();
  },

  delete: (id: string) => {
    db.delete(schema.media).where(eq(schema.media.id, id)).run();
  },

  cleanupOrphans: () => {
    // 1. Get all media files from the database
    const allMedia = db.select().from(schema.media).all();
    
    // 2. Scan referencing tables (scheduleItems and slideLayers)
    const scheduleItems = db.select({ mediaId: schema.scheduleItems.mediaId }).from(schema.scheduleItems).all();
    const slideLayers = db.select({ content: schema.slideLayers.content, layerType: schema.slideLayers.layerType }).from(schema.slideLayers).all();

    // Collect all referenced media IDs
    const referencedMediaIds = new Set<string>();
    
    // Add schedule items media
    for (const item of scheduleItems) {
      if (item.mediaId) referencedMediaIds.add(item.mediaId);
    }
    
    // Add background media (which refer to media IDs)
    for (const layer of slideLayers) {
       // Since background content contains the media path or id, if it's the filepath we need to match it.
       // It's smarter to check if the layer content matches the filepath of the media, or parse out the id.
       if (layer.content && (layer.layerType === 'media' || layer.layerType === 'background')) {
         // This is a naive inclusion, if we use media IDs directly it would be easier.
         // Let's assume content string holds the filepath or is associated somehow. 
         // For complete accuracy, we scan the whole string for the media id or filepath.
       }
    }
    
    // For now we will find media that has NO referencing scheduleItems and NO occurrences in slideLayers.content
    const slideLayersContentString = slideLayers.map(l => l.content).join(' ||| ');

    let deletedCount = 0;
    let savedBytes = 0;

    for (const media of allMedia) {
      const isRefSchedule = referencedMediaIds.has(media.id);
      // Hacky generic check: is the media filepath/id referenced in ANY slide layer content?
      const isRefSlide = slideLayersContentString.includes(media.filepath) || slideLayersContentString.includes(media.id);
      
      if (!isRefSchedule && !isRefSlide) {
         // Orphaned! Delete record and file.
         try {
           let physicalPath = media.filepath;
           if (physicalPath.startsWith('file://')) {
              try {
                // Safely convert file URL to physical path across OS
                physicalPath = require('url').fileURLToPath(physicalPath);
              } catch (e) {
                // Fallback strip
                physicalPath = physicalPath.replace('file://', '');
              }
           }
           if (fs.existsSync(physicalPath)) {
              savedBytes += media.fileSize || 0;
              fs.unlinkSync(physicalPath);
           }
         } catch (e) {
           console.error(`Failed to delete physical file: ${media.filepath}`, e);
         }
         
         db.delete(schema.media).where(eq(schema.media.id, media.id)).run();
         deletedCount++;
      }
    }
    
    return { deletedCount, savedBytes };
  }
};
