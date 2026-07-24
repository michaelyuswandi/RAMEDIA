import { eq } from 'drizzle-orm';
import { db, schema } from './index';
import {
  DEFAULT_SCREEN_PROFILE_ID,
  isScreenProfileId,
  type ScreenProfileId,
} from '../../core/screens/screenProfiles';
import {
  DEFAULT_OUTPUT_SETTINGS,
  sanitizeOutputSettings,
  type PersistedOutputSettings,
} from '../../core/models/outputSettings';

const DEFAULT_SCREEN_PROFILE_KEY = 'screens.defaultProfile';
const AUDIO_MASTER_VOLUME_KEY = 'audio.masterVolume';
const OUTPUT_SETTINGS_KEY = 'output.settings';

export const appSettingsService = {
  get: (key: string): string | null => {
    const setting = db
      .select()
      .from(schema.appSettings)
      .where(eq(schema.appSettings.key, key))
      .get();

    return setting?.value ?? null;
  },

  set: (key: string, value: string): void => {
    const now = new Date().toISOString();
    const currentValue = appSettingsService.get(key);

    if (currentValue === null) {
      db.insert(schema.appSettings)
        .values({
          key,
          value,
          updatedAt: now,
        })
        .run();
      return;
    }

    db.update(schema.appSettings)
      .set({
        value,
        updatedAt: now,
      })
      .where(eq(schema.appSettings.key, key))
      .run();
  },

  getDefaultScreenProfile: (): ScreenProfileId => {
    const value = appSettingsService.get(DEFAULT_SCREEN_PROFILE_KEY);
    return isScreenProfileId(value) ? value : DEFAULT_SCREEN_PROFILE_ID;
  },

  setDefaultScreenProfile: (profileId: ScreenProfileId): void => {
    appSettingsService.set(DEFAULT_SCREEN_PROFILE_KEY, profileId);
  },

  getAudioMasterVolume: (): number => {
    const value = Number(appSettingsService.get(AUDIO_MASTER_VOLUME_KEY) ?? '100');
    return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 100;
  },

  setAudioMasterVolume: (volume: number): void => {
    appSettingsService.set(AUDIO_MASTER_VOLUME_KEY, String(Math.max(0, Math.min(100, volume))));
  },

  getOutputSettings: (): PersistedOutputSettings => {
    const raw = appSettingsService.get(OUTPUT_SETTINGS_KEY);
    if (!raw) return DEFAULT_OUTPUT_SETTINGS;

    try {
      return sanitizeOutputSettings(JSON.parse(raw));
    } catch {
      return DEFAULT_OUTPUT_SETTINGS;
    }
  },

  setOutputSettings: (settings: Partial<PersistedOutputSettings>): PersistedOutputSettings => {
    const next = sanitizeOutputSettings({
      ...appSettingsService.getOutputSettings(),
      ...settings,
    });
    appSettingsService.set(OUTPUT_SETTINGS_KEY, JSON.stringify(next));
    return next;
  },
};
