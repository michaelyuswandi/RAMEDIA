import { db, schema } from './index';
import { and, asc, desc, eq, like, or, sql } from 'drizzle-orm';
import type { ContentThemeType, Template } from './schema';

export type TemplateLibraryQuery = {
  offset?: number;
  limit?: number;
  query?: string;
  category?: string | null;
  contentType?: ContentThemeType | null;
  sortBy?: 'name' | 'category' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
};

export type TemplateLibraryPage = {
  items: Template[];
  total: number;
  offset: number;
  limit: number;
};

// Generate UUID using native crypto
function generateId(): string {
  return crypto.randomUUID();
}

export const templateService = {
  async getAll() {
    return db.select().from(schema.templates).all();
  },

  async getLibraryPage(payload: TemplateLibraryQuery = {}): Promise<TemplateLibraryPage> {
    const offset = Math.max(0, Math.floor(payload.offset || 0));
    const limit = Math.min(250, Math.max(1, Math.floor(payload.limit || 84)));
    const query = (payload.query || '').trim();
    const searchClause = query
      ? or(like(schema.templates.name, `%${query}%`), like(schema.templates.category, `%${query}%`))
      : undefined;
    const categoryClause = payload.category ? eq(schema.templates.category, payload.category) : undefined;
    const contentTypeClause = payload.contentType ? eq(schema.templates.contentType, payload.contentType) : undefined;
    const clauses = [searchClause, categoryClause, contentTypeClause].filter(Boolean) as any[];
    const whereClause = clauses.length > 1 ? and(...clauses) : clauses[0];
    const countBase = db.select({ value: sql<number>`count(*)` }).from(schema.templates);
    const countRow = whereClause ? countBase.where(whereClause).get() : countBase.get();
    const sortColumn = payload.sortBy === 'category'
      ? schema.templates.category
      : payload.sortBy === 'createdAt'
        ? schema.templates.createdAt
        : schema.templates.name;
    const orderExpression = payload.sortDirection === 'desc' ? desc(sortColumn) : asc(sortColumn);
    const itemsBase = db.select().from(schema.templates);
    const items = (whereClause ? itemsBase.where(whereClause) : itemsBase)
      .orderBy(orderExpression)
      .limit(limit)
      .offset(offset)
      .all();
    return { items, total: Number(countRow?.value || 0), offset, limit };
  },

  async getLibraryCategories(): Promise<string[]> {
    const rows = db.select({ category: schema.templates.category }).from(schema.templates).all();
    return Array.from(new Set(rows.map((row) => row.category).filter((category): category is string => Boolean(category))))
      .sort((a, b) => a.localeCompare(b));
  },

  async getById(id: string) {
    return db.select().from(schema.templates).where(eq(schema.templates.id, id)).get();
  },

  async create(data: { name: string; category: string; layersData: string; contentType?: ContentThemeType; variantsData?: string | null }) {
    const id = generateId();
    db.insert(schema.templates).values({
      id,
      name: data.name,
      category: data.category,
      contentType: data.contentType || 'song',
      layersData: data.layersData,
      variantsData: data.variantsData || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }).run();
    return this.getById(id);
  },

  async update(id: string, data: { name: string; category: string; layersData: string; contentType?: ContentThemeType; variantsData?: string | null }) {
    db.update(schema.templates)
      .set({
        name: data.name,
        category: data.category,
        contentType: data.contentType || 'song',
        layersData: data.layersData,
        variantsData: data.variantsData || null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.templates.id, id))
      .run();

    return this.getById(id);
  },

  async updatePreview(id: string, previewUrl: string | null) {
    db.update(schema.templates)
      .set({ previewUrl })
      .where(eq(schema.templates.id, id))
      .run();
    return this.getById(id);
  },

  async delete(id: string) {
    db.delete(schema.templates).where(eq(schema.templates.id, id)).run();
  }
};
