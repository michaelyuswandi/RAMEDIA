export type WorkspaceWindowKind = 'song-editor' | 'settings' | 'bible-settings';

export interface OpenWorkspaceWindowPayload {
  kind: WorkspaceWindowKind;
  id?: string | null;
  name?: string | null;
}

export interface WorkspaceWindowSavedPayload {
  kind: 'song' | 'settings' | 'bible-settings';
  id?: string | null;
}


