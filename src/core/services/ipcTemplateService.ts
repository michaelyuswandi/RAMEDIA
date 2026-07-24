import type { ContentThemeType, Template } from '../../electron/database/schema';
import { CONTENT_THEME_SEEDS, CONTENT_THEME_SEED_REVISION } from '../presets/contentThemeSeeds';

export type TemplateLibraryQuery = {
  offset?: number;
  limit?: number;
  query?: string;
  category?: string | null;
  contentType?: ContentThemeType | null;
  sortBy?: 'name' | 'category' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
};

export type TemplateLibraryPage = { items: Template[]; total: number; offset: number; limit: number };

function notifyTemplatesChanged(templateId?: string | null) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('rumedia:templates-changed', { detail: { templateId: templateId || null } }));
}

function getContentThemeSeedRevision(variantsData: string | null | undefined) {
  try {
    const variants = JSON.parse(variantsData || '[]');
    const defaultVariant = Array.isArray(variants) ? variants.find((variant) => variant?.id === 'default') : null;
    return Number(defaultVariant?.seedRevision) || 0;
  } catch {
    return 0;
  }
}

// MOCK SERVICE FOR WEB BROWSER (LocalStorage)
const webTemplateService = {
  getAll: async (): Promise<Template[]> => {
    const data = localStorage.getItem('rumedia_templates');
    return data ? JSON.parse(data) : [];
  },
  getLibraryPage: async (payload: TemplateLibraryQuery = {}): Promise<TemplateLibraryPage> => {
    const templates = await webTemplateService.getAll();
    const query = (payload.query || '').trim().toLocaleLowerCase();
    const filtered = templates.filter((template) => {
      if (payload.category && template.category !== payload.category) return false;
      if (payload.contentType && (template.contentType || 'song') !== payload.contentType) return false;
      if (!query) return true;
      return template.name.toLocaleLowerCase().includes(query) || (template.category || '').toLocaleLowerCase().includes(query);
    });
    const sortKey = payload.sortBy || 'name';
    const direction = payload.sortDirection === 'desc' ? -1 : 1;
    filtered.sort((a, b) => String(a[sortKey] || '').localeCompare(String(b[sortKey] || '')) * direction);
    const offset = Math.max(0, Math.floor(payload.offset || 0));
    const limit = Math.min(250, Math.max(1, Math.floor(payload.limit || 84)));
    return { items: filtered.slice(offset, offset + limit), total: filtered.length, offset, limit };
  },
  getLibraryCategories: async (): Promise<string[]> => {
    const templates = await webTemplateService.getAll();
    return Array.from(new Set(templates.map((template) => template.category).filter((category): category is string => Boolean(category))))
      .sort((a, b) => a.localeCompare(b));
  },
  getById: async (id: string): Promise<Template | null> => {
    const templates = await webTemplateService.getAll();
    return templates.find((template) => template.id === id) || null;
  },
  create: async (data: { name: string; category: string; layersData: string; contentType?: ContentThemeType; variantsData?: string | null }): Promise<string> => {
    const templates = await webTemplateService.getAll();
    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name: data.name,
      category: data.category,
      contentType: data.contentType || 'song',
      layersData: data.layersData,
      variantsData: data.variantsData || null,
      previewUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    templates.push(newTemplate);
    localStorage.setItem('rumedia_templates', JSON.stringify(templates));
    return newTemplate.id;
  },
  update: async (id: string, data: { name: string; category: string; layersData: string; contentType?: ContentThemeType; variantsData?: string | null }): Promise<void> => {
    const templates = await webTemplateService.getAll();
    const nextTemplates = templates.map((template) => (
      template.id === id
        ? {
            ...template,
            name: data.name,
            category: data.category,
            contentType: data.contentType || 'song',
            layersData: data.layersData,
            variantsData: data.variantsData || null,
            updatedAt: new Date().toISOString(),
          }
        : template
    ));
    localStorage.setItem('rumedia_templates', JSON.stringify(nextTemplates));
  },
  updatePreview: async (id: string, previewUrl: string | null): Promise<void> => {
    const templates = await webTemplateService.getAll();
    localStorage.setItem('rumedia_templates', JSON.stringify(templates.map((template) => (
      template.id === id ? { ...template, previewUrl } : template
    ))));
  },
  delete: async (id: string): Promise<void> => {
    const templates = await webTemplateService.getAll();
    const newTemplates = templates.filter(t => t.id !== id);
    localStorage.setItem('rumedia_templates', JSON.stringify(newTemplates));
  },
  seed: async (): Promise<void> => {
    const templates = await webTemplateService.getAll();
    const seedByName = new Map(CONTENT_THEME_SEEDS.map((seed) => [seed.name, seed]));
    const now = new Date().toISOString();
    const updatedTemplates = templates.map((template) => {
      const seed = seedByName.get(template.name);
      if (!seed) return template;
      const isUnmodifiedSeed = Boolean(template.createdAt && template.createdAt === template.updatedAt);
      if (!isUnmodifiedSeed || getContentThemeSeedRevision(template.variantsData) >= CONTENT_THEME_SEED_REVISION) return template;
      return {
        ...template,
        category: seed.category,
        contentType: seed.contentType,
        layersData: seed.layersData,
        variantsData: seed.variantsData,
        previewUrl: null,
      };
    });
    const existingNames = new Set(updatedTemplates.map((template) => template.name));
    const missingSeeds: Template[] = CONTENT_THEME_SEEDS
      .filter((seed) => !existingNames.has(seed.name))
      .map((seed) => ({
        id: crypto.randomUUID(),
        ...seed,
        previewUrl: null,
        createdAt: now,
        updatedAt: now,
      }));
    if (missingSeeds.length > 0) {
      localStorage.setItem('rumedia_templates', JSON.stringify([...updatedTemplates, ...missingSeeds]));
    } else if (updatedTemplates.some((template, index) => template !== templates[index])) {
      localStorage.setItem('rumedia_templates', JSON.stringify(updatedTemplates));
    }
  }
};

