import type { SlideLayer } from '../../electron/database/schema';
import type { Slide } from '../models/types';

function parseJsonObject(value: unknown) {
  if (!value) return {};
  if (typeof value !== 'string') {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, any> : {};
  } catch {
    return {};
  }
}

function isVideoSource(source: unknown) {
  return /\.(mp4|mov|webm|m4v)$/i.test(String(source || ''));
}

export interface SlideVideoLayerInfo {
  layer: SlideLayer;
  style: Record<string, any>;
  playbackSettings: Record<string, any>;
  source: string;
}

function normalizeVideoSource(source: unknown) {
  return String(source || '').trim().replace(/\\/g, '/');
}

export function getVideoPlaybackIdForLayer(layer: SlideLayer, source: unknown) {
  const mediaId = String(layer.mediaId || '').trim();
  if (mediaId) return mediaId;

  const normalizedSource = normalizeVideoSource(source);
  return normalizedSource ? `source:${normalizedSource}` : layer.id;
}

export function getVideoPlaybackId(videoLayer: SlideVideoLayerInfo | null | undefined) {
  return videoLayer
    ? getVideoPlaybackIdForLayer(videoLayer.layer, videoLayer.source)
    : null;
}

export function normalizeVideoPlaybackTime(
  time: number,
  startTime: number,
  endTime: number,
  behavior: string,
) {
  const safeStart = Math.max(0, Number(startTime) || 0);
  const safeTime = Math.max(safeStart, Number(time) || 0);
  const safeEnd = Math.max(0, Number(endTime) || 0);

  if (behavior !== 'loop' || safeEnd <= safeStart) {
    return safeEnd > safeStart ? Math.min(safeTime, safeEnd) : safeTime;
  }

  const loopDuration = safeEnd - safeStart;
  return safeStart + (((safeTime - safeStart) % loopDuration) + loopDuration) % loopDuration;
}

export function findPrimaryVideoLayer(slide: Slide | null | undefined): SlideVideoLayerInfo | null {
  const layers = Array.isArray((slide as any)?.layers) ? (slide as any).layers as SlideLayer[] : [];
  const candidates = layers
    .filter((layer) => layer.visible !== false && (layer.layerType === 'media' || layer.layerType === 'background'))
    .sort((a, b) => (a.layerOrder || 0) - (b.layerOrder || 0));

  for (const layer of candidates) {
    const style = parseJsonObject(layer.style);
    const source = String(style.source || layer.content || '');
    const isYouTube = style.mediaType === 'youtube' || /(youtube\.com|youtu\.be)/i.test(source);
    const mediaType = style.mediaType || (isVideoSource(source) ? 'video' : (isYouTube ? 'youtube' : null));
    if (mediaType !== 'video' && mediaType !== 'youtube') continue;

    const playbackSettings = parseJsonObject(style.playbackSettings || style);
    return { layer, style, playbackSettings, source };
  }

  return null;
}
