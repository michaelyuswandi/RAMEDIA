import type { CSSProperties } from 'react';
import {
  findSlideLabel,
  formatSlideLabel,
  useSlideLabelSettingsStore,
} from '../../core/stores/useSlideLabelSettingsStore';

interface SlideLabelBadgeProps {
  slide: any;
  fallback?: string;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

export function SlideLabelBadge({ slide, fallback = 'Slide', className = '', style, title }: SlideLabelBadgeProps) {
  const labels = useSlideLabelSettingsStore((state) => state.labels);
  const setting = findSlideLabel(labels, slide);
  const backgroundColor = setting?.backgroundColor || '#475569';
  const color = setting?.textColor || '#f8fafc';

  return (
    <span
      className={`inline-flex max-w-full items-center rounded-md font-bold ${className}`}
      style={{ backgroundColor, color, ...style }}
      title={title || formatSlideLabel(labels, slide, fallback)}
    >
      {formatSlideLabel(labels, slide, fallback)}
    </span>
  );
}
