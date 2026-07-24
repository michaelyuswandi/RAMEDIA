export type SongViewProfileId = 'audience' | 'singer' | 'worship-leader' | 'confidence';

export interface SongViewProfile {
  id: SongViewProfileId;
  label: string;
  shortLabel: string;
  description: string;
  accentColor: string;
  textAnchor: 'top' | 'center' | 'bottom';
  textAlign?: 'left' | 'center' | 'right';
  scaleMultiplier: number;
  boxWidth: number;
  boxHeight: number;
  backgroundTreatment: 'full' | 'dimmed' | 'minimal';
  showSectionLabel: boolean;
  showNextCue: boolean;
  showSongMeta: boolean;
}

export const SONG_VIEW_PROFILES: SongViewProfile[] = [
  {
    id: 'audience',
    label: 'Audience',
    shortLabel: 'AUD',
    description: 'Cinematic congregation lyrics with strong center emphasis.',
    accentColor: '#f59e0b',
    textAnchor: 'center',
    textAlign: 'center',
    scaleMultiplier: 1,
    boxWidth: 76,
    boxHeight: 48,
    backgroundTreatment: 'full',
    showSectionLabel: false,
    showNextCue: false,
    showSongMeta: false,
  },
  {
    id: 'singer',
    label: 'Singer',
    shortLabel: 'SGR',
    description: 'Lower reading position with quick section awareness for singers.',
    accentColor: '#58d5f7',
    textAnchor: 'bottom',
    textAlign: 'center',
    scaleMultiplier: 0.92,
    boxWidth: 84,
    boxHeight: 24,
    backgroundTreatment: 'dimmed',
    showSectionLabel: true,
    showNextCue: false,
    showSongMeta: false,
  },
  {
    id: 'worship-leader',
    label: 'Worship Leader',
    shortLabel: 'WL',
    description: 'Adds section and upcoming cue context while keeping lyrics readable.',
    accentColor: '#10b981',
    textAnchor: 'bottom',
    textAlign: 'left',
    scaleMultiplier: 0.82,
    boxWidth: 82,
    boxHeight: 26,
    backgroundTreatment: 'dimmed',
    showSectionLabel: true,
    showNextCue: true,
    showSongMeta: true,
  },
  {
    id: 'confidence',
    label: 'Confidence',
    shortLabel: 'CONF',
    description: 'Technical confidence screen with more metadata and lower visual weight.',
    accentColor: '#a78bfa',
    textAnchor: 'top',
    textAlign: 'left',
    scaleMultiplier: 0.74,
    boxWidth: 86,
    boxHeight: 24,
    backgroundTreatment: 'minimal',
    showSectionLabel: true,
    showNextCue: true,
    showSongMeta: true,
  },
];

export function getSongViewProfile(profileId: SongViewProfileId) {
  return SONG_VIEW_PROFILES.find((profile) => profile.id === profileId) || SONG_VIEW_PROFILES[0];
}
