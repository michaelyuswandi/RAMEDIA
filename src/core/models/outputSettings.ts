import { DEFAULT_SCREEN_PROFILE_ID, isScreenProfileId, type ScreenProfileId } from '../screens/screenProfiles';
import type { LocaleCode } from '../../i18n';
import type { BiblePresentationStyle } from '../utils/biblePresentation';
import type { TransitionMode } from './types';

export type AspectRatioMode = '16:9' | '4:3' | '21:9' | 'custom';
export type OutputTargetType = 'electron-display' | 'browser-client' | 'ndi';
export type OutputRenderMode = 'follow-slide' | 'custom-layout';
export type OutputLayoutType = 'audience-default' | 'worship-leader-foldback' | 'singer-confidence' | 'minimal-lyrics';
export type OutputWidgetId = 'slideCanvas' | 'currentLyrics' | 'nextLyrics' | 'previousLyrics' | 'clock' | 'timer' | 'notes' | 'sectionLabel' | 'showName' | 'progress' | 'videoCountdown' | 'logo' | 'alert';
export type ContentThemeType = 'song' | 'scripture' | 'presentation' | 'media';
export type ContentThemePolicy = 'follow' | 'fallback' | 'force';
export type OutputTransitionEasing = 'easeOut' | 'easeInOut' | 'linear';
export type OutputTransitionType = TransitionMode | 'blend' | 'cover' | 'cube' | 'drop' | 'iris' | 'page-flip' | 'push' | 'reveal';
export type OutputTransitionDirection = 'left' | 'right' | 'up' | 'down';
export type OutputStyleOverrideMode<T> =
  | { mode: 'inherit'; value: null }
  | { mode: 'override'; value: T };

export interface DefaultSongStyle {
  x: number;
  y: number;
  textAlign: string;
  boxWidth: number;
  boxHeight: number;
  fontFamily: string;
  fontWeight: number;
  fontStyle: string;
  textDecoration: string;
  color: string;
  shadow: boolean;
  scale: number;
  allowWrap: boolean;
  backgroundMode: 'solid' | 'media';
  backgroundColor: string;
  backgroundMediaId: string | null;
}

export interface OutputDisplayInfo {
  id: string;
  label: string;
  isPrimary: boolean;
  width: number;
  height: number;
}

export type SongPresetDefaultsByRole = Record<ScreenProfileId, string | null>;

export interface BrowserOutputClient {
  id: string;
  name: string;
  pairingCode: string;
  notes: string | null;
}

export interface LogoOutputSettings {
  mediaId: string | null;
  filename: string | null;
  mediaType: 'image' | 'video' | null;
  source: string | null;
  thumbnail: string | null;
  fit: 'contain' | 'cover' | 'fill';
  loop: boolean;
}

export interface NdiOutputConfig {
  sourceName: string;
  resolution: '1080p' | '720p';
  fps: 30 | 60;
  includeAudio: boolean;
  alphaEnabled: boolean;
  contentMode: 'full-output' | 'broadcast-lyrics';
  lyricsOverlay: BroadcastLyricsSettings;
}

export interface BroadcastLyricsSettings {
  x: number;
  y: number;
  width: number;
  height: number;
  padding: number;
  minFontSize: number;
  maxFontSize: number;
  maxLines: number;
  fontFamily: string;
  fontWeight: number;
  color: string;
  textAlign: 'left' | 'center' | 'right';
  verticalAlign: 'top' | 'middle' | 'bottom';
  outlineSize: number;
  outlineColor: string;
  shadow: boolean;
  showSectionLabel: boolean;
}

export const DEFAULT_BROADCAST_LYRICS_SETTINGS: BroadcastLyricsSettings = {
  x: 8,
  y: 67,
  width: 84,
  height: 25,
  padding: 3,
  minFontSize: 28,
  maxFontSize: 76,
  maxLines: 4,
  fontFamily: 'Manrope, sans-serif',
  fontWeight: 700,
  color: '#ffffff',
  textAlign: 'center',
  verticalAlign: 'middle',
  outlineSize: 3,
  outlineColor: '#111318',
  shadow: true,
  showSectionLabel: false,
};

export interface OutputTransitionSettings {
  type: OutputTransitionType;
  durationMs: number;
  easing: OutputTransitionEasing;
  direction: OutputTransitionDirection;
}

export interface OutputStateTransitionSettings {
  black: OutputTransitionSettings;
  clear: OutputTransitionSettings;
}

export interface OutputSongDisplaySettings {
  fontFamily: OutputStyleOverrideMode<string>;
  scale: OutputStyleOverrideMode<number>;
  color: OutputStyleOverrideMode<string>;
  shadow: OutputStyleOverrideMode<boolean>;
}

/**
 * @deprecated Persisted only for backward compatibility. Scripture visuals are
 * resolved from `contentRules.scripture` and Scripture Content Themes.
 */
export interface OutputScriptureSettings {
  mode: 'inherit' | 'override';
  showReference: boolean;
  showVerseNumbers: boolean;
  showVersionCode: boolean;
  textAlign: 'left' | 'center' | 'right';
  fontFamily: string;
  textScale: number;
  textColor: string;
  referenceColor: string;
  backgroundColor: string;
}

export interface OutputPresentationSettings {
  mediaFit: 'contain' | 'cover' | 'fill';
  textScale: number;
  backgroundColor: string;
  showAnnotations: boolean;
}

export interface OutputAlertSettings {
  enabled: boolean;
  source: 'slide-notes';
  position: 'top' | 'bottom';
  durationMs: number;
  backgroundColor: string;
  textColor: string;
}

export interface ScreenLayoutContentRule {
  policy: ContentThemePolicy;
  themeId: string | null;
  themeName: string | null;
  themeLayersData: string | null;
}

export type ScreenLayoutContentRules = Record<ContentThemeType, ScreenLayoutContentRule>;

export interface OutputWidgetLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OutputWidgetStyle {
  label: string;
  fontFamily: string;
  scale: number;
  color: string;
  shadow: boolean;
  textAlign: 'left' | 'center' | 'right';
  backgroundColor: string;
  backgroundOpacity: number;
  borderVisible: boolean;
  showLabel?: boolean;
  sizingMode?: 'responsive' | 'fixed';
  fontSizePx?: number;
  maxLines?: number;
  overflow?: 'clip' | 'ellipsis';
  contentScope?: 'any' | 'song';
}

/**
 * A reusable screen composition. The persisted key remains `outputPresets`
 * so existing installations can migrate without losing saved layouts.
 */
export interface ScreenLayoutPreset {
  id: string;
  builtinRevision?: number;
  thumbnail?: string | null;
  thumbnailSignature?: string | null;
  name: string;
  role: ScreenProfileId;
  purpose: 'audience' | 'stage' | 'confidence' | 'broadcast' | 'custom';
  renderMode: OutputRenderMode;
  canvasBackground: 'opaque' | 'transparent';
  layoutType: OutputLayoutType;
  contentRules: ScreenLayoutContentRules;
  transitionSettings: OutputTransitionSettings;
  stateTransitionSettings: OutputStateTransitionSettings;
  songDisplaySettings: OutputSongDisplaySettings;
  /** @deprecated See OutputScriptureSettings. */
  scriptureSettings: OutputScriptureSettings;
  presentationSettings: OutputPresentationSettings;
  alertSettings: OutputAlertSettings;
  widgets: OutputWidgetId[];
  widgetLayouts: Record<OutputWidgetId, OutputWidgetLayout>;
  widgetStyles: Record<OutputWidgetId, OutputWidgetStyle>;
}

/** @deprecated Use ScreenLayoutPreset in new code. */
export type OutputPreset = ScreenLayoutPreset;

export interface OutputChannel {
  id: string;
  name: string;
  enabled: boolean;
  isPrimary: boolean;
  role: ScreenProfileId;
  targetType: OutputTargetType;
  targetDisplayId: string | null;
  browserClientId: string | null;
  autoFullscreen: boolean;
  autoOpenOnGoLive: boolean;
  songPresetMode: 'original' | 'force';
  forcedSongPresetId: string | null;
  contentRules: ScreenLayoutContentRules;
  outputPresetId: string | null;
  renderMode: OutputRenderMode;
  canvasBackground: 'opaque' | 'transparent';
  layoutType: OutputLayoutType;
  transitionSettings: OutputTransitionSettings;
  stateTransitionSettings: OutputStateTransitionSettings;
  songDisplaySettings: OutputSongDisplaySettings;
  /** @deprecated See OutputScriptureSettings. */
  scriptureSettings: OutputScriptureSettings;
  presentationSettings: OutputPresentationSettings;
  alertSettings: OutputAlertSettings;
  widgets: OutputWidgetId[];
  widgetLayouts: Record<OutputWidgetId, OutputWidgetLayout>;
  widgetStyles: Record<OutputWidgetId, OutputWidgetStyle>;
  ndiConfig: NdiOutputConfig;
}

export interface AiFormattingSettings {
  maxCharsPerLine: number;
  maxLinesPerSlide: number;
  autoFixTypos: boolean;
}

