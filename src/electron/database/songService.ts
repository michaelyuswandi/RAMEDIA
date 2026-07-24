import { db, schema } from './index';
import { and, asc, desc, eq, inArray, like, or, sql } from 'drizzle-orm';
import type { Song, Slide, SlideLayer } from './schema';
import { parseSongLyrics } from '../../utils/songParser';
import { buildLayersFromSongPreset } from '../../core/songEditor/songPresets';
import { DEFAULT_OUTPUT_SETTINGS, resolvePrimaryOutputChannel, resolveSongPresetIdForOutput, resolveSongPresetIdForRole, shouldForceSongThemeForOutput } from '../../core/models/outputSettings';
import { appSettingsService } from './appSettingsService';
import { isScreenProfileId, type ScreenProfileId } from '../../core/screens/screenProfiles';

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

type SlideWithLayersPayload = Slide & { layers: SlideLayer[] };

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

const CUSTOM_LAYERS_MARKER = '__custom_layers__';

function replaceSlidesFromLyrics(songId: string, rawLyrics: string) {
  const existingSlides = db.select({ id: schema.slides.id })
    .from(schema.slides)
    .where(eq(schema.slides.songId, songId))
    .all();

  for (const slide of existingSlides) {
    db.delete(schema.slideLayers)
      .where(eq(schema.slideLayers.slideId, slide.id))
      .run();
  }

  db.delete(schema.slides)
    .where(eq(schema.slides.songId, songId))
    .run();

  const parsedSections = parseSongLyrics(rawLyrics);

  parsedSections.forEach((section, index) => {
    const slideId = generateId();

    db.insert(schema.slides).values({
      id: slideId,
      songId,
      orderIndex: index + 1,
      sectionType: section.type,
      sectionNumber: section.number,
      content: section.content,
    }).run();

    // Note: We intentionally DO NOT create physical layers here.
    // A slide without layers acts as a "Default" slide and will dynamically
    // render using the global `defaultSongStyle`.
  });
}

function replaceSlidesFromPayload(songId: string, slides: SlideWithLayersPayload[]) {
  const existingSlides = db
    .select({ id: schema.slides.id })
    .from(schema.slides)
    .where(eq(schema.slides.songId, songId))
    .all();

  for (const slide of existingSlides) {
    db.delete(schema.slideLayers)
      .where(eq(schema.slideLayers.slideId, slide.id))
      .run();
  }

  db.delete(schema.slides)
    .where(eq(schema.slides.songId, songId))
    .run();

  slides.forEach((slide, index) => {
    const slideId = slide.id || generateId();
    db.insert(schema.slides).values({
      id: slideId,
      songId,
      orderIndex: index + 1,
      sectionType: slide.sectionType || 'verse',
      sectionNumber: slide.sectionNumber ?? null,
      content: slide.content || '',
      notes: slide.notes ?? null,
      customThemeId: slide.customThemeId ?? null,
      createdAt: slide.createdAt || new Date().toISOString(),
    }).run();

    const sourceLayers = slide.layers?.length ? slide.layers : [];
    sourceLayers.forEach((layer, layerIndex) => {
      db.insert(schema.slideLayers).values({
        id: layer.id || generateId(),
        slideId,
        layerType: layer.layerType,
        layerOrder: layer.layerOrder || layerIndex + 1,
        visible: layer.visible ?? true,
        opacity: layer.opacity ?? 1,
        content: layer.content ?? null,
        mediaId: layer.mediaId ?? null,
        style: layer.style ?? null,
        transition: layer.transition ?? null,
      } as any).run();
    });
  });
}

