export const ipcPresetPreviewService = {
  save: async (id: string, dataUrl: string, previousUrl?: string | null): Promise<string> => {
    if (window.api?.presetPreview?.save) {
      return await window.api.presetPreview.save({ id, dataUrl, previousUrl: previousUrl || null });
    }
    return dataUrl;
  },
  delete: async (previewUrl: string | null | undefined): Promise<void> => {
    if (!previewUrl || !window.api?.presetPreview?.delete) return;
    await window.api.presetPreview.delete(previewUrl);
  },
};