export const DEFAULT_AI_FORMATTING_SETTINGS: AiFormattingSettings = {
  maxCharsPerLine: 40,
  maxLinesPerSlide: 4,
  autoFixTypos: true,
};

export interface PersistedOutputSettings {
  locale: LocaleCode;
  outputWidth: number;
  outputHeight: number;
  appTheme: 'dark' | 'light';
  primaryColor: string;
  aspectRatioMode: AspectRatioMode;
  targetDisplayId: string | null;
  autoFullscreen: boolean;
  autoOpenOnGoLive: boolean;
  showSafeArea: boolean;
  safeAreaPercent: number;
  fallbackBehavior: 'primary-display';
  defaultSongPresetId: string | null;
  defaultBibleContentThemeId: string | null;
  defaultBibleContentThemeName: string | null;
  defaultBibleContentThemeLayersData: string | null;
  bibleBrainApiKey: string | null;
  defaultSongStyle?: DefaultSongStyle;
  bibleTemplate: BiblePresentationStyle;
  defaultSongPresetsByRole: SongPresetDefaultsByRole;
  outputs: OutputChannel[];
  outputPresets: OutputPreset[];
  browserClients: BrowserOutputClient[];
  logoOutput: LogoOutputSettings;
  aiFormatting: AiFormattingSettings;
}

export const DEFAULT_SONG_PRESETS_BY_ROLE: SongPresetDefaultsByRole = {
  audience: null,
  singer: null,
  'worship-leader': null,
  confidence: null,
};

export const DEFAULT_LOGO_OUTPUT_SETTINGS: LogoOutputSettings = {
  mediaId: null,
  filename: null,
  mediaType: null,
  source: null,
  thumbnail: null,
  fit: 'contain',
  loop: true,
};

export const DEFAULT_OUTPUT_TRANSITION_SETTINGS: OutputTransitionSettings = {
  type: 'blend',
  durationMs: 220,
  easing: 'easeOut',
  direction: 'left',
};

export const DEFAULT_OUTPUT_STATE_TRANSITION_SETTINGS: OutputStateTransitionSettings = {
  black: { type: 'blend', durationMs: 300, easing: 'easeOut', direction: 'left' },
  clear: { type: 'blend', durationMs: 220, easing: 'easeOut', direction: 'left' },
};

export const DEFAULT_OUTPUT_SONG_DISPLAY_SETTINGS: OutputSongDisplaySettings = {
  fontFamily: { mode: 'inherit', value: null },
  scale: { mode: 'inherit', value: null },
  color: { mode: 'inherit', value: null },
  shadow: { mode: 'inherit', value: null },
};

export const DEFAULT_OUTPUT_SCRIPTURE_SETTINGS: OutputScriptureSettings = {
  mode: 'inherit',
  showReference: true,
  showVerseNumbers: true,
  showVersionCode: true,
  textAlign: 'center',
  fontFamily: 'Manrope, Inter, sans-serif',
  textScale: 1,
  textColor: '#ffffff',
  referenceColor: '#facc15',
  backgroundColor: '#05070a',
};

export const DEFAULT_OUTPUT_PRESENTATION_SETTINGS: OutputPresentationSettings = {
  mediaFit: 'contain',
  textScale: 1,
  backgroundColor: '#000000',
  showAnnotations: true,
};

export const DEFAULT_OUTPUT_ALERT_SETTINGS: OutputAlertSettings = {
  enabled: false,
  source: 'slide-notes',
  position: 'top',
  durationMs: 5000,
  backgroundColor: '#b45309',
  textColor: '#ffffff',
};

export const DEFAULT_SCREEN_LAYOUT_CONTENT_RULES: ScreenLayoutContentRules = {
  song: { policy: 'follow', themeId: null, themeName: null, themeLayersData: null },
  scripture: { policy: 'follow', themeId: null, themeName: null, themeLayersData: null },
  presentation: { policy: 'follow', themeId: null, themeName: null, themeLayersData: null },
  media: { policy: 'follow', themeId: null, themeName: null, themeLayersData: null },
};

export const DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT: Record<OutputLayoutType, OutputWidgetId[]> = {
  'audience-default': ['slideCanvas'],
  'worship-leader-foldback': ['sectionLabel', 'clock', 'currentLyrics', 'nextLyrics', 'previousLyrics', 'notes', 'timer', 'showName', 'progress', 'videoCountdown'],
  'singer-confidence': ['sectionLabel', 'clock', 'currentLyrics', 'nextLyrics', 'showName', 'progress', 'videoCountdown'],
  'minimal-lyrics': ['currentLyrics', 'logo'],
};

export const DEFAULT_OUTPUT_WIDGET_LAYOUTS: Record<OutputWidgetId, OutputWidgetLayout> = {
  slideCanvas: { x: 0, y: 0, width: 100, height: 100 },
  currentLyrics: { x: 5, y: 12, width: 60, height: 53 },
  nextLyrics: { x: 5, y: 70, width: 45, height: 25 },
  previousLyrics: { x: 66, y: 50, width: 29, height: 20 },
  notes: { x: 66, y: 73, width: 29, height: 15 },
  sectionLabel: { x: 5, y: 2, width: 24, height: 8 },
  clock: { x: 68, y: 5, width: 27, height: 16 },
  timer: { x: 68, y: 25, width: 27, height: 24 },
  videoCountdown: { x: 68, y: 52, width: 27, height: 13 },
  showName: { x: 53, y: 70, width: 25, height: 25 },
  progress: { x: 80, y: 70, width: 15, height: 25 },
  logo: { x: 84, y: 4, width: 12, height: 12 },
  alert: { x: 15, y: 6, width: 70, height: 14 },
};

export const DEFAULT_OUTPUT_WIDGET_STYLES: Record<OutputWidgetId, OutputWidgetStyle> = {
  slideCanvas: {
    label: 'Slide canvas',
    fontFamily: 'Manrope, sans-serif',
    scale: 1,
    color: '#ffffff',
    shadow: false,
    textAlign: 'center',
    backgroundColor: '#05070a',
    backgroundOpacity: 1,
    borderVisible: false,
  },
  currentLyrics: {
    label: 'Current',
    fontFamily: 'Manrope, Inter, sans-serif',
    scale: 1,
    color: '#ffffff',
    shadow: true,
    textAlign: 'left',
    backgroundColor: '#000000',
    backgroundOpacity: 0.18,
    borderVisible: true,
  },
  nextLyrics: {
    label: 'Next',
    fontFamily: 'Manrope, Inter, sans-serif',
    scale: 0.72,
    color: '#dbeafe',
    shadow: true,
    textAlign: 'left',
    backgroundColor: '#000000',
    backgroundOpacity: 0.18,
    borderVisible: true,
  },
  previousLyrics: {
    label: 'Previous',
    fontFamily: 'Manrope, Inter, sans-serif',
    scale: 0.62,
    color: '#94a3b8',
    shadow: false,
    textAlign: 'left',
    backgroundColor: '#000000',
    backgroundOpacity: 0.14,
    borderVisible: true,
  },
  notes: {
    label: 'Notes',
    fontFamily: 'Manrope, Inter, sans-serif',
    scale: 0.72,
    color: '#fef3c7',
    shadow: false,
    textAlign: 'left',
    backgroundColor: '#000000',
    backgroundOpacity: 0.18,
    borderVisible: true,
  },
  sectionLabel: {
    label: 'Section',
    fontFamily: 'Manrope, Inter, sans-serif',
    scale: 0.72,
    color: '#ffffff',
    shadow: false,
    textAlign: 'left',
    backgroundColor: '#000000',
    backgroundOpacity: 0.12,
    borderVisible: true,
  },
  clock: {
    label: 'Clock',
    fontFamily: 'monospace',
    scale: 0.82,
    color: '#ffffff',
    shadow: false,
    textAlign: 'right',
    backgroundColor: '#000000',
    backgroundOpacity: 0.12,
    borderVisible: true,
  },
  timer: {
    label: 'Timer',
    fontFamily: 'monospace',
    scale: 0.82,
    color: '#ffffff',
    shadow: false,
    textAlign: 'right',
    backgroundColor: '#000000',
    backgroundOpacity: 0.12,
    borderVisible: true,
  },
  videoCountdown: {
    label: 'Video countdown',
    fontFamily: 'monospace',
    scale: 0.82,
    color: '#f59e0b',
    shadow: false,
    textAlign: 'center',
    backgroundColor: '#000000',
    backgroundOpacity: 0.18,
    borderVisible: true,
  },
  showName: {
    label: 'Show name',
    fontFamily: 'Manrope, Inter, sans-serif',
    scale: 0.82,
    color: '#ffffff',
    shadow: false,
    textAlign: 'center',
    backgroundColor: '#000000',
    backgroundOpacity: 0.18,
    borderVisible: true,
  },
  progress: {
    label: 'Progress',
    fontFamily: 'monospace',
    scale: 0.92,
    color: '#ec4899',
    shadow: false,
    textAlign: 'center',
    backgroundColor: '#000000',
    backgroundOpacity: 0.18,
    borderVisible: true,
  },
  logo: {
    label: 'Logo',
    fontFamily: 'Manrope, sans-serif',
    scale: 1,
    color: '#ffffff',
    shadow: false,
    textAlign: 'center',
    backgroundColor: '#000000',
    backgroundOpacity: 0,
    borderVisible: false,
  },
  alert: {
    label: 'Alert',
    fontFamily: 'Manrope, sans-serif',
    scale: 0.8,
    color: '#ffffff',
    shadow: true,
    textAlign: 'center',
    backgroundColor: '#b45309',
    backgroundOpacity: 0.92,
    borderVisible: false,
  },
};

