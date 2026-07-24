import type { ContentThemeType } from '../../electron/database/schema';
import type { OutputPreset, OutputWidgetId } from '../models/outputSettings';
import { toRenderableMediaUrl } from '../utils/mediaUrl';

const WIDTH = 640;
const HEIGHT = 360;

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function getScreenLayoutThumbnailSignature(preset: OutputPreset) {
  return stableHash(JSON.stringify({
    canvasBackground: preset.canvasBackground,
    widgets: preset.widgets,
    widgetLayouts: preset.widgetLayouts,
    widgetStyles: preset.widgetStyles,
  }));
}

function parseRecord(value: unknown): Record<string, any> {
  if (!value) return {};
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function createCanvas() {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas preview is unavailable.');
  return { canvas, context };
}

function drawTransparency(context: CanvasRenderingContext2D) {
  context.fillStyle = '#171a20';
  context.fillRect(0, 0, WIDTH, HEIGHT);
  const size = 18;
  for (let y = 0; y < HEIGHT; y += size) {
    for (let x = 0; x < WIDTH; x += size) {
      if (((x / size) + (y / size)) % 2 === 0) {
        context.fillStyle = '#20242c';
        context.fillRect(x, y, size, size);
      }
    }
  }
}

function sampleForRole(role: string, contentType: ContentThemeType, fallback: string) {
  const samples: Record<string, string> = {
    'song-title': 'Amazing Grace',
    'lyrics-main': 'Amazing grace\nHow sweet the sound',
    'lyrics-secondary': 'That saved a soul like me',
    'section-label': 'Verse 1',
    'scripture-text': 'For God so loved the world that he gave his one and only Son.',
    'scripture-reference': 'John 3:16',
    'scripture-version': 'NIV',
    'presentation-title': 'Living With Purpose',
    'presentation-body': 'A clear supporting message for the congregation.',
    'media-caption': 'Sunday Service · Live',
  };
  return samples[role] || fallback || (contentType === 'scripture' ? samples['scripture-text'] : 'Preview');
}

function wrapLines(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const result: string[] = [];
  String(text).split('\n').forEach((paragraph) => {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      result.push('');
      return;
    }
    let line = words[0];
    for (let index = 1; index < words.length; index += 1) {
      const candidate = `${line} ${words[index]}`;
      if (context.measureText(candidate).width <= maxWidth) line = candidate;
      else {
        result.push(line);
        line = words[index];
      }
    }
    result.push(line);
  });
  return result;
}

async function loadImage(source: string) {
  return await new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = toRenderableMediaUrl(source);
  });
}

function drawContainedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, fit: 'cover' | 'contain') {
  const scale = fit === 'cover'
    ? Math.max(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight)
    : Math.min(WIDTH / image.naturalWidth, HEIGHT / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  context.drawImage(image, (WIDTH - width) / 2, (HEIGHT - height) / 2, width, height);
}

function canvasToPng(canvas: HTMLCanvasElement) {
  return canvas.toDataURL('image/png');
}

export async function renderContentThemeThumbnail(layersData: string, contentType: ContentThemeType) {
  const { canvas, context } = createCanvas();
  const parsed = JSON.parse(layersData || '[]');
  const layers = Array.isArray(parsed) ? [...parsed].sort((a, b) => Number(a.layerOrder || 0) - Number(b.layerOrder || 0)) : [];
  const transparent = layers.some((layer) => layer.layerType === 'base' && layer.visible !== false && layer.content === 'transparent');
  if (transparent) drawTransparency(context);
  else {
    context.fillStyle = '#11151c';
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }

  for (const layer of layers) {
    if (layer.visible === false) continue;
    const style = parseRecord(layer.style);
    context.save();
    context.globalAlpha = Number.isFinite(Number(layer.opacity)) ? Number(layer.opacity) : 1;

    if (layer.layerType === 'base' && layer.content !== 'transparent') {
      context.fillStyle = layer.content || style.backgroundValue || '#11151c';
      context.fillRect(0, 0, WIDTH, HEIGHT);
    } else if (layer.layerType === 'overlay') {
      context.fillStyle = style.background || style.color || layer.content || 'rgba(0,0,0,0.35)';
      context.fillRect(
        (Number(style.x) || 0) / 100 * WIDTH,
        (Number(style.y) || 0) / 100 * HEIGHT,
        (Number(style.width) || 100) / 100 * WIDTH,
        (Number(style.height) || 100) / 100 * HEIGHT,
      );
    } else if (layer.layerType === 'background' || layer.layerType === 'media') {
      const source = style.source || layer.content;
      if (source && style.mediaType !== 'video') {
        const image = await loadImage(source);
        if (image) drawContainedImage(context, image, style.objectFit === 'contain' ? 'contain' : 'cover');
      }
    } else if (layer.layerType === 'text') {
      const role = style.textRole || 'static';
      const text = sampleForRole(role, contentType, String(layer.content || ''));
      const boxWidth = (Number(style.boxWidth) || 84) / 100 * WIDTH;
      const boxHeight = (Number(style.boxHeight) || 42) / 100 * HEIGHT;
      const centerX = (Number(style.x ?? 50) / 100) * WIDTH;
      const centerY = (Number(style.y ?? 50) / 100) * HEIGHT;
      const left = centerX - boxWidth / 2;
      const top = centerY - boxHeight / 2;
      const scale = Math.max(0.25, Number(style.scale) || 1);
      const fontSize = 19.4 * scale;
      const lineHeight = fontSize * (Number(style.lineHeight) || 1.15);
      context.beginPath();
      context.rect(left, top, boxWidth, boxHeight);
      context.clip();
      context.translate(centerX, centerY);
      context.rotate((Number(style.rotation) || 0) * Math.PI / 180);
      context.translate(-centerX, -centerY);
      context.font = `${style.fontStyle || 'normal'} ${style.fontWeight || 600} ${fontSize}px ${style.fontFamily || 'Outfit, sans-serif'}`;
      context.fillStyle = style.color || '#ffffff';
      context.textAlign = style.textAlign === 'left' || style.textAlign === 'right' ? style.textAlign : 'center';
      context.textBaseline = 'middle';
      if (style.shadow) {
        context.shadowColor = 'rgba(0,0,0,0.78)';
        context.shadowBlur = 8;
        context.shadowOffsetY = 2;
      }
      const lines = wrapLines(context, text, boxWidth);
      const totalHeight = lines.length * lineHeight;
      const textX = context.textAlign === 'left' ? left : context.textAlign === 'right' ? left + boxWidth : centerX;
      lines.forEach((line, index) => context.fillText(line, textX, centerY - totalHeight / 2 + lineHeight * (index + 0.5), boxWidth));
    }
    context.restore();
  }

  return canvasToPng(canvas);
}

const WIDGET_SAMPLES: Record<OutputWidgetId, string> = {
  slideCanvas: 'Rendered slide', currentLyrics: 'Amazing grace\nHow sweet the sound', nextLyrics: 'Next lyric line', previousLyrics: 'Previous lyric',
  notes: 'Operator notes', sectionLabel: 'Verse 1', clock: '19:30:24', timer: '00:42', videoCountdown: '02:18', showName: 'Sunday Service',
  progress: '3 / 8', logo: 'RAMEDIA', alert: 'Stage alert',
};

export async function renderScreenLayoutThumbnail(preset: OutputPreset) {
  const { canvas, context } = createCanvas();
  if (preset.canvasBackground === 'transparent') drawTransparency(context);
  else {
    context.fillStyle = '#080b10';
    context.fillRect(0, 0, WIDTH, HEIGHT);
  }
  for (const widget of preset.widgets) {
    const layout = preset.widgetLayouts[widget];
    const style = preset.widgetStyles[widget];
    if (!layout || !style) continue;
    const x = layout.x / 100 * WIDTH;
    const y = layout.y / 100 * HEIGHT;
    const width = layout.width / 100 * WIDTH;
    const height = layout.height / 100 * HEIGHT;
    if (widget === 'slideCanvas') {
      context.save();
      context.fillStyle = preset.canvasBackground === 'transparent' ? 'rgba(7,10,15,0.78)' : '#111722';
      context.fillRect(x, y, width, height);
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      context.fillStyle = '#ffffff';
      context.font = `600 ${Math.max(12, Math.min(25, height * 0.09))}px Outfit, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('Amazing grace', x + width / 2, y + height / 2 - 14, Math.max(0, width - 32));
      context.fillText('How sweet the sound', x + width / 2, y + height / 2 + 16, Math.max(0, width - 32));
      context.restore();
      continue;
    }
    const backgroundOpacity = Number.isFinite(Number(style.backgroundOpacity))
      ? Math.max(0, Math.min(1, Number(style.backgroundOpacity)))
      : 0.12;
    if (backgroundOpacity > 0) {
      context.save();
      context.globalAlpha = backgroundOpacity;
      context.fillStyle = style.backgroundColor || '#04070c';
      context.fillRect(x, y, width, height);
      context.restore();
    }
    if (style.borderVisible !== false) {
      context.strokeStyle = 'rgba(255,255,255,0.16)';
      context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    }
    context.save();
    context.beginPath();
    context.rect(x + 8, y + 6, Math.max(0, width - 16), Math.max(0, height - 12));
    context.clip();
    context.fillStyle = style.color || '#ffffff';
    const textScale = Math.max(0.25, Number(style.scale) || 1);
    context.font = `${widget === 'currentLyrics' ? 600 : 500} ${Math.max(9, Math.min(28, height * (widget === 'currentLyrics' ? 0.2 : 0.24) * textScale))}px ${style.fontFamily || 'Outfit, sans-serif'}`;
    context.textAlign = style.textAlign || 'left';
    context.textBaseline = 'middle';
    if (style.shadow) {
      context.shadowColor = 'rgba(0,0,0,0.75)';
      context.shadowBlur = 6;
      context.shadowOffsetY = 2;
    }
    const textX = context.textAlign === 'right' ? x + width - 10 : context.textAlign === 'center' ? x + width / 2 : x + 10;
    const lines = WIDGET_SAMPLES[widget].split('\n');
    lines.forEach((line, index) => context.fillText(line, textX, y + height / 2 + (index - (lines.length - 1) / 2) * 22, width - 20));
    context.restore();
  }
  return canvasToPng(canvas);
}
