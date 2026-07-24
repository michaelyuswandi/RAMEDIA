import type { Media } from '../../electron/database/schema';
import { getPdfPlaybackSettings, parseMediaPlaybackSettings } from './pdf';

export function buildMediaVirtualSlides(media: Media | null | undefined) {
  if (!media) return [];

  if (media.mediaType === 'pdf') {
    const pdfSettings = getPdfPlaybackSettings(media);

    return Array.from({ length: pdfSettings.pageCount }, (_, index) => {
      const pageNumber = index + 1;

      return {
        id: `virtual-pdf-${media.id}-${pageNumber}`,
        type: 'media',
        content: `${media.filename} - Page ${pageNumber}`,
        label: `Page ${pageNumber}`,
        sectionType: 'Page',
        pageNumber,
        pageCount: pdfSettings.pageCount,
        layers: [
          {
            id: `layer-pdf-${media.id}-${pageNumber}`,
            slideId: `virtual-pdf-${media.id}-${pageNumber}`,
            layerType: 'media',
            layerOrder: 1,
            visible: true,
            opacity: 1,
            content: media.filepath,
            mediaId: media.id,
            style: JSON.stringify({
              mediaType: 'pdf',
              objectFit: 'contain',
              pdf: {
                pageNumber,
                pageCount: pdfSettings.pageCount,
                aspectRatio: pdfSettings.aspectRatio,
                pageWidth: pdfSettings.pageWidth,
                pageHeight: pdfSettings.pageHeight,
                pageUrls: pdfSettings.pageUrls,
              },
            }),
            transition: null,
          },
        ],
      };
    });
  }

  const playbackSettings = parseMediaPlaybackSettings(media.playbackSettings);

  return [
    {
      id: `virtual-media-${media.id}`,
      type: 'media',
      content: media.filename,
      label: media.mediaType === 'video' ? 'Video' : (media.mediaType === 'youtube' ? 'YouTube' : 'Image'),
      sectionType: media.mediaType === 'video' ? 'Video' : (media.mediaType === 'youtube' ? 'YouTube' : 'Image'),
      layers: [
        {
          id: `layer-media-${media.id}`,
          slideId: `virtual-media-${media.id}`,
          layerType: 'media',
          layerOrder: 1,
          visible: true,
          opacity: 1,
          content: media.filepath,
          mediaId: media.id,
          style: JSON.stringify({
            ...playbackSettings,
            playbackSettings,
            mediaType: media.mediaType,
            duration: media.duration || 0,
          }),
          transition: null,
        },
      ],
    },
  ];
}
