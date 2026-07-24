// Mock service for Web Mode
const webThemeService = {
  getAll: async (): Promise<any[]> => {
    const data = localStorage.getItem('rumedia_themes');
    return data ? JSON.parse(data) : [];
  },
  create: async (data: any): Promise<string> => {
    const items = await webThemeService.getAll();
    const newItem = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    items.push(newItem);
    localStorage.setItem('rumedia_themes', JSON.stringify(items));
    return newItem.id;
  },
  update: async (id: string, data: any): Promise<void> => {
    const items = await webThemeService.getAll();
    const index = items.findIndex(i => i.id === id);
    if (index !== -1) {
      items[index] = { ...items[index], ...data };
      localStorage.setItem('rumedia_themes', JSON.stringify(items));
    }
  },
  delete: async (id: string): Promise<void> => {
    const items = await webThemeService.getAll();
    const newItems = items.filter(i => i.id !== id);
    localStorage.setItem('rumedia_themes', JSON.stringify(newItems));
  }
};

export const ipcThemeService = {
  getAll: async (): Promise<any[]> => {
    if (window.api) return await window.api.theme.getAll();
    return await webThemeService.getAll();
  },

  create: async (data: any): Promise<string> => {
    if (window.api) return await window.api.theme.create(data);
    return await webThemeService.create(data);
  },

  update: async (id: string, data: any): Promise<void> => {
    if (window.api) await window.api.theme.update(id, data);
    else await webThemeService.update(id, data);
  },

  delete: async (id: string): Promise<void> => {
    if (window.api) await window.api.theme.delete(id);
    else await webThemeService.delete(id);
  }
};
