import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BroadcastLyricsSettings } from '../../core/models/outputSettings';
import type { Slide } from '../../core/models/types';

interface BroadcastLyricsSurfaceProps {
  slide: Slide | null;
  settings: BroadcastLyricsSettings;
  hidden: boolean;
}

function clampLineCount(text: string, maxLines: number) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, maxLines)
    .join('\n');
}

export function BroadcastLyricsSurface({ slide, settings, hidden }: BroadcastLyricsSurfaceProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLDivElement | null>(null);
  const [fontSize, setFontSize] = useState(settings.maxFontSize);
  const content = useMemo(
    () => clampLineCount(slide?.type === 'lyrics' ? slide.content : '', settings.maxLines),
    [slide?.content, slide?.type, settings.maxLines],
  );

  useLayoutEffect(() => {
    const box = boxRef.current;
    const text = textRef.current;
    if (!box || !text || !content) return;

    const fit = () => {
      let low = Math.min(settings.minFontSize, settings.maxFontSize);
      let high = Math.max(settings.minFontSize, settings.maxFontSize);
      let best = low;
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = (low + high) / 2;
        text.style.fontSize = `${candidate}px`;
        const fits = text.scrollHeight <= box.clientHeight + 1 && text.scrollWidth <= box.clientWidth + 1;
        if (fits) {
          best = candidate;
          low = candidate;
        } else {
          high = candidate;
        }
      }
      setFontSize(Math.floor(best));
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [content, settings.minFontSize, settings.maxFontSize, settings.fontFamily, settings.fontWeight]);

  if (hidden || !content) return <div className="h-full w-full bg-transparent" />;

  const justifyContent = settings.verticalAlign === 'top'
    ? 'flex-start'
    : settings.verticalAlign === 'bottom'
      ? 'flex-end'
      : 'center';

  return (
    <div className="relative h-full w-full overflow-hidden bg-transparent">
      <div
        className="absolute overflow-hidden"
        style={{
          left: `${settings.x}%`,
          top: `${settings.y}%`,
          width: `${settings.width}%`,
          height: `${settings.height}%`,
          padding: `${settings.padding}%`,
        }}
      >
        <div ref={boxRef} className="flex h-full min-h-0 w-full flex-col overflow-hidden" style={{ justifyContent }}>
          {settings.showSectionLabel && (slide?.sectionType || slide?.label) ? (
            <div
              className="mb-[0.55em] font-semibold uppercase tracking-[0.16em] opacity-80"
              style={{
                color: settings.color,
                fontFamily: settings.fontFamily,
                fontSize: `${Math.max(13, fontSize * 0.31)}px`,
                textAlign: settings.textAlign,
              }}
            >
              {slide.sectionType || slide.label}
            </div>
          ) : null}
          <div
            ref={textRef}
            className="whitespace-pre-wrap break-words"
            style={{
              color: settings.color,
              fontFamily: settings.fontFamily,
              fontSize: `${fontSize}px`,
              fontWeight: settings.fontWeight,
              lineHeight: 1.08,
              textAlign: settings.textAlign,
              WebkitTextStroke: settings.outlineSize > 0 ? `${settings.outlineSize}px ${settings.outlineColor}` : undefined,
              paintOrder: 'stroke fill',
              textShadow: settings.shadow ? '0 3px 12px rgba(0,0,0,0.78)' : undefined,
            }}
          >
            {content}
          </div>
        </div>
      </div>
    </div>
  );
}
