import { create } from 'zustand';
import { ipcOutputSettingsService } from '../services/ipcOutputSettingsService';
import {
  DEFAULT_OUTPUT_SETTINGS,
  sanitizeOutputSettings,
  type AspectRatioMode,
  type PersistedOutputSettings,
} from '../models/outputSettings';

interface SettingsState extends PersistedOutputSettings {
  isHydrated: boolean;
  setSettings: (settings: Partial<PersistedOutputSettings>) => void;
  hydrateSettings: () => Promise<void>;
  resetToDefaults: () => void;
}

// Helper: Convert hex to RGB string for Tailwind CSS variables
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (result) {
    return `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`;
  }
  return '245 158 11';
}

function applyDocumentTheme(settings: Partial<PersistedOutputSettings>) {
  if (settings.primaryColor) {
    const rgbValue = hexToRgb(settings.primaryColor);
    document.documentElement.style.setProperty('--color-primary', settings.primaryColor);
    document.documentElement.style.setProperty('--color-primary-rgb', rgbValue);
  }

  if (settings.appTheme) {
    if (settings.appTheme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }

  if (settings.locale) {
    document.documentElement.lang = settings.locale;
  }
}

function deriveAspectRatioMode(outputWidth: number, outputHeight: number): AspectRatioMode {
  const ratio = outputWidth / outputHeight;

  if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
  if (Math.abs(ratio - 4 / 3) < 0.01) return '4:3';
  if (Math.abs(ratio - 21 / 9) < 0.02) return '21:9';
  return 'custom';
}

export const useSettingsStore = create<SettingsState>((set) => ({
  ...DEFAULT_OUTPUT_SETTINGS,
  isHydrated: false,

  setSettings: (settings) => {
    set((state) => {
      const normalized = sanitizeOutputSettings({
        ...state,
        ...settings,
        aspectRatioMode:
          settings.outputWidth && settings.outputHeight
            ? deriveAspectRatioMode(settings.outputWidth, settings.outputHeight)
            : settings.aspectRatioMode ?? state.aspectRatioMode,
      });

      applyDocumentTheme(normalized);
      void ipcOutputSettingsService.setSettings(normalized).catch(() => undefined);
      return { ...state, ...normalized };
    });
  },

  hydrateSettings: async () => {
    const persisted = await ipcOutputSettingsService.getSettings();
    const normalized = sanitizeOutputSettings(persisted);
    set({ ...normalized, isHydrated: true });
    applyDocumentTheme(normalized);
  },
  
  resetToDefaults: () => {
    set({ ...DEFAULT_OUTPUT_SETTINGS });
    applyDocumentTheme(DEFAULT_OUTPUT_SETTINGS);
  },
}));
