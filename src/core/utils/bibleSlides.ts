import type { EnrichedScheduleItem } from '../../electron/database/scheduleService';
import type {
  BibleContentPayload,
  BiblePresentationStyle,
  BibleVerseContent,
} from './biblePresentation';
import { buildLayersFromContentThemeData } from '../songEditor/songPresets';
import { formatBibleVerseLines } from './biblePresentation';

function parseBibleContent(raw: string | null): BibleContentPayload {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function deriveVersesFromPayload(payload: BibleContentPayload): BibleVerseContent[] {
  if (Array.isArray(payload.verses) && payload.verses.length > 0) {
    return payload.verses.filter(
      (item): item is BibleVerseContent =>
        !!item && Number.isFinite(item.verse) && typeof item.text === 'string' && item.text.trim().length > 0
    );
  }

  if (!payload.text) return [];

  return [
    {
      verse: payload.verseStart || 1,
      text: payload.text,
    },
  ];
}

function inferSlideCount(
  verses: BibleVerseContent[],
  style: Required<BiblePresentationStyle>,
): number {
  if (verses.length <= 1) return 1;

  const resizeDensityMultiplier =
    style.autoResizeMode === 'narrow' ? 1.28 : style.autoResizeMode === 'full' ? 0.88 : 1;
  const totalCharacters =
    verses.reduce((sum, item) => sum + item.text.length, 0) *
    style.textScale *
    resizeDensityMultiplier;
  const sectionCount = verses.reduce((count, item, index) => {
    if (!item.section) return count;
    if (index === 0 || item.section !== verses[index - 1].section) return count + 1;
    return count;
  }, 0);
  if (verses.length <= 2 && totalCharacters < 240) return 1;
  if (totalCharacters < 320 && verses.length <= 4) return 2;

  return Math.max(
    2,
    Math.min(verses.length, Math.max(sectionCount || 0, Math.ceil(totalCharacters / 210))),
  );
}

function getVerseWeight(verse: BibleVerseContent): number {
  const sectionWeight = verse.section ? 26 : 0;
  return verse.text.length + sectionWeight + 18;
}

function chunkVerses(
  verses: BibleVerseContent[],
  splitMode: BibleContentPayload['splitMode'],
  slideCount: number | null | undefined,
  style: Required<BiblePresentationStyle>,
): BibleVerseContent[][] {
  if (verses.length === 0) return [];

  if (splitMode === 'per-verse') {
    return verses.map((item) => [item]);
  }

  const desiredSlides =
    splitMode === 'fixed' && slideCount
      ? Math.max(1, Math.min(slideCount, verses.length))
      : inferSlideCount(verses, style);

  if (desiredSlides <= 1) return [verses];

  const chunks: BibleVerseContent[][] = [];
  let index = 0;
  const resizeDensityMultiplier =
    style.autoResizeMode === 'narrow' ? 1.24 : style.autoResizeMode === 'full' ? 0.9 : 1;
  let remainingWeight = verses.reduce(
    (sum, item) => sum + getVerseWeight(item) * style.textScale * resizeDensityMultiplier,
    0,
  );

  while (index < verses.length) {
    const remainingSlides = desiredSlides - chunks.length;
    const remainingVerses = verses.length - index;

    if (remainingSlides <= 1) {
      chunks.push(verses.slice(index));
      break;
    }

    const targetWeight = Math.max(1, Math.ceil(remainingWeight / remainingSlides));
    const targetVerses = Math.max(1, Math.ceil(remainingVerses / remainingSlides));
    const currentChunk: BibleVerseContent[] = [];
    let currentWeight = 0;
    let currentIndex = index;

    while (currentIndex < verses.length) {
      const verse = verses[currentIndex];
      const nextWeight = currentWeight + getVerseWeight(verse) * style.textScale * resizeDensityMultiplier;
      const nextVerse = verses[currentIndex + 1];
      currentChunk.push(verse);
      currentWeight = nextWeight;
      currentIndex += 1;

      const versesLeftAfterSplit = verses.length - currentIndex;
      const slidesLeftAfterSplit = remainingSlides - 1;
      const preserveMinimumForRemaining = versesLeftAfterSplit >= slidesLeftAfterSplit;
      const sectionBoundaryAhead =
        !!nextVerse &&
        nextVerse.section &&
        nextVerse.section !== verse.section;
      const reachedWeightTarget = currentWeight >= targetWeight * 0.9;
      const reachedVerseTarget = currentChunk.length >= targetVerses;

      if (!preserveMinimumForRemaining) {
        continue;
      }

      if (sectionBoundaryAhead && currentChunk.length > 0 && currentWeight >= targetWeight * 0.7) {
        break;
      }

      if (reachedWeightTarget || reachedVerseTarget) {
        break;
      }
    }

    chunks.push(currentChunk);
    remainingWeight -= currentWeight;
    index = currentIndex;
  }

  while (chunks.length > desiredSlides) {
    const tail = chunks.pop();
    if (!tail) break;
    chunks[chunks.length - 1].push(...tail);
  }

  return chunks;
}

function buildChunkReference(reference: string, verses: BibleVerseContent[]): string {
  if (verses.length === 0) return reference || 'Bible Reading';

  const baseReference = reference.includes(':') ? reference.split(':')[0] : reference;
  const start = verses[0].verse;
  const end = verses[verses.length - 1].verse;

  return `${baseReference}:${start}${end > start ? `-${end}` : ''}`;
}

function buildBodyScale(chunk: BibleVerseContent[], totalChunks: number): number {
  const characterCount = chunk.reduce((sum, item) => sum + item.text.length, 0);
  if (totalChunks >= 4) return 0.74;
  if (characterCount > 320) return 0.74;
  if (characterCount > 240) return 0.82;
  if (characterCount > 160) return 0.92;
  return 1;
}

function getChunkSection(chunk: BibleVerseContent[]): string | null {
  const section = chunk.find((item) => typeof item.section === 'string' && item.section.trim().length > 0)?.section;
  return section?.trim() || null;
}

function getBibleStyle(payload: BibleContentPayload): Required<BiblePresentationStyle> {
  const style = payload.style || {};

  return {
    layoutMode: style.layoutMode || 'fullscreen',
    backgroundMode: style.backgroundMode || 'solid',
    backgroundColor: style.backgroundColor || '#05070A',
    backgroundMediaId: style.backgroundMediaId || null,
    backgroundMediaPath: style.backgroundMediaPath || null,
    backgroundMediaType: style.backgroundMediaType || null,
    overlayOpacity: style.overlayOpacity ?? 0.44,
    textAlign: style.textAlign || 'center',
    verticalAlign: style.verticalAlign || 'middle',
    showReference: style.showReference ?? true,
    showVerseNumbers: style.showVerseNumbers ?? true,
    showVersionCode: style.showVersionCode ?? true,
    referencePosition: style.referencePosition || 'bottom',
    referenceAlign: style.referenceAlign || 'right',
    showSectionTitle: style.showSectionTitle ?? true,
    sectionDisplay: style.sectionDisplay || 'inline',
    textColor: style.textColor || '#FFFFFF',
    referenceColor: style.referenceColor || '#FACC15',
    versionColor: style.versionColor || '#CBD5E1',
    sectionColor: style.sectionColor || '#93C5FD',
    fontFamily: style.fontFamily || 'Manrope, Inter, sans-serif',
    textScale: style.textScale ?? 1,
    referenceScale: style.referenceScale ?? 1,
    referenceX: style.referenceX ?? null,
    referenceY: style.referenceY ?? null,
    autoResizeMode: style.autoResizeMode || 'off',
    maxVersesPerSlide: style.maxVersesPerSlide ?? null,
    contentX: style.contentX ?? 50,
    contentY: style.contentY ?? 56,
    contentWidth: style.contentWidth ?? 84,
    contentHeight: style.contentHeight ?? 52,
  };
}

function formatChunkText(chunk: BibleVerseContent[], showVerseNumbers: boolean): string {
  if (showVerseNumbers) {
    return formatBibleVerseLines(chunk);
  }

  return chunk.map((item) => item.text).join('\n');
}

function applyMaxVersesPerSlide(chunks: BibleVerseContent[][], maxVersesPerSlide: number | null): BibleVerseContent[][] {
  if (!maxVersesPerSlide || maxVersesPerSlide < 1) return chunks;
  const next: BibleVerseContent[][] = [];
  chunks.forEach((chunk) => {
    for (let index = 0; index < chunk.length; index += maxVersesPerSlide) {
      next.push(chunk.slice(index, index + maxVersesPerSlide));
    }
  });
  return next;
}

export function buildBibleVirtualSlides(item: EnrichedScheduleItem | null | undefined) {
  if (!item || item.itemType !== 'bible') return [];

  const payload = parseBibleContent(item.content || null);
  const verses = deriveVersesFromPayload(payload);
  const style = getBibleStyle(payload);

  const reference =
    payload.reference ||
    (item.bibleBook && item.bibleChapter && item.bibleVerseStart
      ? `${item.bibleBook} ${item.bibleChapter}:${item.bibleVerseStart}${item.bibleVerseEnd ? `-${item.bibleVerseEnd}` : ''}`
      : 'Bible Reading');

  const chunks = applyMaxVersesPerSlide(
    chunkVerses(verses, payload.splitMode, payload.slideCount, style),
    style.maxVersesPerSlide,
  );
  const effectiveChunks = chunks.length > 0 ? chunks : [[{ verse: payload.verseStart || 1, text: payload.text || 'No verse text available.' }]];
  const slides: any[] = [];

  let previousChunkSection: string | null = null;

  effectiveChunks.forEach((chunk, index) => {
    const chunkReference = buildChunkReference(reference, chunk);
    const chunkText = formatChunkText(chunk, style.showVerseNumbers);
    const chunkSection = getChunkSection(chunk);
    const isFirstChunkOfSection = !!chunkSection && chunkSection !== previousChunkSection;
    const slideId = `virtual-bible-${item.id}-${index + 1}`;
    const textAlign = style.textAlign;
    const baseBodyScale = buildBodyScale(chunk, effectiveChunks.length);
    const autoResizeScale =
      style.autoResizeMode === 'full'
        ? Math.max(0.82, baseBodyScale * 0.96)
        : style.autoResizeMode === 'narrow'
        ? Math.max(0.72, baseBodyScale * 0.88)
        : baseBodyScale;
    const bodyScale = autoResizeScale * style.textScale;
    const textBoxWidth =
      style.autoResizeMode === 'full'
        ? textAlign === 'left'
          ? 82
          : 90
        : style.autoResizeMode === 'narrow'
        ? textAlign === 'left'
          ? 58
          : 64
        : textAlign === 'left'
        ? 76
        : chunkText.length > 240
        ? 88
        : 84;
    const textBoxHeight =
      style.layoutMode === 'lower-third'
        ? 22
        : style.autoResizeMode === 'full'
        ? 58
        : style.autoResizeMode === 'narrow'
        ? 48
        : 52;
    const textX = 50;
    const lowerThird = style.layoutMode === 'lower-third';
    const referenceBaseY = lowerThird
      ? style.referencePosition === 'top' ? 70 : 91
      : style.referencePosition === 'top' ? 12 : 91;
    const referenceAlign = style.referenceAlign;
    const referenceX =
      style.referenceX ??
      (referenceAlign === 'left' ? 12 : referenceAlign === 'center' ? 50 : 87);
    const referenceY = style.referenceY ?? referenceBaseY;
    const referenceBoxWidth = referenceAlign === 'center' ? 46 : 22;
    const sectionY = lowerThird ? 71 : style.referencePosition === 'top' ? 20 : 23;
    const bodyY = lowerThird
      ? 82
      : style.verticalAlign === 'top'
      ? style.showReference && style.referencePosition === 'top' ? 34 : 28
      : style.verticalAlign === 'bottom'
      ? style.showReference && style.referencePosition === 'bottom' ? 72 : 76
      : style.showReference
        ? style.referencePosition === 'top'
          ? 54
          : chunkSection && style.showSectionTitle
          ? 59
          : 56
        : chunkSection && style.showSectionTitle
        ? 53
        : 50;
    const effectiveContentWidth =
      style.contentWidth ?? (lowerThird ? (textAlign === 'left' ? 74 : 78) : textBoxWidth);
    const effectiveContentHeight = style.contentHeight ?? textBoxHeight;
    const effectiveContentX = style.contentX ?? textX;
    const effectiveContentY = style.contentY ?? bodyY;

    if (!payload.contentThemeLayersData && style.showSectionTitle && style.sectionDisplay === 'slide' && isFirstChunkOfSection && chunkSection) {
      const sectionSlideId = `${slideId}-section`;
      const sectionLayers = [];

      if (style.backgroundMode === 'media' && style.backgroundMediaPath) {
        sectionLayers.push({
          id: `layer-bible-section-bg-${item.id}-${index + 1}`,
          slideId: sectionSlideId,
          layerType: 'background',
          layerOrder: 1,
          visible: true,
          opacity: 1,
          content: style.backgroundMediaPath,
          mediaId: style.backgroundMediaId,
          style: JSON.stringify({
            source: style.backgroundMediaPath,
            mediaType: style.backgroundMediaType || undefined,
            objectFit: 'cover',
          }),
          transition: null,
        });
      }

      sectionLayers.push(
        {
          id: `layer-bible-section-base-${item.id}-${index + 1}`,
          slideId: sectionSlideId,
          layerType: 'base',
          layerOrder: style.backgroundMode === 'media' ? 2 : 1,
          visible: true,
          opacity: 1,
          content:
            style.backgroundMode === 'media'
              ? `rgba(5, 7, 10, ${style.overlayOpacity})`
              : style.backgroundColor,
          mediaId: null,
          style: null,
          transition: null,
        },
        {
          id: `layer-bible-section-title-${item.id}-${index + 1}`,
          slideId: sectionSlideId,
          layerType: 'text',
          layerOrder: 5,
          visible: true,
          opacity: 1,
          content: chunkSection,
          mediaId: null,
          style: JSON.stringify({
            x: textAlign === 'left' ? 14 : 50,
            y: 50,
            boxWidth: textAlign === 'left' ? 74 : 78,
            scale: Math.max(1.1, 1.2 * style.textScale),
            textAlign,
            color: style.sectionColor,
            fontWeight: '700',
            fontFamily: style.fontFamily,
            shadow: true,
          }),
          transition: null,
        },
      );

      slides.push({
        id: sectionSlideId,
        type: 'bible',
        content: `${reference}\n\n${chunkSection}`,
        label: `Section ${index + 1}`,
        sectionType: 'Bible Section',
        layers: sectionLayers,
      });
    }

    const layers = [];

    if (style.backgroundMode === 'media' && style.backgroundMediaPath) {
      layers.push({
        id: `layer-bible-bg-${item.id}-${index + 1}`,
        slideId,
        layerType: 'background',
        layerOrder: 1,
        visible: true,
        opacity: 1,
        content: style.backgroundMediaPath,
        mediaId: style.backgroundMediaId,
        style: JSON.stringify({
          source: style.backgroundMediaPath,
          mediaType: style.backgroundMediaType || undefined,
          objectFit: 'cover',
        }),
        transition: null,
      });
    }

    layers.push(
      {
        id: `layer-bible-base-${item.id}-${index + 1}`,
        slideId,
        layerType: 'base',
        layerOrder: style.backgroundMode === 'media' ? 2 : 1,
        visible: true,
        opacity: 1,
        content:
          lowerThird
            ? `rgba(5, 7, 10, ${Math.max(0.28, style.overlayOpacity)})`
            : style.backgroundMode === 'media'
            ? `rgba(5, 7, 10, ${style.overlayOpacity})`
            : style.backgroundColor,
        mediaId: null,
        style: null,
        transition: null,
      },
      {
        id: `layer-bible-section-${item.id}-${index + 1}`,
        slideId,
        layerType: 'text',
        layerOrder: 3,
        visible: style.showSectionTitle && style.sectionDisplay === 'inline' && isFirstChunkOfSection && !!chunkSection,
        opacity: 1,
        content: chunkSection,
        mediaId: null,
        style: JSON.stringify({
          x: referenceX,
          y: sectionY,
          boxWidth: textAlign === 'left' ? 76 : 82,
          sizingMode: 'auto',
          scale: 0.44,
          textAlign,
          color: style.sectionColor,
          fontWeight: '600',
          fontFamily: style.fontFamily,
          shadow: true,
        }),
        transition: null,
      },
      {
        id: `layer-bible-reference-${item.id}-${index + 1}`,
        slideId,
        layerType: 'text',
        layerOrder: 4,
        visible: style.showReference,
        opacity: 1,
        content: chunkReference,
        mediaId: null,
        style: JSON.stringify({
          x: referenceX,
          y: referenceY,
          boxWidth: referenceBoxWidth,
          sizingMode: 'auto',
          scale: 0.58 * style.referenceScale,
          textAlign: referenceAlign,
          color: style.referenceColor,
          fontWeight: '700',
          fontFamily: style.fontFamily,
          shadow: true,
        }),
        transition: null,
      },
      {
        id: `layer-bible-text-${item.id}-${index + 1}`,
        slideId,
        layerType: 'text',
        layerOrder: 5,
        visible: true,
        opacity: 1,
        content: chunkText,
        mediaId: null,
        style: JSON.stringify({
          x: effectiveContentX,
          y: effectiveContentY,
          sizingMode: style.autoResizeMode === 'off' ? 'auto' : 'fixed',
          boxWidth: effectiveContentWidth,
          boxHeight: effectiveContentHeight,
          allowWrap: true,
          scale: bodyScale,
          textAlign,
          color: style.textColor,
          fontWeight: '600',
          fontFamily: style.fontFamily,
          shadow: true,
        }),
        transition: null,
      },
      {
        id: `layer-bible-version-${item.id}-${index + 1}`,
        slideId,
        layerType: 'text',
        layerOrder: 6,
        visible: style.showVersionCode && !!payload.versionCode,
        opacity: 1,
        content: payload.versionCode || '',
        mediaId: null,
        style: JSON.stringify({
          x: lowerThird ? 12 : 12,
          y: lowerThird ? 91 : style.referencePosition === 'top' ? 12 : 91,
          boxWidth: 16,
          sizingMode: 'auto',
          scale: 0.42 * style.referenceScale,
          textAlign: 'left',
          color: style.versionColor,
          fontWeight: '700',
          fontFamily: style.fontFamily,
          shadow: true,
        }),
        transition: null,
      },
    );

    const resolvedLayers = payload.contentThemeLayersData
      ? buildLayersFromContentThemeData(slideId, chunkText, payload.contentThemeLayersData, {
          scriptureText: chunkText,
          scriptureReference: chunkReference,
          scriptureVersion: payload.versionCode || '',
          sectionLabel: chunkSection || '',
        })
      : layers;

    slides.push({
      id: slideId,
      type: 'bible',
      content: `${chunkReference}\n\n${chunkText}`,
      label: effectiveChunks.length > 1 ? `Bible ${index + 1}/${effectiveChunks.length}` : 'Bible',
      sectionType: 'Bible',
      scriptureText: chunkText,
      scriptureReference: chunkReference,
      versionCode: payload.versionCode || '',
      layers: resolvedLayers,
      contentThemeId: payload.contentThemeId || null,
      contentThemeName: payload.contentThemeName || null,
    });

    previousChunkSection = chunkSection;
  });

  return slides;
}
