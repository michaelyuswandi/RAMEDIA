import type { ContentThemeType } from '../../electron/database/schema';

export interface ContentThemeSeedDefinition {
  name: string;
  category: string;
  contentType: ContentThemeType;
  layersData: string;
  variantsData: string;
}

export const CONTENT_THEME_SEED_REVISION = 2;

function textStyle(
  textRole: string,
  overrides: Record<string, string | number | boolean> = {},
) {
  return JSON.stringify({
    x: 50,
    y: 50,
    boxWidth: 84,
    boxHeight: 42,
    sizingMode: 'fixed',
    allowWrap: true,
    textAlign: 'center',
    lineHeight: 1.15,
    scale: 1,
    color: '#ffffff',
    shadow: true,
    fontFamily: 'Outfit, Manrope, sans-serif',
    fontWeight: 700,
    textRole,
    ...overrides,
  });
}

function leftTextStyle(
  textRole: string,
  left: number,
  boxWidth: number,
  overrides: Record<string, string | number | boolean> = {},
) {
  return textStyle(textRole, {
    x: left + (boxWidth / 2),
    boxWidth,
    textAlign: 'left',
    ...overrides,
  });
}

function makeSeed(
  name: string,
  category: string,
  contentType: ContentThemeType,
  layers: Array<Record<string, unknown>>,
): ContentThemeSeedDefinition {
  const layersData = JSON.stringify(layers);
  return {
    name,
    category,
    contentType,
    layersData,
    variantsData: JSON.stringify([{ id: 'default', name: 'Default', layersData, seedRevision: CONTENT_THEME_SEED_REVISION }]),
  };
}

