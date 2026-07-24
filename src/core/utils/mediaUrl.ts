export function toRenderableMediaUrl(source?: string | null) {
  if (!source || typeof source !== 'string') return '';

  if (source.startsWith('ramedia-media://') || source.startsWith('http://') || source.startsWith('https://') || source.startsWith('data:') || source.startsWith('blob:')) {
    return source;
  }

  const isBrowserOutputHttpRuntime =
    typeof window !== 'undefined' &&
    !window.api &&
    (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
    window.location.pathname.startsWith('/browser-output');

  if (isBrowserOutputHttpRuntime && (source.startsWith('file://') || source.startsWith('/'))) {
    const fileUrl = source.startsWith('file://') ? source : `file://${source}`;
    return `/api/media-file?src=${encodeURIComponent(fileUrl)}`;
  }

  if (source.startsWith('file://')) {
    return `ramedia-media://local?src=${encodeURIComponent(source)}`;
  }

  if (source.startsWith('/')) {
    return `ramedia-media://local?src=${encodeURIComponent(`file://${source}`)}`;
  }

  return source;
}
