import { create } from 'zustand';

export type ControllerStartView = 'songs' | 'bible' | 'audio' | 'prd' | 'capture';
export type ControllerKeyboardFocus = 'preview' | 'live';
export type ControllerSlideViewMode = 'grid' | 'text';

export interface GeneralSettings {
  defaultControllerView: ControllerStartView;
  rememberLastControllerView: boolean;
  restoreLastRundown: boolean;
  defaultKeyboardFocus: ControllerKeyboardFocus;
  defaultSlideViewMode: ControllerSlideViewMode;
}

const STORAGE_KEY = 'rumedia_general_settings_v1';
const LAST_VIEW_KEY = 'rumedia:last-controller-view';
export const LAST_RUNDOWN_KEY = 'rumedia:last-rundown-id';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  defaultControllerView: 'songs',
  rememberLastControllerView: true,
  restoreLastRundown: true,
  defaultKeyboardFocus: 'preview',
  defaultSlideViewMode: 'text',
};

const isControllerView = (value: unknown): value is ControllerStartView => (
  value === 'songs' || value === 'bible' || value === 'audio' || value === 'prd' || value === 'capture'
);

export function loadGeneralSettings(): GeneralSettings {
  if (typeof localStorage === 'undefined') return DEFAULT_GENERAL_SETTINGS;
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return {
      defaultControllerView: isControllerView(parsed.defaultControllerView) ? parsed.defaultControllerView : 'songs',
      rememberLastControllerView: parsed.rememberLastControllerView !== false,
      restoreLastRundown: parsed.restoreLastRundown !== false,
      defaultKeyboardFocus: parsed.defaultKeyboardFocus === 'live' ? 'live' : 'preview',
      defaultSlideViewMode: parsed.defaultSlideViewMode === 'grid' ? 'grid' : 'text',
    };
  } catch {
    return DEFAULT_GENERAL_SETTINGS;
  }
}

export function getInitialControllerView(): ControllerStartView {
  const settings = loadGeneralSettings();
  if (!settings.rememberLastControllerView || typeof localStorage === 'undefined') return settings.defaultControllerView;
  const saved = localStorage.getItem(LAST_VIEW_KEY);
  return isControllerView(saved) ? saved : settings.defaultControllerView;
}

export function rememberControllerView(view: ControllerStartView) {
  if (typeof localStorage !== 'undefined') localStorage.setItem(LAST_VIEW_KEY, view);
}

interface GeneralSettingsState extends GeneralSettings {
  setSettings: (settings: GeneralSettings) => void;
  resetToDefaults: () => void;
}

export const useGeneralSettingsStore = create<GeneralSettingsState>((set) => ({
  ...loadGeneralSettings(),
  setSettings: (settings) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    set(settings);
  },
  resetToDefaults: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_GENERAL_SETTINGS));
    set(DEFAULT_GENERAL_SETTINGS);
  },
}));
