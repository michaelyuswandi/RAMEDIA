import {
  DEFAULT_OUTPUT_SETTINGS,
  sanitizeOutputSettings,
  type OutputDisplayInfo,
  type PersistedOutputSettings,
} from '../models/outputSettings';

const OUTPUT_SETTINGS_STORAGE_KEY = 'rumedia_output_settings_v1';

const webOutputSettingsService = {
  getSettings: async (): Promise<PersistedOutputSettings> => {
    const raw = localStorage.getItem(OUTPUT_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_OUTPUT_SETTINGS;

    try {
      return sanitizeOutputSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_OUTPUT_SETTINGS;
    }
  },

  setSettings: async (settings: Partial<PersistedOutputSettings>): Promise<PersistedOutputSettings> => {
    const current = await webOutputSettingsService.getSettings();
    const next = sanitizeOutputSettings({ ...current, ...settings });
    localStorage.setItem(OUTPUT_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    return next;
  },

  getDisplays: async (): Promise<OutputDisplayInfo[]> => {
    return [
      {
        id: 'browser-preview',
        label: 'Browser Preview',
        isPrimary: true,
        width: window.innerWidth,
        height: window.innerHeight,
      },
    ];
  },
};

export const ipcOutputSettingsService = {
  getSettings: async (): Promise<PersistedOutputSettings> => {
    if (window.api?.outputSettings) {
      return sanitizeOutputSettings(await window.api.outputSettings.getSettings());
    }

    return webOutputSettingsService.getSettings();
  },

  setSettings: async (settings: Partial<PersistedOutputSettings>): Promise<PersistedOutputSettings> => {
    if (window.api?.outputSettings) {
      return sanitizeOutputSettings(await window.api.outputSettings.setSettings(settings));
    }

    return webOutputSettingsService.setSettings(settings);
  },

  getDisplays: async (): Promise<OutputDisplayInfo[]> => {
    if (window.api?.screen?.getDisplays) {
      const displays = await window.api.screen.getDisplays();
      return displays.map((display) => ({
        ...display,
        id: String(display.id),
      }));
    }

    return webOutputSettingsService.getDisplays();
  },
};
