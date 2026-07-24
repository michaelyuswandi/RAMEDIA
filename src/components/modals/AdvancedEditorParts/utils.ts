import { Layers, Type, Image, Monitor, Settings } from 'lucide-react';

export const LayerIcons: Record<string, any> = {
  text: Type,
  overlay: Layers,
  media: Image,
  background: Monitor,
  base: Settings
};

export const getLayerName = (type: string) => {
  const names: Record<string, string> = {
    text: 'Text Layer',
    overlay: 'Overlay',
    media: 'Media',
    background: 'Background',
    base: 'Base Color'
  };
  return names[type] || type;
};
