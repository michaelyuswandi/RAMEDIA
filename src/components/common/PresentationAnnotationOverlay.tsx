import type { SlideAnnotation } from '../../core/models/types';

interface PresentationAnnotationOverlayProps {
  annotations: SlideAnnotation[];
}

function pointsToPolyline(points: { x: number; y: number }[]) {
  return points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ');
}

export function PresentationAnnotationOverlay({
  annotations,
}: PresentationAnnotationOverlayProps) {
  if (!annotations.length) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {annotations.map((annotation) => {
          if (annotation.type === 'line') {
            return (
              <line
                key={annotation.id}
                x1={annotation.from.x * 100}
                y1={annotation.from.y * 100}
                x2={annotation.to.x * 100}
                y2={annotation.to.y * 100}
                stroke={annotation.color}
                strokeWidth={annotation.width}
                strokeLinecap="round"
              />
            );
          }

          if (annotation.type === 'pen' || annotation.type === 'highlighter') {
            return (
              <polyline
                key={annotation.id}
                points={pointsToPolyline(annotation.points)}
                fill="none"
                stroke={annotation.color}
                strokeWidth={annotation.width}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={annotation.type === 'highlighter' ? 0.55 : 1}
              />
            );
          }

          return null;
        })}
      </svg>

      {annotations
        .filter((annotation) => annotation.type === 'text')
        .map((annotation) => (
          <div
            key={annotation.id}
            className="absolute max-w-[42%] whitespace-pre-wrap rounded-lg border border-white/12 bg-black/28 px-2 py-1 font-semibold shadow-[0_10px_30px_rgba(0,0,0,0.24)] backdrop-blur-sm"
            style={{
              left: `${annotation.x * 100}%`,
              top: `${annotation.y * 100}%`,
              transform: 'translate(-8%, -15%)',
              color: annotation.color,
              fontSize: `${annotation.size}px`,
            }}
          >
            {annotation.text}
          </div>
        ))}
    </div>
  );
}
