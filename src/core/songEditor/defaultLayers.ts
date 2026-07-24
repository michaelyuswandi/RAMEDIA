import type { SlideLayer } from '../../electron/database/schema';
import type { DefaultSongStyle } from '../models/outputSettings';

function generateId() {
  return crypto.randomUUID();
}

export function createDefaultSlideLayers(slideId: string, textContent: string, defaultStyle?: DefaultSongStyle): SlideLayer[] {
  return [
    {
      id: generateId(),
      slideId,
      layerType: 'base',
      layerOrder: 1,
      content: defaultStyle?.backgroundColor || '#000000',
      visible: true,
      opacity: 1,
      mediaId: null,
      style: JSON.stringify({
        backgroundType: 'solid',
        backgroundValue: defaultStyle?.backgroundColor || '#000000',
      }),
      transition: null,
    },
    {
      id: generateId(),
      slideId,
      layerType: 'background',
      layerOrder: 2,
      content: null,
      visible: true,
      opacity: 1,
      mediaId: null,
      style: JSON.stringify({
        mediaType: null,
        source: null,
        objectFit: 'cover',
      }),
      transition: null,
    },
    {
      id: generateId(),
      slideId,
      layerType: 'media',
      layerOrder: 3,
      content: null,
      visible: true,
      opacity: 1,
      mediaId: null,
      style: JSON.stringify({
        mediaType: null,
        source: null,
        objectFit: 'contain',
      }),
      transition: null,
    },
    {
      id: generateId(),
      slideId,
      layerType: 'overlay',
      layerOrder: 4,
      content: null,
      visible: true,
      opacity: 1,
      mediaId: null,
      style: null,
      transition: null,
    },
    {
      id: generateId(),
      slideId,
      layerType: 'text',
      layerOrder: 5,
      content: textContent,
      visible: true,
      opacity: 1,
      mediaId: null,
      style: JSON.stringify({
        x: defaultStyle?.x ?? 50,
        y: defaultStyle?.y ?? 50,
        rotation: 0,
        sizingMode: 'auto',
        boxWidth: defaultStyle?.boxWidth ?? 80,
        boxHeight: defaultStyle?.boxHeight ?? 40,
        allowWrap: defaultStyle?.allowWrap ?? true,
        minFontSize: 1.0,
        maxFontSize: 8.0,
        scale: defaultStyle?.scale ?? 1.0,
        color: defaultStyle?.color ?? '#ffffff',
        textAlign: defaultStyle?.textAlign ?? 'center',
        textRole: 'lyrics-main',
        fontFamily: defaultStyle?.fontFamily ?? 'SF Pro Text, Inter, sans-serif',
        fontWeight: defaultStyle?.fontWeight ?? 600,
        fontStyle: defaultStyle?.fontStyle ?? 'normal',
        textDecoration: defaultStyle?.textDecoration ?? 'none',
        shadow: defaultStyle?.shadow ?? true,
      }),
      transition: null,
    },
  ];
}
