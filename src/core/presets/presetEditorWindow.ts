export type PresetEditorKind = 'content-theme' | 'screen-layout' | 'choose';

export interface OpenPresetEditorPayload {
  kind: PresetEditorKind;
  id?: string | null;
  name?: string | null;
}

export interface PresetEditorSavedPayload {
  kind: Exclude<PresetEditorKind, 'choose'>;
  id?: string | null;
}
