import { db, schema } from './index';
import { eq } from 'drizzle-orm';

export const themeService = {
  getAll: () => {
    return db.select().from(schema.themes).all();
  },

  create: (data: any) => {
    const id = crypto.randomUUID();
    db.insert(schema.themes).values({ ...data, id }).run();
    return id;
  },

  update: (id: string, data: any) => {
    db.update(schema.themes).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.themes.id, id)).run();
  },

  delete: (id: string) => {
    db.delete(schema.themes).where(eq(schema.themes.id, id)).run();
  }
};
