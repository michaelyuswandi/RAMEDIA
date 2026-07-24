export interface YouTubeVideoDetails {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl: string;
  authorName?: string;
}

export function parseYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const cleaned = url.trim();
  const match = cleaned.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  return match ? match[1] : null;
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export async function fetchYouTubeDetails(inputUrlOrId: string): Promise<YouTubeVideoDetails | null> {
  const videoId = parseYouTubeVideoId(inputUrlOrId) || (inputUrlOrId.length === 11 ? inputUrlOrId : null);
  if (!videoId) return null;

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const defaultThumbnail = getYouTubeThumbnailUrl(videoId);

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`;
    const res = await fetch(oembedUrl);
    if (res.ok) {
      const data = await res.json();
      return {
        videoId,
        url: canonicalUrl,
        title: data.title || `YouTube Video (${videoId})`,
        thumbnailUrl: data.thumbnail_url || defaultThumbnail,
        authorName: data.author_name || '',
      };
    }
  } catch (err) {
    console.warn('Failed to fetch YouTube oEmbed info, falling back to defaults:', err);
  }

  return {
    videoId,
    url: canonicalUrl,
    title: `YouTube Video (${videoId})`,
    thumbnailUrl: defaultThumbnail,
  };
}