export const DEFAULT_OUTPUT_PRESET_IDS = {
  audience: 'preset-audience-default',
  worshipLeader: 'preset-worship-leader-foldback',
  singer: 'preset-singer-confidence',
  minimalLyrics: 'preset-minimal-lyrics',
  stageDetailed: 'preset-stage-detailed',
  broadcast: 'preset-broadcast-hybrid',
  ndiLyricsFixed: 'preset-ndi-lyrics-overlay-fixed',
} as const;

export const BUILTIN_SCREEN_LAYOUT_REVISION = 2;

export function getDefaultLayoutTypeForRole(role: ScreenProfileId): OutputLayoutType {
  if (role === 'worship-leader') return 'worship-leader-foldback';
  if (role === 'singer' || role === 'confidence') return 'singer-confidence';
  return 'audience-default';
}

export function getDefaultRenderModeForRole(role: ScreenProfileId): OutputRenderMode {
  return role === 'audience' ? 'follow-slide' : 'custom-layout';
}

export function getDefaultOutputPresetIdForRole(role: ScreenProfileId) {
  if (role === 'worship-leader') return DEFAULT_OUTPUT_PRESET_IDS.worshipLeader;
  if (role === 'singer' || role === 'confidence') return DEFAULT_OUTPUT_PRESET_IDS.singer;
  return DEFAULT_OUTPUT_PRESET_IDS.audience;
}

export function createDefaultOutputPreset(overrides: Partial<OutputPreset> = {}): OutputPreset {
  const role = overrides.role && isScreenProfileId(overrides.role) ? overrides.role : DEFAULT_SCREEN_PROFILE_ID;
  const layoutType = sanitizeOutputLayoutType(overrides.layoutType, getDefaultLayoutTypeForRole(role));
  return {
    id: overrides.id || generateOutputId(),
    builtinRevision: Number.isFinite(Number(overrides.builtinRevision)) ? Number(overrides.builtinRevision) : undefined,
    thumbnail: overrides.thumbnail ? String(overrides.thumbnail) : null,
    thumbnailSignature: overrides.thumbnailSignature ? String(overrides.thumbnailSignature) : null,
    name: overrides.name || 'Screen Layout',
    role,
    purpose: sanitizeScreenLayoutPurpose(overrides.purpose, role),
    renderMode: sanitizeOutputRenderMode(overrides.renderMode, getDefaultRenderModeForRole(role)),
    canvasBackground: overrides.canvasBackground === 'transparent' ? 'transparent' : 'opaque',
    layoutType,
    contentRules: sanitizeScreenLayoutContentRules(overrides.contentRules),
    transitionSettings: sanitizeOutputTransitionSettings(overrides.transitionSettings),
    stateTransitionSettings: sanitizeOutputStateTransitionSettings(overrides.stateTransitionSettings),
    songDisplaySettings: sanitizeOutputSongDisplaySettings(overrides.songDisplaySettings),
    scriptureSettings: sanitizeOutputScriptureSettings(overrides.scriptureSettings),
    presentationSettings: sanitizeOutputPresentationSettings(overrides.presentationSettings),
    alertSettings: sanitizeOutputAlertSettings(overrides.alertSettings),
    widgets: sanitizeOutputWidgets(overrides.widgets, layoutType),
    widgetLayouts: sanitizeOutputWidgetLayouts(overrides.widgetLayouts),
    widgetStyles: sanitizeOutputWidgetStyles(overrides.widgetStyles),
  };
}

export function createBuiltinOutputPresets(): OutputPreset[] {
  return [
    createDefaultOutputPreset({
      id: DEFAULT_OUTPUT_PRESET_IDS.audience,
      builtinRevision: BUILTIN_SCREEN_LAYOUT_REVISION,
      name: 'Main Screen',
      role: 'audience',
      renderMode: 'follow-slide',
      layoutType: 'audience-default',
      widgets: DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT['audience-default'],
    }),
    createDefaultOutputPreset({
      id: DEFAULT_OUTPUT_PRESET_IDS.worshipLeader,
      builtinRevision: BUILTIN_SCREEN_LAYOUT_REVISION,
      name: 'Worship Leader Foldback',
      role: 'worship-leader',
      renderMode: 'custom-layout',
      layoutType: 'worship-leader-foldback',
      widgets: DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT['worship-leader-foldback'],
      transitionSettings: { type: 'none', durationMs: 0, easing: 'easeOut', direction: 'left' },
    }),
    createDefaultOutputPreset({
      id: DEFAULT_OUTPUT_PRESET_IDS.singer,
      builtinRevision: BUILTIN_SCREEN_LAYOUT_REVISION,
      name: 'Singer Confidence',
      role: 'singer',
      renderMode: 'custom-layout',
      layoutType: 'singer-confidence',
      widgets: DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT['singer-confidence'],
      transitionSettings: { type: 'none', durationMs: 0, easing: 'easeOut', direction: 'left' },
    }),
    createDefaultOutputPreset({
      id: DEFAULT_OUTPUT_PRESET_IDS.minimalLyrics,
      builtinRevision: BUILTIN_SCREEN_LAYOUT_REVISION,
      name: 'Minimal Lyrics',
      role: 'audience',
      renderMode: 'custom-layout',
      layoutType: 'minimal-lyrics',
      widgets: DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT['minimal-lyrics'],
    }),
    createDefaultOutputPreset({
      id: DEFAULT_OUTPUT_PRESET_IDS.stageDetailed,
      builtinRevision: BUILTIN_SCREEN_LAYOUT_REVISION,
      name: 'Stage Display Detailed',
      role: 'confidence',
      renderMode: 'custom-layout',
      layoutType: 'singer-confidence',
      widgets: ['currentLyrics', 'nextLyrics', 'previousLyrics', 'sectionLabel', 'notes', 'clock', 'timer', 'videoCountdown', 'showName', 'progress'],
      transitionSettings: { type: 'none', durationMs: 0, easing: 'easeOut', direction: 'left' },
      widgetLayouts: {
        ...DEFAULT_OUTPUT_WIDGET_LAYOUTS,
        currentLyrics: { x: 3, y: 12, width: 62, height: 53 },
        nextLyrics: { x: 3, y: 70, width: 46, height: 26 },
        previousLyrics: { x: 66, y: 50, width: 29, height: 20 },
        notes: { x: 66, y: 73, width: 29, height: 15 },
        sectionLabel: { x: 3, y: 2, width: 24, height: 8 },
        clock: { x: 68, y: 3, width: 29, height: 18 },
        timer: { x: 68, y: 24, width: 29, height: 26 },
        videoCountdown: { x: 68, y: 53, width: 29, height: 14 },
        showName: { x: 51, y: 70, width: 26, height: 26 },
        progress: { x: 79, y: 70, width: 18, height: 26 },
      },
    }),
    createDefaultOutputPreset({
      id: DEFAULT_OUTPUT_PRESET_IDS.broadcast,
      builtinRevision: BUILTIN_SCREEN_LAYOUT_REVISION,
      name: 'Broadcast Hybrid',
      role: 'audience',
      purpose: 'broadcast',
      renderMode: 'custom-layout',
      layoutType: 'minimal-lyrics',
      widgets: ['slideCanvas', 'currentLyrics', 'logo', 'alert'],
      widgetLayouts: {
        ...DEFAULT_OUTPUT_WIDGET_LAYOUTS,
        slideCanvas: { x: 0, y: 0, width: 100, height: 100 },
        currentLyrics: { x: 6, y: 70, width: 76, height: 24 },
        logo: { x: 85, y: 5, width: 10, height: 12 },
        alert: { x: 18, y: 6, width: 64, height: 12 },
      },
    }),
    createDefaultOutputPreset({
      id: DEFAULT_OUTPUT_PRESET_IDS.ndiLyricsFixed,
      builtinRevision: BUILTIN_SCREEN_LAYOUT_REVISION,
      name: 'NDI Lyrics Overlay — Fixed',
      role: 'audience',
      purpose: 'broadcast',
      renderMode: 'custom-layout',
      canvasBackground: 'transparent',
      layoutType: 'minimal-lyrics',
      widgets: ['currentLyrics'],
      transitionSettings: { type: 'blend', durationMs: 180, easing: 'easeOut', direction: 'left' },
      alertSettings: { ...DEFAULT_OUTPUT_ALERT_SETTINGS, enabled: false },
      widgetLayouts: {
        ...DEFAULT_OUTPUT_WIDGET_LAYOUTS,
        currentLyrics: { x: 5, y: 72, width: 90, height: 20 },
      },
      widgetStyles: {
        ...DEFAULT_OUTPUT_WIDGET_STYLES,
        currentLyrics: {
          ...DEFAULT_OUTPUT_WIDGET_STYLES.currentLyrics,
          label: 'Lyrics',
          fontFamily: 'Manrope, Inter, sans-serif',
          color: '#ffffff',
          shadow: true,
          textAlign: 'center',
          backgroundColor: '#000000',
          backgroundOpacity: 0,
          borderVisible: false,
          showLabel: false,
          sizingMode: 'fixed',
          fontSizePx: 64,
          maxLines: 2,
          overflow: 'clip',
          contentScope: 'song',
        },
      },
    }),
  ];
}