export const CONTENT_THEME_SEEDS: ContentThemeSeedDefinition[] = [
  makeSeed('Song — Center Worship', 'Full Screen', 'song', [
    { layerType: 'base', layerOrder: 1, content: '#111827', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#111827' }) },
    { layerType: 'background', layerOrder: 2, content: null, visible: true, opacity: 1, style: JSON.stringify({ objectFit: 'cover' }) },
    { layerType: 'overlay', layerOrder: 3, content: null, visible: true, opacity: 0.28, style: JSON.stringify({ background: '#020617' }) },
    { layerType: 'text', layerOrder: 4, content: 'Amazing Grace', visible: true, opacity: 1, style: textStyle('song-title', { y: 16, boxHeight: 9, scale: 0.42, color: '#cbd5e1', fontWeight: 600 }) },
    { layerType: 'text', layerOrder: 5, content: 'Amazing Grace\nHow sweet the sound', visible: true, opacity: 1, transition: JSON.stringify({ entrance: 'fade', duration: 0.45 }), style: textStyle('lyrics-main', { y: 51, boxHeight: 44, scale: 1.12 }) },
    { layerType: 'text', layerOrder: 6, content: 'Verse 1', visible: true, opacity: 1, style: textStyle('section-label', { y: 86, boxHeight: 7, scale: 0.34, color: '#fbbf24', fontWeight: 700 }) },
  ]),
  makeSeed('Song — Broadcast Lower Third', 'Lower Third', 'song', [
    { layerType: 'base', layerOrder: 1, content: 'transparent', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: 'transparent' }) },
    { layerType: 'overlay', layerOrder: 2, content: null, visible: true, opacity: 0.82, style: JSON.stringify({ x: 4, y: 67, width: 78, height: 27, background: '#111827' }) },
    { layerType: 'text', layerOrder: 3, content: 'Verse 1', visible: true, opacity: 1, style: leftTextStyle('section-label', 9, 18, { y: 70, boxHeight: 6, scale: 0.32, color: '#fbbf24' }) },
    { layerType: 'text', layerOrder: 4, content: 'Amazing Grace\nHow sweet the sound', visible: true, opacity: 1, transition: JSON.stringify({ entrance: 'slideUp', duration: 0.35 }), style: leftTextStyle('lyrics-main', 9, 68, { y: 82, boxHeight: 18, scale: 0.68 }) },
  ]),
  makeSeed('Scripture — Reading Focus', 'Full Screen', 'scripture', [
    { layerType: 'base', layerOrder: 1, content: '#111827', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#111827' }) },
    { layerType: 'text', layerOrder: 2, content: 'For God so loved the world that he gave his one and only Son.', visible: true, opacity: 1, style: textStyle('scripture-text', { y: 45, boxWidth: 78, boxHeight: 46, textAlign: 'left', scale: 0.9, fontWeight: 600 }) },
    { layerType: 'text', layerOrder: 3, content: 'John 3:16', visible: true, opacity: 1, style: leftTextStyle('scripture-reference', 11, 55, { y: 79, boxHeight: 9, scale: 0.48, color: '#fbbf24' }) },
    { layerType: 'text', layerOrder: 4, content: 'NIV', visible: true, opacity: 1, style: textStyle('scripture-version', { x: 84, y: 79, boxWidth: 12, boxHeight: 7, textAlign: 'right', scale: 0.34, color: '#94a3b8' }) },
  ]),
  makeSeed('Scripture — Clean Center', 'Full Screen', 'scripture', [
    { layerType: 'base', layerOrder: 1, content: '#18181b', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#18181b' }) },
    { layerType: 'text', layerOrder: 2, content: 'For God so loved the world that he gave his one and only Son.', visible: true, opacity: 1, transition: JSON.stringify({ entrance: 'fade', duration: 0.35 }), style: textStyle('scripture-text', { y: 49, boxWidth: 76, boxHeight: 45, scale: 0.96, fontWeight: 650 }) },
    { layerType: 'text', layerOrder: 3, content: 'John 3:16', visible: true, opacity: 1, style: textStyle('scripture-reference', { y: 80, boxWidth: 48, boxHeight: 8, scale: 0.44, color: '#fcd34d', fontWeight: 700 }) },
    { layerType: 'text', layerOrder: 4, content: 'NIV', visible: true, opacity: 1, style: textStyle('scripture-version', { y: 88, boxWidth: 18, boxHeight: 6, scale: 0.28, color: '#a1a1aa', fontWeight: 600 }) },
  ]),
  makeSeed('Scripture — Editorial Light', 'Full Screen', 'scripture', [
    { layerType: 'base', layerOrder: 1, content: '#f4f1ea', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#f4f1ea' }) },
    { layerType: 'overlay', layerOrder: 2, content: '#b45309', visible: true, opacity: 1, style: JSON.stringify({ x: 9, y: 16, width: 0.7, height: 68, background: '#b45309' }) },
    { layerType: 'text', layerOrder: 3, content: 'John 3:16', visible: true, opacity: 1, style: leftTextStyle('scripture-reference', 14, 66, { y: 22, boxHeight: 8, scale: 0.42, color: '#92400e', shadow: false, fontWeight: 750 }) },
    { layerType: 'text', layerOrder: 4, content: 'For God so loved the world that he gave his one and only Son.', visible: true, opacity: 1, style: leftTextStyle('scripture-text', 14, 72, { y: 52, boxHeight: 48, scale: 0.88, color: '#27272a', shadow: false, fontWeight: 600 }) },
    { layerType: 'text', layerOrder: 5, content: 'NIV', visible: true, opacity: 1, style: leftTextStyle('scripture-version', 14, 20, { y: 83, boxHeight: 6, scale: 0.3, color: '#78716c', shadow: false, fontWeight: 700 }) },
  ]),
  makeSeed('Scripture — Broadcast Lower Third', 'Lower Third', 'scripture', [
    { layerType: 'base', layerOrder: 1, content: 'transparent', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: 'transparent' }) },
    { layerType: 'overlay', layerOrder: 2, content: 'rgba(17,24,39,0.9)', visible: true, opacity: 1, style: JSON.stringify({ x: 4, y: 63, width: 86, height: 32, background: 'rgba(17,24,39,0.9)' }) },
    { layerType: 'overlay', layerOrder: 3, content: '#f59e0b', visible: true, opacity: 1, style: JSON.stringify({ x: 4, y: 63, width: 0.8, height: 32, background: '#f59e0b' }) },
    { layerType: 'text', layerOrder: 4, content: 'John 3:16', visible: true, opacity: 1, style: leftTextStyle('scripture-reference', 8, 56, { y: 69, boxHeight: 6, scale: 0.32, color: '#fbbf24', fontWeight: 750 }) },
    { layerType: 'text', layerOrder: 5, content: 'For God so loved the world that he gave his one and only Son.', visible: true, opacity: 1, transition: JSON.stringify({ entrance: 'slideUp', duration: 0.3 }), style: leftTextStyle('scripture-text', 8, 77, { y: 82, boxHeight: 18, scale: 0.6, fontWeight: 650 }) },
    { layerType: 'text', layerOrder: 6, content: 'NIV', visible: true, opacity: 1, style: leftTextStyle('scripture-version', 78, 7, { y: 69, boxHeight: 5, textAlign: 'right', scale: 0.25, color: '#cbd5e1', fontWeight: 700 }) },
  ]),
  makeSeed('Scripture — Large Reading', 'Accessibility', 'scripture', [
    { layerType: 'base', layerOrder: 1, content: '#0c0a09', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#0c0a09' }) },
    { layerType: 'text', layerOrder: 2, content: 'John 3:16', visible: true, opacity: 1, style: leftTextStyle('scripture-reference', 8, 60, { y: 11, boxHeight: 8, scale: 0.46, color: '#fde68a', fontWeight: 750 }) },
    { layerType: 'text', layerOrder: 3, content: 'For God so loved the world that he gave his one and only Son.', visible: true, opacity: 1, style: leftTextStyle('scripture-text', 8, 84, { y: 53, boxHeight: 62, scale: 1.02, fontWeight: 700 }) },
    { layerType: 'text', layerOrder: 4, content: 'NIV', visible: true, opacity: 1, style: leftTextStyle('scripture-version', 85, 7, { y: 90, boxHeight: 5, textAlign: 'right', scale: 0.3, color: '#a8a29e', fontWeight: 700 }) },
  ]),
  makeSeed('Presentation — Sermon Title', 'Title & Body', 'presentation', [
    { layerType: 'base', layerOrder: 1, content: '#f8fafc', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#f8fafc' }) },
    { layerType: 'overlay', layerOrder: 2, content: null, visible: true, opacity: 1, style: JSON.stringify({ x: 8, y: 14, width: 2, height: 70, background: '#d97706' }) },
    { layerType: 'text', layerOrder: 3, content: 'Living With Purpose', visible: true, opacity: 1, style: leftTextStyle('presentation-title', 15, 70, { y: 31, boxHeight: 24, scale: 1.08, color: '#0f172a', shadow: false }) },
    { layerType: 'text', layerOrder: 4, content: 'A clear supporting message for the congregation.', visible: true, opacity: 1, style: leftTextStyle('presentation-body', 15, 66, { y: 62, boxHeight: 30, scale: 0.62, color: '#475569', shadow: false, fontWeight: 500 }) },
  ]),
  makeSeed('Media — Caption Bar', 'Caption', 'media', [
    { layerType: 'base', layerOrder: 1, content: '#111827', visible: true, opacity: 1, style: JSON.stringify({ backgroundType: 'solid', backgroundValue: '#111827' }) },
    { layerType: 'media', layerOrder: 2, content: null, visible: true, opacity: 1, style: JSON.stringify({ objectFit: 'cover' }) },
    { layerType: 'overlay', layerOrder: 3, content: null, visible: true, opacity: 0.76, style: JSON.stringify({ x: 0, y: 76, width: 100, height: 24, background: '#111827' }) },
    { layerType: 'text', layerOrder: 4, content: 'Media caption', visible: true, opacity: 1, style: leftTextStyle('media-caption', 7, 86, { y: 88, boxHeight: 12, scale: 0.58 }) },
  ]),
];
