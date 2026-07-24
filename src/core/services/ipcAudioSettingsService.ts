const AUDIO_MASTER_VOLUME_KEY = 'rumedia_audio_master_volume';

const webAudioSettingsService = {
  getMasterVolume: async (): Promise<number> => {
    const raw = localStorage.getItem(AUDIO_MASTER_VOLUME_KEY);
    const parsed = raw ? Number(raw) : 100;
    return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : 100;
  },

  setMasterVolume: async (volume: number): Promise<void> => {
    localStorage.setItem(AUDIO_MASTER_VOLUME_KEY, String(Math.max(0, Math.min(100, volume))));
  },
};

export const ipcAudioSettingsService = {
  getMasterVolume: async (): Promise<number> => {
    if (window.api?.audioSettings) {
      return await window.api.audioSettings.getMasterVolume();
    }

    return await webAudioSettingsService.getMasterVolume();
  },

  setMasterVolume: async (volume: number): Promise<void> => {
    if (window.api?.audioSettings) {
      await window.api.audioSettings.setMasterVolume(volume);
      return;
    }

    await webAudioSettingsService.setMasterVolume(volume);
  },
};