export const DEFAULT_OUTPUT_SETTINGS: PersistedOutputSettings = {
  locale: 'id',
  outputWidth: 1920,
  outputHeight: 1080,
  appTheme: 'dark',
  primaryColor: '#f59e0b',
  aspectRatioMode: '16:9',
  targetDisplayId: null,
  autoFullscreen: true,
  autoOpenOnGoLive: true,
  showSafeArea: false,
  safeAreaPercent: 8,
  fallbackBehavior: 'primary-display',
  defaultSongPresetId: null,
  defaultBibleContentThemeId: null,
  defaultBibleContentThemeName: null,
  defaultBibleContentThemeLayersData: null,
  bibleBrainApiKey: null,
  defaultSongPresetsByRole: DEFAULT_SONG_PRESETS_BY_ROLE,
  outputs: [createDefaultOutputChannel({ locale: 'id' })],
  outputPresets: createBuiltinOutputPresets(),
  browserClients: [],
  logoOutput: DEFAULT_LOGO_OUTPUT_SETTINGS,
  aiFormatting: DEFAULT_AI_FORMATTING_SETTINGS,
  bibleTemplate: {
    layoutMode: 'fullscreen',
    backgroundMode: 'solid',
    backgroundColor: '#05070A',
    overlayOpacity: 0.44,
    textAlign: 'center',
    verticalAlign: 'middle',
    showReference: true,
    referencePosition: 'bottom',
    referenceAlign: 'right',
    showVerseNumbers: true,
    showVersionCode: true,
    showSectionTitle: false,
    sectionDisplay: 'inline',
    textColor: '#FFFFFF',
    referenceColor: '#FACC15',
    versionColor: '#CBD5E1',
    sectionColor: '#93C5FD',
    fontFamily: 'Manrope, Inter, sans-serif',
    textScale: 1,
    referenceScale: 1,
    referenceX: null,
    referenceY: null,
    autoResizeMode: 'off',
    maxVersesPerSlide: null,
    contentX: 50,
    contentY: 56,
    contentWidth: 84,
    contentHeight: 52,
  },
  defaultSongStyle: {
    x: 50,
    y: 50,
    textAlign: 'center',
    boxWidth: 80,
    boxHeight: 40,
    fontFamily: 'SF Pro Text, Inter, sans-serif',
    fontWeight: 600,
    fontStyle: 'normal',
    textDecoration: 'none',
    color: '#ffffff',
    shadow: true,
    scale: 1.0,
    allowWrap: true,
    backgroundMode: 'solid',
    backgroundColor: '#000000',
    backgroundMediaId: null,
  },
};