export const ipcTemplateService = {
  getAll: async (): Promise<Template[]> => {
    if (window.api?.template) return await window.api.template.getAll();
    return await webTemplateService.getAll();
  },
  getLibraryPage: async (payload: TemplateLibraryQuery = {}): Promise<TemplateLibraryPage> => {
    if (window.api?.template?.getLibraryPage) return await window.api.template.getLibraryPage(payload);
    return await webTemplateService.getLibraryPage(payload);
  },
  getLibraryCategories: async (): Promise<string[]> => {
    if (window.api?.template?.getLibraryCategories) return await window.api.template.getLibraryCategories();
    return await webTemplateService.getLibraryCategories();
  },
  getById: async (id: string): Promise<Template | null> => {
    if (window.api?.template?.getById) return await window.api.template.getById(id);
    return await webTemplateService.getById(id);
  },
  create: async (name: string, category: string, layersData: string, contentType: ContentThemeType = 'song', variantsData: string | null = null): Promise<string> => {
    const payload = { name, category, layersData, contentType, variantsData };
    const id = window.api?.template
      ? await window.api.template.create(payload)
      : await webTemplateService.create(payload);
    notifyTemplatesChanged(id);
    return id;
  },
  update: async (id: string, name: string, category: string, layersData: string, contentType: ContentThemeType = 'song', variantsData: string | null = null): Promise<void> => {
    const payload = { name, category, layersData, contentType, variantsData };
    if (window.api?.template?.update) {
      await window.api.template.update(id, payload);
      notifyTemplatesChanged(id);
      return;
    }
    await webTemplateService.update(id, payload);
    notifyTemplatesChanged(id);
  },
  updatePreview: async (id: string, previewUrl: string | null): Promise<void> => {
    if (window.api?.template?.updatePreview) await window.api.template.updatePreview(id, previewUrl);
    else await webTemplateService.updatePreview(id, previewUrl);
  },
  delete: async (id: string): Promise<void> => {
    if (window.api?.template) {
      await window.api.template.delete(id);
      notifyTemplatesChanged(id);
      return;
    }
    await webTemplateService.delete(id);
    notifyTemplatesChanged(id);
  },
  seed: async (): Promise<void> => {
    if (!window.api) await webTemplateService.seed();
  }
};
