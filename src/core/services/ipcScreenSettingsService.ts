import {
  DEFAULT_SCREEN_PROFILE_ID,
  isScreenProfileId,
  type ScreenProfileId,
} from '../screens/screenProfiles';

const DEFAULT_PROFILE_STORAGE_KEY = 'rumedia_default_screen_profile';

const webScreenSettingsService = {
  getDefaultProfile: async (): Promise<ScreenProfileId> => {
    const value = localStorage.getItem(DEFAULT_PROFILE_STORAGE_KEY);
    return isScreenProfileId(value) ? value : DEFAULT_SCREEN_PROFILE_ID;
  },

  setDefaultProfile: async (profileId: ScreenProfileId): Promise<void> => {
    localStorage.setItem(DEFAULT_PROFILE_STORAGE_KEY, profileId);
  },
};

export const ipcScreenSettingsService = {
  getDefaultProfile: async (): Promise<ScreenProfileId> => {
    if (window.api) {
      const value = await window.api.screen.getDefaultProfile();
      return isScreenProfileId(value) ? value : DEFAULT_SCREEN_PROFILE_ID;
    }

    return webScreenSettingsService.getDefaultProfile();
  },

  setDefaultProfile: async (profileId: ScreenProfileId): Promise<void> => {
    if (window.api) {
      await window.api.screen.setDefaultProfile(profileId);
      return;
    }

    await webScreenSettingsService.setDefaultProfile(profileId);
  },
};