function generateOutputId() {
  return globalThis.crypto?.randomUUID?.() ?? `output-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function generatePairingCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function getDefaultNdiSourceName(locale: LocaleCode, index: number) {
  if (index <= 1) {
    return locale === 'id' ? 'RAMEDIA Output' : 'RAMEDIA Output';
  }
  return `RAMEDIA Output ${index}`;
}

export function getDefaultOutputName(locale: LocaleCode, index: number) {
  if (index <= 1) {
    return locale === 'id' ? 'Output Utama' : 'Main Output';
  }
  return `Output ${index}`;
}

export function getDefaultBrowserClientName(_locale: LocaleCode, index: number) {
  return index <= 1 ? 'Browser Client' : `Browser Client ${index}`;
}

export function createDefaultOutputChannel(
  overrides: Partial<OutputChannel> & { locale?: LocaleCode; defaultSongPresetId?: string | null } = {},
): OutputChannel {
  const locale = overrides.locale ?? 'id';
  const role = overrides.role && isScreenProfileId(overrides.role) ? overrides.role : DEFAULT_SCREEN_PROFILE_ID;
  const layoutType = sanitizeOutputLayoutType(overrides.layoutType, getDefaultLayoutTypeForRole(role));
  return {
    id: overrides.id || generateOutputId(),
    name: overrides.name || getDefaultOutputName(locale, 1),
    enabled: overrides.enabled ?? true,
    isPrimary: overrides.isPrimary ?? true,
    role,
    targetType:
      overrides.targetType === 'browser-client'
        ? 'browser-client'
        : overrides.targetType === 'ndi'
          ? 'ndi'
          : 'electron-display',
    targetDisplayId: overrides.targetDisplayId ? String(overrides.targetDisplayId) : null,
    browserClientId: overrides.browserClientId ? String(overrides.browserClientId) : null,
    autoFullscreen: overrides.autoFullscreen ?? true,
    autoOpenOnGoLive: overrides.autoOpenOnGoLive ?? true,
    songPresetMode: overrides.songPresetMode === 'force' ? 'force' : 'original',
    forcedSongPresetId: overrides.forcedSongPresetId
      ? String(overrides.forcedSongPresetId)
      : overrides.defaultSongPresetId
        ? String(overrides.defaultSongPresetId)
        : null,
    contentRules: sanitizeScreenLayoutContentRules(overrides.contentRules),
    outputPresetId: overrides.outputPresetId ? String(overrides.outputPresetId) : getDefaultOutputPresetIdForRole(role),
    renderMode: sanitizeOutputRenderMode(overrides.renderMode, getDefaultRenderModeForRole(role)),
    canvasBackground: overrides.canvasBackground === 'transparent' ? 'transparent' : 'opaque',
    layoutType,
    transitionSettings: sanitizeOutputTransitionSettings(overrides.transitionSettings),
    stateTransitionSettings: sanitizeOutputStateTransitionSettings(overrides.stateTransitionSettings),
    songDisplaySettings: sanitizeOutputSongDisplaySettings(overrides.songDisplaySettings),
    scriptureSettings: sanitizeOutputScriptureSettings(overrides.scriptureSettings),
    presentationSettings: sanitizeOutputPresentationSettings(overrides.presentationSettings),
    alertSettings: sanitizeOutputAlertSettings(overrides.alertSettings),
    widgets: sanitizeOutputWidgets(overrides.widgets, layoutType),
    widgetLayouts: sanitizeOutputWidgetLayouts(overrides.widgetLayouts),
    widgetStyles: sanitizeOutputWidgetStyles(overrides.widgetStyles),
    ndiConfig: {
      sourceName: overrides.ndiConfig?.sourceName || getDefaultNdiSourceName(locale, 1),
      resolution: overrides.ndiConfig?.resolution === '720p' ? '720p' : '1080p',
      fps: overrides.ndiConfig?.fps === 60 ? 60 : 30,
      includeAudio: !!overrides.ndiConfig?.includeAudio,
      alphaEnabled: !!overrides.ndiConfig?.alphaEnabled,
      contentMode: overrides.ndiConfig?.contentMode === 'broadcast-lyrics' ? 'broadcast-lyrics' : 'full-output',
      lyricsOverlay: sanitizeBroadcastLyricsSettings(overrides.ndiConfig?.lyricsOverlay),
    },
  };
}

function sanitizeBroadcastLyricsSettings(value: unknown): BroadcastLyricsSettings {
  const source = value && typeof value === 'object' ? value as Partial<BroadcastLyricsSettings> : {};
  const number = (input: unknown, fallback: number, min: number, max: number) => {
    const parsed = Number(input);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
  };
  return {
    x: number(source.x, DEFAULT_BROADCAST_LYRICS_SETTINGS.x, 0, 100),
    y: number(source.y, DEFAULT_BROADCAST_LYRICS_SETTINGS.y, 0, 100),
    width: number(source.width, DEFAULT_BROADCAST_LYRICS_SETTINGS.width, 5, 100),
    height: number(source.height, DEFAULT_BROADCAST_LYRICS_SETTINGS.height, 5, 100),
    padding: number(source.padding, DEFAULT_BROADCAST_LYRICS_SETTINGS.padding, 0, 12),
    minFontSize: number(source.minFontSize, DEFAULT_BROADCAST_LYRICS_SETTINGS.minFontSize, 8, 160),
    maxFontSize: number(source.maxFontSize, DEFAULT_BROADCAST_LYRICS_SETTINGS.maxFontSize, 12, 240),
    maxLines: Math.round(number(source.maxLines, DEFAULT_BROADCAST_LYRICS_SETTINGS.maxLines, 1, 12)),
    fontFamily: source.fontFamily ? String(source.fontFamily) : DEFAULT_BROADCAST_LYRICS_SETTINGS.fontFamily,
    fontWeight: Math.round(number(source.fontWeight, DEFAULT_BROADCAST_LYRICS_SETTINGS.fontWeight, 100, 900) / 100) * 100,
    color: source.color ? String(source.color) : DEFAULT_BROADCAST_LYRICS_SETTINGS.color,
    textAlign: source.textAlign === 'left' || source.textAlign === 'right' ? source.textAlign : 'center',
    verticalAlign: source.verticalAlign === 'top' || source.verticalAlign === 'bottom' ? source.verticalAlign : 'middle',
    outlineSize: number(source.outlineSize, DEFAULT_BROADCAST_LYRICS_SETTINGS.outlineSize, 0, 12),
    outlineColor: source.outlineColor ? String(source.outlineColor) : DEFAULT_BROADCAST_LYRICS_SETTINGS.outlineColor,
    shadow: source.shadow ?? DEFAULT_BROADCAST_LYRICS_SETTINGS.shadow,
    showSectionLabel: source.showSectionLabel ?? DEFAULT_BROADCAST_LYRICS_SETTINGS.showSectionLabel,
  };
}

function sanitizeOutputRenderMode(value: unknown, fallback: OutputRenderMode): OutputRenderMode {
  return value === 'custom-layout' || value === 'follow-slide' ? value : fallback;
}

function sanitizeOutputLayoutType(value: unknown, fallback: OutputLayoutType): OutputLayoutType {
  return (
    value === 'audience-default' ||
    value === 'worship-leader-foldback' ||
    value === 'singer-confidence' ||
    value === 'minimal-lyrics'
  ) ? value : fallback;
}

function sanitizeScreenLayoutPurpose(value: unknown, role: ScreenProfileId): ScreenLayoutPreset['purpose'] {
  if (value === 'audience' || value === 'stage' || value === 'confidence' || value === 'broadcast' || value === 'custom') return value;
  if (role === 'audience') return 'audience';
  if (role === 'singer' || role === 'confidence') return 'confidence';
  return 'stage';
}

function sanitizeScreenLayoutContentRules(value: unknown): ScreenLayoutContentRules {
  const source = value && typeof value === 'object' ? value as Partial<Record<ContentThemeType, Partial<ScreenLayoutContentRule>>> : {};
  const next = { ...DEFAULT_SCREEN_LAYOUT_CONTENT_RULES } as ScreenLayoutContentRules;
  (Object.keys(next) as ContentThemeType[]).forEach((contentType) => {
    const raw = source[contentType];
    const policy: ContentThemePolicy = raw?.policy === 'fallback' || raw?.policy === 'force' ? raw.policy : 'follow';
    next[contentType] = {
      policy,
      themeId: raw?.themeId ? String(raw.themeId) : null,
      themeName: raw?.themeName ? String(raw.themeName) : null,
      themeLayersData: typeof raw?.themeLayersData === 'string' ? raw.themeLayersData : null,
    };
  });
  return next;
}

function sanitizeOutputTransitionSettings(value: unknown): OutputTransitionSettings {
  const source = value && typeof value === 'object' ? value as Partial<OutputTransitionSettings> : {};
  const allowedTypes = new Set<OutputTransitionType>([
    'blend', 'cover', 'cube', 'drop', 'iris', 'page-flip', 'push', 'reveal', 'zoom', 'none', 'fade', 'slide',
  ]);
  const migratedType = source.type === 'fade' ? 'blend' : source.type === 'slide' ? 'push' : source.type;
  const type = allowedTypes.has(migratedType as OutputTransitionType)
    ? migratedType as OutputTransitionType
    : DEFAULT_OUTPUT_TRANSITION_SETTINGS.type;
  const durationMs = Number(source.durationMs);
  const easing: OutputTransitionEasing =
    source.easing === 'easeInOut' || source.easing === 'linear' || source.easing === 'easeOut'
      ? source.easing
      : DEFAULT_OUTPUT_TRANSITION_SETTINGS.easing;
  const direction: OutputTransitionDirection =
    source.direction === 'right' || source.direction === 'up' || source.direction === 'down' || source.direction === 'left'
      ? source.direction
      : DEFAULT_OUTPUT_TRANSITION_SETTINGS.direction;

  return {
    type,
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.min(3000, Math.round(durationMs))) : DEFAULT_OUTPUT_TRANSITION_SETTINGS.durationMs,
    easing,
    direction,
  };
}

function sanitizeOutputStateTransitionSettings(value: unknown): OutputStateTransitionSettings {
  const source = value && typeof value === 'object' ? value as Partial<OutputStateTransitionSettings> : {};
  return {
    black: sanitizeOutputTransitionSettings(source.black || DEFAULT_OUTPUT_STATE_TRANSITION_SETTINGS.black),
    clear: sanitizeOutputTransitionSettings(source.clear || DEFAULT_OUTPUT_STATE_TRANSITION_SETTINGS.clear),
  };
}

function sanitizeStyleOverride<T>(
  raw: unknown,
  coerceValue: (value: unknown) => T | null,
): OutputStyleOverrideMode<T> {
  if (!raw || typeof raw !== 'object') return { mode: 'inherit', value: null };
  const source = raw as { mode?: unknown; value?: unknown };
  const value = coerceValue(source.value);
  if (source.mode !== 'override' || value === null) return { mode: 'inherit', value: null };
  return { mode: 'override', value };
}

function sanitizeOutputSongDisplaySettings(value: unknown): OutputSongDisplaySettings {
  const source = value && typeof value === 'object' ? value as Partial<OutputSongDisplaySettings> : {};
  return {
    fontFamily: sanitizeStyleOverride(source.fontFamily, (next) => typeof next === 'string' && next.trim().length > 0 ? next : null),
    scale: sanitizeStyleOverride(source.scale, (next) => {
      const numeric = Number(next);
      return Number.isFinite(numeric) && numeric > 0 ? Math.max(0.4, Math.min(3, numeric)) : null;
    }),
    color: sanitizeStyleOverride(source.color, (next) => typeof next === 'string' && /^#[0-9a-f]{6}$/i.test(next) ? next : null),
    shadow: sanitizeStyleOverride(source.shadow, (next) => typeof next === 'boolean' ? next : null),
  };
}

function sanitizeHexColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

function sanitizeOutputScriptureSettings(value: unknown): OutputScriptureSettings {
  const source = value && typeof value === 'object' ? value as Partial<OutputScriptureSettings> : {};
  const scale = Number(source.textScale);
  return {
    mode: source.mode === 'override' ? 'override' : 'inherit',
    showReference: source.showReference ?? DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.showReference,
    showVerseNumbers: source.showVerseNumbers ?? DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.showVerseNumbers,
    showVersionCode: source.showVersionCode ?? DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.showVersionCode,
    textAlign: source.textAlign === 'left' || source.textAlign === 'right' ? source.textAlign : 'center',
    fontFamily: typeof source.fontFamily === 'string' && source.fontFamily.trim() ? source.fontFamily : DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.fontFamily,
    textScale: Number.isFinite(scale) ? Math.max(0.5, Math.min(2, scale)) : DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.textScale,
    textColor: sanitizeHexColor(source.textColor, DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.textColor),
    referenceColor: sanitizeHexColor(source.referenceColor, DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.referenceColor),
    backgroundColor: sanitizeHexColor(source.backgroundColor, DEFAULT_OUTPUT_SCRIPTURE_SETTINGS.backgroundColor),
  };
}

function sanitizeOutputPresentationSettings(value: unknown): OutputPresentationSettings {
  const source = value && typeof value === 'object' ? value as Partial<OutputPresentationSettings> : {};
  const scale = Number(source.textScale);
  return {
    mediaFit: source.mediaFit === 'cover' || source.mediaFit === 'fill' ? source.mediaFit : 'contain',
    textScale: Number.isFinite(scale) ? Math.max(0.5, Math.min(2, scale)) : DEFAULT_OUTPUT_PRESENTATION_SETTINGS.textScale,
    backgroundColor: sanitizeHexColor(source.backgroundColor, DEFAULT_OUTPUT_PRESENTATION_SETTINGS.backgroundColor),
    showAnnotations: source.showAnnotations ?? DEFAULT_OUTPUT_PRESENTATION_SETTINGS.showAnnotations,
  };
}

function sanitizeOutputAlertSettings(value: unknown): OutputAlertSettings {
  const source = value && typeof value === 'object' ? value as Partial<OutputAlertSettings> : {};
  const durationMs = Number(source.durationMs);
  return {
    enabled: source.enabled ?? DEFAULT_OUTPUT_ALERT_SETTINGS.enabled,
    source: 'slide-notes',
    position: source.position === 'bottom' ? 'bottom' : 'top',
    durationMs: Number.isFinite(durationMs) ? Math.max(1000, Math.min(30000, Math.round(durationMs))) : DEFAULT_OUTPUT_ALERT_SETTINGS.durationMs,
    backgroundColor: sanitizeHexColor(source.backgroundColor, DEFAULT_OUTPUT_ALERT_SETTINGS.backgroundColor),
    textColor: sanitizeHexColor(source.textColor, DEFAULT_OUTPUT_ALERT_SETTINGS.textColor),
  };
}

function sanitizeOutputWidgets(value: unknown, layoutType: OutputLayoutType): OutputWidgetId[] {
  const allowed = new Set<OutputWidgetId>(['slideCanvas', 'currentLyrics', 'nextLyrics', 'previousLyrics', 'clock', 'timer', 'notes', 'sectionLabel', 'showName', 'progress', 'videoCountdown', 'logo', 'alert']);
  const source = Array.isArray(value) ? value : [];
  const widgets = source.filter((item): item is OutputWidgetId => allowed.has(item as OutputWidgetId));
  return widgets.length > 0 ? Array.from(new Set(widgets)) : DEFAULT_OUTPUT_WIDGETS_BY_LAYOUT[layoutType];
}

function sanitizeOutputWidgetLayouts(value: unknown): Record<OutputWidgetId, OutputWidgetLayout> {
  const source = value && typeof value === 'object' ? value as Partial<Record<OutputWidgetId, Partial<OutputWidgetLayout>>> : {};
  const next = { ...DEFAULT_OUTPUT_WIDGET_LAYOUTS };
  (Object.keys(next) as OutputWidgetId[]).forEach((widgetId) => {
    const raw = source[widgetId];
    if (!raw || typeof raw !== 'object') return;
    const x = Number(raw.x);
    const y = Number(raw.y);
    const width = Number(raw.width);
    const height = Number(raw.height);
    next[widgetId] = {
      x: Number.isFinite(x) ? Math.max(0, Math.min(95, x)) : next[widgetId].x,
      y: Number.isFinite(y) ? Math.max(0, Math.min(95, y)) : next[widgetId].y,
      width: Number.isFinite(width) ? Math.max(8, Math.min(100, width)) : next[widgetId].width,
      height: Number.isFinite(height) ? Math.max(6, Math.min(100, height)) : next[widgetId].height,
    };
  });
  return next;
}

function sanitizeOutputWidgetStyles(value: unknown): Record<OutputWidgetId, OutputWidgetStyle> {
  const source = value && typeof value === 'object' ? value as Partial<Record<OutputWidgetId, Partial<OutputWidgetStyle>>> : {};
  const next = { ...DEFAULT_OUTPUT_WIDGET_STYLES };
  (Object.keys(next) as OutputWidgetId[]).forEach((widgetId) => {
    const raw = source[widgetId];
    if (!raw || typeof raw !== 'object') return;
    const scale = Number(raw.scale);
    const backgroundOpacity = Number(raw.backgroundOpacity);
    next[widgetId] = {
      ...next[widgetId],
      label: typeof raw.label === 'string' && raw.label.trim() ? raw.label : next[widgetId].label,
      fontFamily: typeof raw.fontFamily === 'string' && raw.fontFamily.trim() ? raw.fontFamily : next[widgetId].fontFamily,
      scale: Number.isFinite(scale) ? Math.max(0.4, Math.min(3, scale)) : next[widgetId].scale,
      color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : next[widgetId].color,
      shadow: typeof raw.shadow === 'boolean' ? raw.shadow : next[widgetId].shadow,
      textAlign: raw.textAlign === 'center' || raw.textAlign === 'right' || raw.textAlign === 'left' ? raw.textAlign : next[widgetId].textAlign,
      backgroundColor: typeof raw.backgroundColor === 'string' && /^#[0-9a-f]{6}$/i.test(raw.backgroundColor) ? raw.backgroundColor : next[widgetId].backgroundColor,
      backgroundOpacity: Number.isFinite(backgroundOpacity) ? Math.max(0, Math.min(1, backgroundOpacity)) : next[widgetId].backgroundOpacity,
      borderVisible: typeof raw.borderVisible === 'boolean' ? raw.borderVisible : next[widgetId].borderVisible,
      showLabel: typeof raw.showLabel === 'boolean' ? raw.showLabel : next[widgetId].showLabel,
      sizingMode: raw.sizingMode === 'fixed' ? 'fixed' : 'responsive',
      fontSizePx: Number.isFinite(Number(raw.fontSizePx)) ? Math.max(8, Math.min(240, Number(raw.fontSizePx))) : next[widgetId].fontSizePx,
      maxLines: Number.isFinite(Number(raw.maxLines)) ? Math.max(1, Math.min(12, Math.round(Number(raw.maxLines)))) : next[widgetId].maxLines,
      overflow: raw.overflow === 'ellipsis' ? 'ellipsis' : 'clip',
      contentScope: raw.contentScope === 'song' ? 'song' : 'any',
    };
  });
  return next;
}

export function createBrowserOutputClient(
  overrides: Partial<BrowserOutputClient> & { locale?: LocaleCode } = {},
): BrowserOutputClient {
  const locale = overrides.locale ?? 'id';
  return {
    id: overrides.id || generateOutputId(),
    name: overrides.name || getDefaultBrowserClientName(locale, 1),
    pairingCode: overrides.pairingCode ? String(overrides.pairingCode).toUpperCase() : generatePairingCode(),
    notes: overrides.notes ? String(overrides.notes) : null,
  };
}

function deriveRoleDefaultsFromOutputs(outputs: OutputChannel[]): SongPresetDefaultsByRole {
  const next = { ...DEFAULT_SONG_PRESETS_BY_ROLE };

  for (const role of Object.keys(next) as ScreenProfileId[]) {
    const match = outputs.find((output) => output.enabled && output.role === role && output.songPresetMode === 'force' && output.forcedSongPresetId);
    next[role] = match?.forcedSongPresetId || null;
  }

  return next;
}

function sanitizeOutputs(
  rawOutputs: unknown,
  legacy: Pick<PersistedOutputSettings, 'targetDisplayId' | 'autoFullscreen' | 'autoOpenOnGoLive' | 'defaultSongPresetsByRole'>,
  locale: LocaleCode,
): OutputChannel[] {
  const source = Array.isArray(rawOutputs) ? rawOutputs : [];
  const outputs = source
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const output = item as Partial<OutputChannel>;
      const legacyDefaultSongPresetId = (item as { defaultSongPresetId?: unknown }).defaultSongPresetId;
      return createDefaultOutputChannel({
        ...output,
        id: output.id ? String(output.id) : generateOutputId(),
        name: output.name ? String(output.name) : getDefaultOutputName(locale, index + 1),
        enabled: output.enabled ?? true,
        isPrimary: !!output.isPrimary,
        role: output.role,
        targetType: output.targetType,
        targetDisplayId: output.targetDisplayId,
        browserClientId: output.browserClientId,
        autoFullscreen: output.autoFullscreen,
        autoOpenOnGoLive: output.autoOpenOnGoLive,
        songPresetMode: output.songPresetMode,
        forcedSongPresetId: output.forcedSongPresetId,
        contentRules: output.contentRules,
        defaultSongPresetId: legacyDefaultSongPresetId ? String(legacyDefaultSongPresetId) : null,
        outputPresetId: output.outputPresetId,
        renderMode: output.renderMode,
        canvasBackground: output.canvasBackground,
        layoutType: output.layoutType,
        transitionSettings: output.transitionSettings,
        stateTransitionSettings: output.stateTransitionSettings,
        songDisplaySettings: output.songDisplaySettings,
        scriptureSettings: output.scriptureSettings,
        presentationSettings: output.presentationSettings,
        alertSettings: output.alertSettings,
        widgets: output.widgets,
        widgetLayouts: output.widgetLayouts,
        widgetStyles: output.widgetStyles,
        ndiConfig: output.ndiConfig,
        locale,
      });
    })
    .filter((output): output is OutputChannel => !!output);

  if (outputs.length === 0) {
    const fallbackPresetId = legacy.defaultSongPresetsByRole[DEFAULT_SCREEN_PROFILE_ID] || null;
    return [
      createDefaultOutputChannel({
        name: getDefaultOutputName(locale, 1),
        isPrimary: true,
        role: DEFAULT_SCREEN_PROFILE_ID,
        targetType: 'electron-display',
        targetDisplayId: legacy.targetDisplayId,
        autoFullscreen: legacy.autoFullscreen,
        autoOpenOnGoLive: legacy.autoOpenOnGoLive,
        forcedSongPresetId: fallbackPresetId,
        outputPresetId: getDefaultOutputPresetIdForRole(DEFAULT_SCREEN_PROFILE_ID),
        locale,
      }),
    ];
  }

  let primaryAssigned = false;
  return outputs.map((output, index) => {
    if (!primaryAssigned && output.isPrimary) {
      primaryAssigned = true;
      return output;
    }

    return { ...output, isPrimary: !primaryAssigned && index === 0 };
  });
}

function sanitizeOutputPresets(rawPresets: unknown): OutputPreset[] {
  const builtins = createBuiltinOutputPresets();
  const source = Array.isArray(rawPresets) ? rawPresets : [];
  const customPresets = source
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const preset = item as Partial<OutputPreset>;
      if (!preset.id || builtins.some((builtin) => builtin.id === preset.id)) return null;
      return createDefaultOutputPreset({
        ...preset,
        id: String(preset.id),
        name: preset.name ? String(preset.name) : 'Screen Layout',
      });
    })
    .filter((preset): preset is OutputPreset => !!preset);

  const builtinOverrides = source
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const preset = item as Partial<OutputPreset>;
      const builtin = builtins.find((entry) => entry.id === preset.id);
      if (!builtin) return null;
      const shouldRefreshBuiltinGeometry = Number(preset.builtinRevision || 0) < Number(builtin.builtinRevision || 0);
      return createDefaultOutputPreset({
        ...builtin,
        ...preset,
        id: builtin.id,
        builtinRevision: builtin.builtinRevision,
        name: preset.name ? String(preset.name) : builtin.name,
        widgetLayouts: shouldRefreshBuiltinGeometry ? builtin.widgetLayouts : preset.widgetLayouts,
      });
    })
    .filter((preset): preset is OutputPreset => !!preset);

  return [
    ...builtins.map((builtin) => builtinOverrides.find((preset) => preset.id === builtin.id) || builtin),
    ...customPresets,
  ];
}

function sanitizeBrowserClients(rawClients: unknown, locale: LocaleCode): BrowserOutputClient[] {
  const source = Array.isArray(rawClients) ? rawClients : [];
  return source
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const client = item as Partial<BrowserOutputClient>;
      return createBrowserOutputClient({
        id: client.id ? String(client.id) : generateOutputId(),
        name: client.name ? String(client.name) : getDefaultBrowserClientName(locale, index + 1),
        pairingCode: client.pairingCode ? String(client.pairingCode).toUpperCase() : generatePairingCode(),
        notes: client.notes ? String(client.notes) : null,
        locale,
      });
    })
    .filter((client): client is BrowserOutputClient => !!client);
}

function sanitizeLogoOutputSettings(raw: unknown): LogoOutputSettings {
  const source = raw && typeof raw === 'object' ? raw as Partial<LogoOutputSettings> : {};
  const mediaType = source.mediaType === 'video' || source.mediaType === 'image' ? source.mediaType : null;
  return {
    mediaId: source.mediaId ? String(source.mediaId) : null,
    filename: source.filename ? String(source.filename) : null,
    mediaType,
    source: source.source ? String(source.source) : null,
    thumbnail: source.thumbnail ? String(source.thumbnail) : null,
    fit: source.fit === 'cover' || source.fit === 'fill' ? source.fit : 'contain',
    loop: source.loop !== false,
  };
}

function sanitizeBibleTemplate(raw: unknown): BiblePresentationStyle {
  const source = raw && typeof raw === 'object' ? raw as BiblePresentationStyle : {};
  const defaults = DEFAULT_OUTPUT_SETTINGS.bibleTemplate;
  const overlayOpacity = Number(source.overlayOpacity);
  const textScale = Number(source.textScale);
  const referenceScale = Number(source.referenceScale);
  const referenceX = source.referenceX == null ? null : Number(source.referenceX);
  const referenceY = source.referenceY == null ? null : Number(source.referenceY);
  const rawMaxVersesPerSlide = source.maxVersesPerSlide == null ? null : Number(source.maxVersesPerSlide);
  const contentX = Number(source.contentX);
  const contentY = Number(source.contentY);
  const contentWidth = Number(source.contentWidth);
  const contentHeight = Number(source.contentHeight);

  return {
    ...defaults,
    ...source,
    layoutMode: source.layoutMode === 'lower-third' ? 'lower-third' : 'fullscreen',
    backgroundMode: source.backgroundMode === 'media' ? 'media' : 'solid',
    backgroundColor: source.backgroundColor || defaults.backgroundColor,
    overlayOpacity: Number.isFinite(overlayOpacity) ? Math.max(0, Math.min(1, overlayOpacity)) : defaults.overlayOpacity,
    textAlign: source.textAlign === 'left' ? 'left' : 'center',
    verticalAlign:
      source.verticalAlign === 'top' || source.verticalAlign === 'bottom' || source.verticalAlign === 'middle'
        ? source.verticalAlign
        : defaults.verticalAlign,
    showReference: source.showReference ?? defaults.showReference,
    referencePosition: source.referencePosition === 'top' ? 'top' : 'bottom',
    referenceAlign:
      source.referenceAlign === 'left' || source.referenceAlign === 'center' || source.referenceAlign === 'right'
        ? source.referenceAlign
        : defaults.referenceAlign,
    showVerseNumbers: source.showVerseNumbers ?? defaults.showVerseNumbers,
    showVersionCode: source.showVersionCode ?? defaults.showVersionCode,
    showSectionTitle: source.showSectionTitle ?? defaults.showSectionTitle,
    sectionDisplay: source.sectionDisplay === 'slide' ? 'slide' : 'inline',
    textColor: source.textColor || defaults.textColor,
    referenceColor: source.referenceColor || defaults.referenceColor,
    versionColor: source.versionColor || defaults.versionColor,
    sectionColor: source.sectionColor || defaults.sectionColor,
    fontFamily: source.fontFamily || defaults.fontFamily,
    textScale: Number.isFinite(textScale) ? Math.max(0.6, Math.min(1.8, textScale)) : defaults.textScale,
    referenceScale: Number.isFinite(referenceScale) ? Math.max(0.6, Math.min(1.8, referenceScale)) : defaults.referenceScale,
    referenceX: referenceX != null && Number.isFinite(referenceX) ? Math.max(5, Math.min(95, referenceX)) : null,
    referenceY: referenceY != null && Number.isFinite(referenceY) ? Math.max(5, Math.min(95, referenceY)) : null,
    autoResizeMode:
      source.autoResizeMode === 'full' || source.autoResizeMode === 'narrow' || source.autoResizeMode === 'off'
        ? source.autoResizeMode
        : defaults.autoResizeMode,
    maxVersesPerSlide:
      rawMaxVersesPerSlide != null && Number.isFinite(rawMaxVersesPerSlide) && rawMaxVersesPerSlide > 0
        ? Math.max(1, Math.min(8, Math.round(rawMaxVersesPerSlide)))
        : null,
    contentX: Number.isFinite(contentX) ? Math.max(5, Math.min(95, contentX)) : defaults.contentX,
    contentY: Number.isFinite(contentY) ? Math.max(5, Math.min(95, contentY)) : defaults.contentY,
    contentWidth: Number.isFinite(contentWidth) ? Math.max(20, Math.min(96, contentWidth)) : defaults.contentWidth,
    contentHeight: Number.isFinite(contentHeight) ? Math.max(10, Math.min(80, contentHeight)) : defaults.contentHeight,
  };
}

export function sanitizeAiFormattingSettings(
  input: Partial<AiFormattingSettings> | null | undefined,
): AiFormattingSettings {
  const merged = {
    ...DEFAULT_AI_FORMATTING_SETTINGS,
    ...(input || {}),
  };
  return {
    maxCharsPerLine: Number.isFinite(merged.maxCharsPerLine)
      ? Math.max(15, Math.min(120, Math.round(merged.maxCharsPerLine)))
      : DEFAULT_AI_FORMATTING_SETTINGS.maxCharsPerLine,
    maxLinesPerSlide: Number.isFinite(merged.maxLinesPerSlide)
      ? Math.max(1, Math.min(10, Math.round(merged.maxLinesPerSlide)))
      : DEFAULT_AI_FORMATTING_SETTINGS.maxLinesPerSlide,
    autoFixTypos: merged.autoFixTypos !== undefined ? !!merged.autoFixTypos : DEFAULT_AI_FORMATTING_SETTINGS.autoFixTypos,
  };
}

export function sanitizeOutputSettings(
  input: Partial<PersistedOutputSettings> | null | undefined,
): PersistedOutputSettings {
  const merged = {
    ...DEFAULT_OUTPUT_SETTINGS,
    ...(input || {}),
  };
  const locale: LocaleCode = merged.locale === 'en' ? 'en' : 'id';

  const width = Number(merged.outputWidth);
  const height = Number(merged.outputHeight);
  const safeAreaPercent = Number(merged.safeAreaPercent);
  const roleDefaults = (() => {
    const raw = merged.defaultSongPresetsByRole || {};
    const next = { ...DEFAULT_SONG_PRESETS_BY_ROLE };

    Object.entries(raw).forEach(([key, value]) => {
      if (isScreenProfileId(key)) {
        next[key] = value ? String(value) : null;
      }
    });

    return next;
  })();
  const outputs = sanitizeOutputs(merged.outputs, {
    targetDisplayId: merged.targetDisplayId ? String(merged.targetDisplayId) : null,
    autoFullscreen: !!merged.autoFullscreen,
    autoOpenOnGoLive: !!merged.autoOpenOnGoLive,
    defaultSongPresetsByRole: roleDefaults,
  }, locale);
  const rawOutputPresets = Array.isArray(merged.outputPresets) ? merged.outputPresets : [];
  const outputPresets = sanitizeOutputPresets(merged.outputPresets).map((layout) => {
    const rawLayout = rawOutputPresets.find((item: any) => item && typeof item === 'object' && item.id === layout.id) as any;
    if (rawLayout?.contentRules) return layout;
    const assignedOutput = outputs.find((output) => output.outputPresetId === layout.id);
    const legacyThemeId = assignedOutput?.forcedSongPresetId || (merged.defaultSongPresetId ? String(merged.defaultSongPresetId) : null);
    if (!legacyThemeId) return layout;
    const migratedPolicy: ContentThemePolicy = assignedOutput?.songPresetMode === 'force' ? 'force' : 'fallback';
    return {
      ...layout,
      contentRules: {
        ...layout.contentRules,
        song: {
          ...layout.contentRules.song,
          policy: migratedPolicy,
          themeId: legacyThemeId,
        },
      },
    };
  });
  const browserClients = sanitizeBrowserClients(merged.browserClients, locale);
  const primaryOutput =
    outputs.find((output) => output.isPrimary)
    || outputs.find((output) => output.enabled)
    || outputs[0];
  const derivedRoleDefaults = deriveRoleDefaultsFromOutputs(outputs);
  const hasExplicitGlobalSongPreset = !!input && Object.prototype.hasOwnProperty.call(input, 'defaultSongPresetId');
  const defaultSongPresetId = hasExplicitGlobalSongPreset
    ? (input?.defaultSongPresetId ? String(input.defaultSongPresetId) : null)
    : primaryOutput?.forcedSongPresetId || roleDefaults[primaryOutput?.role || DEFAULT_SCREEN_PROFILE_ID] || null;

  return {
    ...merged,
    locale,
    outputWidth: Number.isFinite(width) && width > 0 ? Math.round(width) : DEFAULT_OUTPUT_SETTINGS.outputWidth,
    outputHeight: Number.isFinite(height) && height > 0 ? Math.round(height) : DEFAULT_OUTPUT_SETTINGS.outputHeight,
    safeAreaPercent:
      Number.isFinite(safeAreaPercent)
        ? Math.max(0, Math.min(20, Math.round(safeAreaPercent)))
        : DEFAULT_OUTPUT_SETTINGS.safeAreaPercent,
    aspectRatioMode:
      merged.aspectRatioMode === '16:9' ||
      merged.aspectRatioMode === '4:3' ||
      merged.aspectRatioMode === '21:9' ||
      merged.aspectRatioMode === 'custom'
        ? merged.aspectRatioMode
        : DEFAULT_OUTPUT_SETTINGS.aspectRatioMode,
    targetDisplayId: primaryOutput?.targetDisplayId ?? null,
    autoFullscreen: primaryOutput?.autoFullscreen ?? !!merged.autoFullscreen,
    autoOpenOnGoLive: primaryOutput?.autoOpenOnGoLive ?? !!merged.autoOpenOnGoLive,
    showSafeArea: !!merged.showSafeArea,
    appTheme: merged.appTheme === 'light' ? 'light' : 'dark',
    primaryColor: merged.primaryColor || DEFAULT_OUTPUT_SETTINGS.primaryColor,
    fallbackBehavior: 'primary-display',
    defaultSongPresetId,
    defaultBibleContentThemeId: merged.defaultBibleContentThemeId ? String(merged.defaultBibleContentThemeId) : null,
    defaultBibleContentThemeName: merged.defaultBibleContentThemeName ? String(merged.defaultBibleContentThemeName) : null,
    defaultBibleContentThemeLayersData: typeof merged.defaultBibleContentThemeLayersData === 'string' ? merged.defaultBibleContentThemeLayersData : null,
    bibleBrainApiKey: merged.bibleBrainApiKey ? String(merged.bibleBrainApiKey).trim() : null,
    defaultSongPresetsByRole: derivedRoleDefaults,
    outputs,
    outputPresets,
    browserClients,
    logoOutput: sanitizeLogoOutputSettings(merged.logoOutput),
    aiFormatting: sanitizeAiFormattingSettings(merged.aiFormatting),
    bibleTemplate: sanitizeBibleTemplate(merged.bibleTemplate),
    defaultSongStyle: merged.defaultSongStyle ? {
      ...DEFAULT_OUTPUT_SETTINGS.defaultSongStyle,
      ...merged.defaultSongStyle
    } : DEFAULT_OUTPUT_SETTINGS.defaultSongStyle,
  };
}

export function resolveSongPresetIdForRole(
  settings: PersistedOutputSettings | null | undefined,
  role?: ScreenProfileId | null,
) {
  const nextRole = role && isScreenProfileId(role) ? role : DEFAULT_SCREEN_PROFILE_ID;
  const outputMatch = settings?.outputs?.find((output) => output.enabled && output.role === nextRole);
  if (outputMatch) return resolveSongPresetIdForOutput(settings, outputMatch.id, null);
  if (settings?.defaultSongPresetId) return settings.defaultSongPresetId;
  const roleDefaults = settings?.defaultSongPresetsByRole || DEFAULT_SONG_PRESETS_BY_ROLE;
  return roleDefaults[nextRole] || null;
}

export function resolveSongPresetIdForOutput(
  settings: PersistedOutputSettings | null | undefined,
  outputId: string | null | undefined,
  songPresetId?: string | null,
) {
  const output = outputId ? settings?.outputs?.find((item) => item.id === outputId) : null;
  const layout = resolveOutputPresetForChannel(settings, output);
  const rule = layout?.contentRules?.song;
  if (rule?.policy === 'force') {
    return rule.themeId || null;
  }
  if (rule?.policy === 'fallback') {
    return songPresetId || rule.themeId || null;
  }
  if (rule?.policy === 'follow') return songPresetId || null;
  // Compatibility for settings saved before Screen Layout content rules.
  if (output?.songPresetMode === 'force') return output.forcedSongPresetId || settings?.defaultSongPresetId || null;
  return songPresetId || settings?.defaultSongPresetId || null;
}

export function shouldForceSongThemeForOutput(
  settings: PersistedOutputSettings | null | undefined,
  outputId: string | null | undefined,
) {
  const output = outputId ? settings?.outputs?.find((item) => item.id === outputId) : null;
  const layout = resolveOutputPresetForChannel(settings, output);
  return layout?.contentRules?.song?.policy === 'force' || (!layout?.contentRules && output?.songPresetMode === 'force');
}

export function resolvePrimaryOutputChannel(settings: PersistedOutputSettings | null | undefined) {
  const outputs = settings?.outputs || DEFAULT_OUTPUT_SETTINGS.outputs;
  return outputs.find((output) => output.isPrimary) || outputs.find((output) => output.enabled) || outputs[0] || null;
}

export function resolvePrimaryElectronOutputChannel(settings: PersistedOutputSettings | null | undefined) {
  const outputs = settings?.outputs || DEFAULT_OUTPUT_SETTINGS.outputs;
  return (
    outputs.find((output) => output.enabled && output.isPrimary && output.targetType === 'electron-display')
    || outputs.find((output) => output.enabled && output.targetType === 'electron-display')
    || resolvePrimaryOutputChannel(settings)
  );
}

export function resolveOutputPresetForChannel(
  settings: PersistedOutputSettings | null | undefined,
  output: OutputChannel | null | undefined,
) {
  if (!output) return null;
  const presets = settings?.outputPresets?.length ? settings.outputPresets : createBuiltinOutputPresets();
  return (
    (output.outputPresetId ? presets.find((preset) => preset.id === output.outputPresetId) : null)
    || presets.find((preset) => preset.id === getDefaultOutputPresetIdForRole(output.role))
    || presets[0]
    || null
  );
}

export function applyScreenLayoutToOutput(output: OutputChannel, layout: ScreenLayoutPreset | null | undefined): OutputChannel {
  if (!layout) return output;
  const songRule = layout.contentRules.song;
  return {
    ...output,
    role: layout.role,
    renderMode: layout.renderMode,
    canvasBackground: layout.canvasBackground,
    layoutType: layout.layoutType,
    transitionSettings: layout.transitionSettings,
    stateTransitionSettings: layout.stateTransitionSettings,
    songDisplaySettings: layout.songDisplaySettings,
    scriptureSettings: layout.scriptureSettings,
    presentationSettings: layout.presentationSettings,
    alertSettings: layout.alertSettings,
    widgets: layout.widgets,
    widgetLayouts: layout.widgetLayouts,
    widgetStyles: layout.widgetStyles,
    songPresetMode: songRule.policy === 'force' ? 'force' : 'original',
    forcedSongPresetId: songRule.themeId,
    contentRules: layout.contentRules,
    ndiConfig: {
      ...output.ndiConfig,
      // Visual composition now comes from Screen Layout presets. Legacy
      // broadcast-lyrics mode bypassed that pipeline with a second layout.
      contentMode: 'full-output',
    },
  };
}

export function updateScreenLayoutFromOutput(layout: ScreenLayoutPreset, output: OutputChannel): ScreenLayoutPreset {
  return createDefaultOutputPreset({
    ...layout,
    role: output.role,
    renderMode: output.renderMode,
    canvasBackground: output.canvasBackground,
    layoutType: output.layoutType,
    transitionSettings: output.transitionSettings,
    stateTransitionSettings: output.stateTransitionSettings,
    songDisplaySettings: output.songDisplaySettings,
    scriptureSettings: output.scriptureSettings,
    presentationSettings: output.presentationSettings,
    alertSettings: output.alertSettings,
    widgets: output.widgets,
    widgetLayouts: output.widgetLayouts,
    widgetStyles: output.widgetStyles,
  });
}

export function resolveEffectiveOutputChannel(
  settings: PersistedOutputSettings | null | undefined,
  output: OutputChannel | null | undefined,
): OutputChannel | null {
  if (!output) return null;
  const layout = resolveOutputPresetForChannel(settings, output);
  if (!layout) return output;
  return applyScreenLayoutToOutput(output, layout);
}
