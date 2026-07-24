import type { SlideLayer, Template } from '../../electron/database/schema';
import type { DefaultSongStyle } from '../models/outputSettings';
import { createDefaultSlideLayers } from './defaultLayers';

export type ContentThemeTextRole =
  | 'lyrics-main'
  | 'lyrics-secondary'
  | 'song-title'
  | 'section-label'
  | 'scripture-text'
  | 'scripture-reference'
  | 'scripture-version'
  | 'presentation-title'
  | 'presentation-body'
  | 'media-caption'
  | 'static';

interface ContentThemeBindingContext {
  lyrics: string;
  songTitle?: string | null;
  sectionLabel?: string | null;
  scriptureText?: string | null;
  scriptureReference?: string | null;
  scriptureVersion?: string | null;
  presentationTitle?: string | null;
  presentationBody?: string | null;
  mediaCaption?: string | null;
}

function generateId() {
  return crypto.randomUUID();
}

function parseTemplateLayers(template: Template | null | undefined): Partial<SlideLayer>[] {
  if (!template?.layersData) return [];

  try {
    const parsed = JSON.parse(template.layersData);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseLayerStyle(layer: Partial<SlideLayer>) {
  if (typeof layer.style !== 'string') return layer.style || {};

  try {
    return JSON.parse(layer.style || '{}');
  } catch {
    return {};
  }
}

function resolveTextContentForRole(
  role: ContentThemeTextRole,
  layerContent: string | null | undefined,
  context: ContentThemeBindingContext,
) {
  switch (role) {
    case 'lyrics-main':
    case 'lyrics-secondary':
      return context.lyrics;
    case 'song-title':
      return context.songTitle || 'Song Title';
    case 'section-label':
      return context.sectionLabel || 'Verse 1';
    case 'scripture-text':
      return context.scriptureText || context.lyrics;
    case 'scripture-reference':
      return context.scriptureReference || 'John 3:16';
    case 'scripture-version':
      return context.scriptureVersion || 'NIV';
    case 'presentation-title':
      return context.presentationTitle || 'Presentation Title';
    case 'presentation-body':
      return context.presentationBody || context.lyrics;
    case 'media-caption':
      return context.mediaCaption || 'Media caption';
    case 'static':
    default:
      return layerContent ?? '';
  }
}

export function buildLayersFromSongPreset(
  slideId: string,
  textContent: string,
  template: Template | null | undefined,
  fallbackStyle?: DefaultSongStyle,
  bindings?: Omit<ContentThemeBindingContext, 'lyrics'>,
): SlideLayer[] {
  const templateLayers = parseTemplateLayers(template);
  if (templateLayers.length === 0) {
    return createDefaultSlideLayers(slideId, textContent, fallbackStyle);
  }

  const context: ContentThemeBindingContext = {
    lyrics: textContent,
    songTitle: bindings?.songTitle ?? null,
    sectionLabel: bindings?.sectionLabel ?? null,
    scriptureText: bindings?.scriptureText ?? null,
    scriptureReference: bindings?.scriptureReference ?? null,
    scriptureVersion: bindings?.scriptureVersion ?? null,
    presentationTitle: bindings?.presentationTitle ?? null,
    presentationBody: bindings?.presentationBody ?? null,
    mediaCaption: bindings?.mediaCaption ?? null,
  };

  let hasDynamicTextRole = false;

  const layers = templateLayers.map((layer, index) => {
    const styleObject = parseLayerStyle(layer);
    let textRole = (styleObject.textRole || (layer.layerType === 'text' ? 'static' : null)) as ContentThemeTextRole | null;

    // Automatically promote standard placeholders to lyrics-main if they don't have a role
    if (layer.layerType === 'text' && textRole === 'static') {
      const contentUpper = String(layer.content || '').toUpperCase();
      if (
        contentUpper.includes('WORSHIP LYRICS') ||
        contentUpper.includes('LYRICS') ||
        contentUpper.includes('LOWER THIRD') ||
        contentUpper === 'TEXT LAYER'
      ) {
        textRole = 'lyrics-main';
      }
    }

    if (layer.layerType === 'text' && textRole !== 'static') {
      hasDynamicTextRole = true;
    }

    return {
      id: generateId(),
      slideId,
      layerType: layer.layerType || 'text',
      layerOrder: layer.layerOrder || index + 1,
      content: layer.layerType === 'text' && textRole
        ? resolveTextContentForRole(textRole, layer.content, context)
        : layer.content ?? null,
      visible: layer.visible ?? true,
      opacity: layer.opacity ?? 1,
      mediaId: layer.mediaId ?? null,
      style: layer.style ?? null,
      transition: layer.transition ?? null,
    } as SlideLayer;
  });

  if (!hasDynamicTextRole) {
    const fallbackLayers = createDefaultSlideLayers(slideId, textContent, fallbackStyle);
    const textLayer = fallbackLayers.find((layer) => layer.layerType === 'text');
    if (textLayer) {
      textLayer.layerOrder = Math.max(...layers.map((layer) => layer.layerOrder), 0) + 1;
      layers.push(textLayer);
    }
  }

  return layers.sort((a, b) => a.layerOrder - b.layerOrder);
}

export function buildLayersFromContentThemeData(
  slideId: string,
  textContent: string,
  layersData: string | null | undefined,
  bindings?: Omit<ContentThemeBindingContext, 'lyrics'>,
) {
  if (!layersData) return [];
  return buildLayersFromSongPreset(slideId, textContent, { layersData } as Template, undefined, bindings);
}

export function serializeSongPresetLayers(layers: SlideLayer[]): string {
  return JSON.stringify(
    layers.map((layer) => ({
      layerType: layer.layerType,
      layerOrder: layer.layerOrder,
      visible: layer.visible,
      opacity: layer.opacity,
      content: layer.content ?? null,
      mediaId: layer.mediaId ?? null,
      style: layer.style ?? null,
      transition: layer.transition ?? null,
    })),
  );
}
