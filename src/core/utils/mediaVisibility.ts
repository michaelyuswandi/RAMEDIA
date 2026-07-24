import type { Media } from '../../electron/database/schema';

export const SCHEDULE_ONLY_MEDIA_TAG = '__schedule_only__';

export function parseMediaTags(tags: string | null | undefined): string[] {
  if (!tags) return [];

  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

export function appendMediaTag(tags: string | null | undefined, tag: string): string {
  const nextTags = new Set(parseMediaTags(tags));
  nextTags.add(tag);
  return JSON.stringify(Array.from(nextTags));
}

export function isScheduleOnlyMedia(media: Media | null | undefined): boolean {
  if (!media) return false;
  return parseMediaTags(media.tags).includes(SCHEDULE_ONLY_MEDIA_TAG);
}
