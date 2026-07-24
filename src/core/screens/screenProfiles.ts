export type ScreenProfileId = 'audience' | 'singer' | 'worship-leader' | 'confidence';

export interface ScreenProfileDefinition {
  id: ScreenProfileId;
  label: string;
  accent: string;
  description: string;
  behavior: string;
}

export const DEFAULT_SCREEN_PROFILE_ID: ScreenProfileId = 'audience';

export const SCREEN_PROFILES: ScreenProfileDefinition[] = [
  {
    id: 'audience',
    label: 'Audience',
    accent: '#f59e0b',
    description: 'Main projector or congregation-facing display.',
    behavior: 'Large cinematic lyrics with minimal metadata.',
  },
  {
    id: 'singer',
    label: 'Singer',
    accent: '#58d5f7',
    description: 'Stage reading screen for singers and musicians.',
    behavior: 'Cleaner contrast and easier reading position.',
  },
  {
    id: 'worship-leader',
    label: 'Worship Leader',
    accent: '#10b981',
    description: 'Cue-oriented screen for service leadership.',
    behavior: 'Designed for future notes and upcoming section hints.',
  },
  {
    id: 'confidence',
    label: 'Confidence',
    accent: '#a78bfa',
    description: 'Support screen for presenters or technical monitoring.',
    behavior: 'Prepared for future confidence and technical overlays.',
  },
];

export function isScreenProfileId(value: unknown): value is ScreenProfileId {
  return SCREEN_PROFILES.some((profile) => profile.id === value);
}

export function getScreenProfileDefinition(profileId: ScreenProfileId): ScreenProfileDefinition {
  return SCREEN_PROFILES.find((profile) => profile.id === profileId) || SCREEN_PROFILES[0];
}
