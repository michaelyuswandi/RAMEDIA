import type { OutputChannel } from '../models/outputSettings';
import type { Slide } from '../models/types';

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === 'object') return { ...(value as Record<string, unknown>) };
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function updateLayerStyle(layer: any, updates: Record<string, unknown>) {
  return { ...layer, style: JSON.stringify({ ...parseRecord(layer.style), ...updates }) };
}

export function applyOutputSlideOverrides(slide: Slide | null | undefined, output: OutputChannel | null | undefined): Slide | null {
  if (!slide) return null;
  if (!output) return slide;

  if (slide.type === 'lyrics') {
    const settings = output.songDisplaySettings;
    const applyStyle = (styleValue: unknown) => {
      const style = parseRecord(styleValue);
      return {
        ...style,
        fontFamily: settings.fontFamily.mode === 'override' ? settings.fontFamily.value : style.fontFamily,
        scale: settings.scale.mode === 'override' ? settings.scale.value : style.scale,
        color: settings.color.mode === 'override' ? settings.color.value : style.color,
        shadow: settings.shadow.mode === 'override' ? settings.shadow.value : style.shadow,
      };
    };

    if (!Array.isArray((slide as any).layers)) {
      return { ...slide, style: applyStyle(slide.style) } as Slide;
    }

    const layers = (slide as any).layers.map((layer: any) => (
      layer.layerType === 'text' ? { ...layer, style: JSON.stringify(applyStyle(layer.style)) } : layer
    ));
    return { ...slide, layers } as Slide;
  }

  if (!Array.isArray((slide as any).layers)) return slide;

  if (slide.type === 'media' || slide.type === 'image' || slide.type === 'video' || slide.type === 'custom') {
    const settings = output.presentationSettings;
    if (!settings) return slide;
    const layers = (slide as any).layers.map((layer: any) => {
      if (layer.layerType === 'base') return { ...layer, content: settings.backgroundColor };
      if (layer.layerType === 'background' || layer.layerType === 'media') {
        return updateLayerStyle(layer, { objectFit: settings.mediaFit });
      }
      if (layer.layerType === 'text') {
        const style = parseRecord(layer.style);
        const currentScale = Number(style.scale);
        return updateLayerStyle(layer, {
          scale: (Number.isFinite(currentScale) ? currentScale : 1) * settings.textScale,
        });
      }
      return layer;
    });
    return { ...slide, layers } as Slide;
  }

  return slide;
}
