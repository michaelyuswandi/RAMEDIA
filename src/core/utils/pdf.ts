import type { Media } from '../../electron/database/schema';

export interface PdfPlaybackSettings {
  pageCount: number;
  aspectRatio: number | null;
  pageWidth?: number | null;
  pageHeight?: number | null;
  pageUrls: string[];
}

export function parseMediaPlaybackSettings(raw: string | null | undefined): Record<string, any> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.playback && typeof parsed.playback === 'object') {
      return parsed.playback as Record<string, any>;
    }
    return parsed && typeof parsed === 'object' ? parsed as Record<string, any> : {};
  } catch {
    return {};
  }
}

export function getPdfPlaybackSettings(media: Media | null | undefined): PdfPlaybackSettings {
  const parsed = parseMediaPlaybackSettings(media?.playbackSettings);
  const pageCount = Number(parsed.pageCount);
  const aspectRatio = Number(parsed.aspectRatio);
  const pageWidth = Number(parsed.pageWidth);
  const pageHeight = Number(parsed.pageHeight);

  return {
    pageCount: Number.isFinite(pageCount) && pageCount > 0 ? Math.round(pageCount) : 1,
    aspectRatio: Number.isFinite(aspectRatio) && aspectRatio > 0 ? aspectRatio : null,
    pageWidth: Number.isFinite(pageWidth) && pageWidth > 0 ? Math.round(pageWidth) : null,
    pageHeight: Number.isFinite(pageHeight) && pageHeight > 0 ? Math.round(pageHeight) : null,
    pageUrls: Array.isArray(parsed.pageUrls) ? parsed.pageUrls : [],
  };
}

export function isPdfMedia(media: Media | null | undefined) {
  return media?.mediaType === 'pdf';
}

export function isQueueMedia(media: Media | null | undefined) {
  return media?.mediaType === 'image' || media?.mediaType === 'video' || media?.mediaType === 'youtube';
}

async function rasterizePdfFile(
  filePath: string,
  toRenderUrl: (path: string) => string
) {
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const workerUrl = (await import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')).default;

  if (!GlobalWorkerOptions.workerSrc) {
    GlobalWorkerOptions.workerSrc = workerUrl;
  }

  const url = toRenderUrl(filePath);
  const arrayBuffer = await fetch(url).then((r) => r.arrayBuffer());
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  let width = 0;
  let height = 0;
  const buffers: ArrayBuffer[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    if (i === 1) {
      width = Math.round(viewport.width);
      height = Math.round(viewport.height);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');

    if (context) {
      await page.render({ canvas: canvas as unknown as HTMLCanvasElement, canvasContext: context, viewport }).promise;
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (blob) {
        buffers.push(await blob.arrayBuffer());
      }
    }

    page.cleanup();
  }

  await pdf.destroy();

  return { buffers, width, height };
}

/**
 * Frontend PDF Rasterizer
 * Reads PDF via browser pdfjs, converts to JPGs, and sends to the backend.
 */
export async function importPdfWithRasterizer(
  ipcMediaService: typeof import('../../core/services/ipcMediaService').ipcMediaService,
  toRenderUrl: (path: string) => string
): Promise<boolean> {
  const imported = await importPdfWithRasterizerDetailed(ipcMediaService, toRenderUrl);
  return imported.length > 0;
}

export async function importPdfWithRasterizerDetailed(
  ipcMediaService: typeof import('../../core/services/ipcMediaService').ipcMediaService,
  toRenderUrl: (path: string) => string
): Promise<Media[]> {
  const filePaths = await ipcMediaService.selectPdfFiles();
  if (!filePaths || filePaths.length === 0) return [];

  const imported: Media[] = [];

  for (const filePath of filePaths) {
    try {
      const { buffers, width, height } = await rasterizePdfFile(filePath, toRenderUrl);
      const filename = filePath.split('/').pop() || 'PDF Document';
      const media = await ipcMediaService.saveCompiledPdf({ filename, buffers, width, height });
      if (media) {
        imported.push(media as Media);
      }
    } catch (err) {
      console.error('[Frontend Rasterizer] Failed to compile PDF at path:', filePath, err);
    }
  }

  return imported;
}

export async function repairPdfMediaCache(
  media: Media,
  ipcMediaService: typeof import('../../core/services/ipcMediaService').ipcMediaService,
  toRenderUrl: (path: string) => string
): Promise<boolean> {
  if (media.mediaType !== 'pdf') return false;

  const current = getPdfPlaybackSettings(media);
  if (current.pageUrls.length > 0) return false;
  if (!media.filepath.endsWith('.pdf')) return false;

  try {
    const sourcePath = media.filepath.startsWith('file://')
      ? decodeURIComponent(media.filepath.replace('file://', ''))
      : media.filepath;
    const { buffers, width, height } = await rasterizePdfFile(sourcePath, toRenderUrl);
    await ipcMediaService.updateCompiledPdf({
      id: media.id,
      filename: media.filename,
      buffers,
      width,
      height,
    });
    return true;
  } catch (error) {
    console.error('[Frontend Rasterizer] Failed to repair PDF cache:', media.filepath, error);
    return false;
  }
}