// Song Service
export const songService = {
  // Get all songs
  getAll(): Song[] {
    return db.select().from(schema.songs).all();
  },

  getLibraryPage(payload: SongLibraryQuery = {}): SongLibraryPage {
    const offset = Math.max(0, Math.floor(payload.offset || 0));
    const limit = Math.min(250, Math.max(1, Math.floor(payload.limit || 84)));
    const query = (payload.query || '').trim();
    const searchBy = payload.searchBy || 'all';
    const conditions: any[] = [];

    if (query) {
      const pattern = `%${query}%`;
      if (searchBy === 'title') conditions.push(like(schema.songs.title, pattern));
      else if (searchBy === 'author') conditions.push(like(schema.songs.author, pattern));
      else if (searchBy === 'lyrics') conditions.push(like(schema.songs.rawLyrics, pattern));
      else {
        conditions.push(or(
          like(schema.songs.title, pattern),
          like(schema.songs.author, pattern),
          like(schema.songs.rawLyrics, pattern),
        ));
      }
    }

    if (payload.favoritesOnly) {
      conditions.push(like(schema.songs.tags, '%"favorite"%'));
    }
    if (payload.tag) {
      conditions.push(like(schema.songs.tags, `%"${payload.tag}"%`));
    }
    if (payload.songIds) {
      if (payload.songIds.length === 0) return { items: [], total: 0, offset, limit };
      conditions.push(inArray(schema.songs.id, payload.songIds));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const countBase = db.select({ value: sql<number>`count(*)` }).from(schema.songs);
    const countRow = whereClause ? countBase.where(whereClause).get() : countBase.get();

    const sortColumn = payload.sortBy === 'author'
      ? schema.songs.author
      : payload.sortBy === 'copyright'
        ? schema.songs.copyright
        : schema.songs.title;
    const orderExpression = payload.sortDirection === 'desc' ? desc(sortColumn) : asc(sortColumn);
    const itemsBase = db.select().from(schema.songs);
    const items = (whereClause ? itemsBase.where(whereClause) : itemsBase)
      .orderBy(orderExpression)
      .limit(limit)
      .offset(offset)
      .all();

    return {
      items,
      total: Number(countRow?.value || 0),
      offset,
      limit,
    };
  },

  getLibraryTags(): string[] {
    const rows = db.select({ tags: schema.songs.tags }).from(schema.songs).all();
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

  // Get song by ID with slides
  getById(id: string, role?: ScreenProfileId | null, outputId?: string | null) {
    const song = db.select().from(schema.songs).where(eq(schema.songs.id, id)).get();
    if (!song) return null;

    const slides = db.select().from(schema.slides)
      .where(eq(schema.slides.songId, id))
      .orderBy(schema.slides.orderIndex)
      .all();

    // Get layers for each slide
    const slidesWithLayers = slides.map(slide => {
      const storedLayers = db.select().from(schema.slideLayers)
        .where(eq(schema.slideLayers.slideId, slide.id))
        .orderBy(schema.slideLayers.layerOrder)
        .all();

      const outputSettings = appSettingsService.getOutputSettings();
      const primaryOutputRole = resolvePrimaryOutputChannel(outputSettings)?.role;
      const legacyDefaultRole = appSettingsService.getDefaultScreenProfile();
      // Gunakan role dari parameter jika diberikan, fallback ke primary output agar preset Settings -> Output konsisten.
      const resolvedRole = (role && isScreenProfileId(role))
        ? role
        : (primaryOutputRole && isScreenProfileId(primaryOutputRole) ? primaryOutputRole : legacyDefaultRole);
      const resolvedOutput = outputId
        ? outputSettings.outputs.find((output) => output.id === outputId) || null
        : outputSettings.outputs.find((output) => output.isPrimary && output.role === resolvedRole)
          || outputSettings.outputs.find((output) => output.enabled && output.role === resolvedRole)
          || null;
      const forcePreset = shouldForceSongThemeForOutput(outputSettings, resolvedOutput?.id);
      if (!forcePreset && storedLayers.length > 0 && slide.customThemeId === CUSTOM_LAYERS_MARKER) {
        return { ...slide, layers: storedLayers };
      }
      const resolvedTemplateId = resolvedOutput
        ? resolveSongPresetIdForOutput(outputSettings, resolvedOutput.id, song.defaultTemplateId)
        : song.defaultTemplateId || resolveSongPresetIdForRole(outputSettings, resolvedRole);
      let template = resolvedTemplateId
        ? db.select().from(schema.templates).where(eq(schema.templates.id, resolvedTemplateId)).get()
        : null;
      const defaultSongStyle = outputSettings.defaultSongStyle || DEFAULT_OUTPUT_SETTINGS.defaultSongStyle;

      return {
        ...slide,
        layers: buildLayersFromSongPreset(
          slide.id,
          slide.content || '',
          template,
          defaultSongStyle,
          {
            songTitle: song.title || 'Song Title',
            sectionLabel: slide.sectionType
              ? `${slide.sectionType.charAt(0).toUpperCase()}${slide.sectionType.slice(1)}${slide.sectionNumber ? ` ${slide.sectionNumber}` : ''}`
              : `Slide ${slide.orderIndex}`,
          },
        ),
      };
    });

    return { ...song, slides: slidesWithLayers };
  },

  resolveSlideForOutput(slide: any, outputId: string) {
    if (!slide?.songId) return slide;
    const song = this.getById(String(slide.songId), null, outputId);
    if (!song) return slide;
    return song.slides.find((candidate) => candidate.id === slide.id) || slide;
  },

  // Search songs
  search(query: string): Song[] {
    return db.select().from(schema.songs)
      .where(like(schema.songs.title, `%${query}%`))
      .all();
  },

  // Create new song from raw lyrics (Easy Mode)
  createFromLyrics(title: string, rawLyrics: string, author?: string): string {
    const songId = generateId();

    // Insert song
    db.insert(schema.songs).values({
      id: songId,
      title,
      author: author || null,
      rawLyrics,
      tags: JSON.stringify([]),
      defaultTemplateId: null,
    }).run();

    replaceSlidesFromLyrics(songId, rawLyrics);

    return songId;
  },

  // Update song
  update(id: string, data: Partial<Song> & { slides?: SlideWithLayersPayload[] }) {
    const nextData = { ...data };
    const nextLyrics = nextData.rawLyrics;
    const nextSlides = nextData.slides;
    delete (nextData as Partial<Song> & { slides?: SlideWithLayersPayload[] }).slides;

    db.update(schema.songs)
      .set({ ...nextData, updatedAt: new Date().toISOString() })
      .where(eq(schema.songs.id, id))
      .run();

    if (Array.isArray(nextSlides)) {
      replaceSlidesFromPayload(id, nextSlides);
    } else if (typeof nextLyrics === 'string') {
      replaceSlidesFromLyrics(id, nextLyrics);
    }
  },

  // Delete song
  delete(id: string) {
    const existingSlides = db.select({ id: schema.slides.id })
      .from(schema.slides)
      .where(eq(schema.slides.songId, id))
      .all();

    for (const slide of existingSlides) {
      db.delete(schema.slideLayers)
        .where(eq(schema.slideLayers.slideId, slide.id))
        .run();
    }

    db.delete(schema.slides).where(eq(schema.slides.songId, id)).run();
    db.delete(schema.songs).where(eq(schema.songs.id, id)).run();
  },
};

export default songService;
