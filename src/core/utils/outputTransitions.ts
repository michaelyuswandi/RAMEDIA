import type { OutputTransitionSettings } from '../models/outputSettings';

function axisOffset(direction: OutputTransitionSettings['direction'], amount: number | string) {
  const negativeAmount = typeof amount === 'number' ? -amount : `-${amount}`;
  if (direction === 'right') return { x: negativeAmount, y: 0 };
  if (direction === 'up') return { x: 0, y: amount };
  if (direction === 'down') return { x: 0, y: negativeAmount };
  return { x: amount, y: 0 };
}

function oppositeDirection(direction: OutputTransitionSettings['direction']): OutputTransitionSettings['direction'] {
  if (direction === 'right') return 'left';
  if (direction === 'up') return 'down';
  if (direction === 'down') return 'up';
  return 'right';
}

function revealClip(direction: OutputTransitionSettings['direction']) {
  if (direction === 'right') return 'inset(0 100% 0 0)';
  if (direction === 'up') return 'inset(100% 0 0 0)';
  if (direction === 'down') return 'inset(0 0 100% 0)';
  return 'inset(0 0 0 100%)';
}

export function getOutputTransitionMotion(settings?: OutputTransitionSettings): {
  initial: any;
  animate: any;
  exit: any;
  transition: any;
  style?: any;
} {
  const type = settings?.type || 'blend';
  const duration = Math.max(0.01, (settings?.durationMs ?? 220) / 1000);
  const ease = settings?.easing || 'easeOut';
  const direction = settings?.direction || 'left';
  const offset = axisOffset(direction, '100%');
  const reverseOffset = axisOffset(oppositeDirection(direction), '100%');
  const transition = { duration, ease };

  switch (type) {
    case 'none':
      return { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0.01 } };
    case 'cover':
      return {
        initial: { opacity: 1, ...offset },
        animate: { opacity: 1, x: 0, y: 0 },
        exit: { opacity: 1, x: 0, y: 0 },
        transition,
      };
    case 'cube': {
      const vertical = direction === 'up' || direction === 'down';
      const sign = direction === 'right' || direction === 'down' ? -1 : 1;
      return {
        initial: { opacity: 0.35, rotateY: vertical ? 0 : 88 * sign, rotateX: vertical ? -88 * sign : 0, scale: 0.82 },
        animate: { opacity: 1, rotateY: 0, rotateX: 0, scale: 1 },
        exit: { opacity: 0.25, rotateY: vertical ? 0 : -88 * sign, rotateX: vertical ? 88 * sign : 0, scale: 0.82 },
        transition,
        style: { transformPerspective: 1200, transformOrigin: direction === 'right' ? 'right center' : direction === 'up' ? 'center top' : direction === 'down' ? 'center bottom' : 'left center' },
      };
    }
    case 'drop':
      return {
        initial: { opacity: 0, y: direction === 'up' ? '100%' : '-100%', scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: direction === 'up' ? -35 : 35, scale: 0.98 },
        transition,
      };
    case 'iris':
      return {
        initial: { opacity: 1, clipPath: 'circle(0% at 50% 50%)' },
        animate: { opacity: 1, clipPath: 'circle(75% at 50% 50%)' },
        exit: { opacity: 1, clipPath: 'circle(0% at 50% 50%)' },
        transition,
      };
    case 'page-flip': {
      const vertical = direction === 'up' || direction === 'down';
      const sign = direction === 'right' || direction === 'down' ? -1 : 1;
      return {
        initial: { opacity: 0.25, rotateY: vertical ? 0 : 105 * sign, rotateX: vertical ? -105 * sign : 0 },
        animate: { opacity: 1, rotateY: 0, rotateX: 0 },
        exit: { opacity: 0.15, rotateY: vertical ? 0 : -105 * sign, rotateX: vertical ? 105 * sign : 0 },
        transition,
        style: { transformPerspective: 1500, transformOrigin: direction === 'right' ? 'right center' : direction === 'up' ? 'center top' : direction === 'down' ? 'center bottom' : 'left center', backfaceVisibility: 'hidden' as const },
      };
    }
    case 'push':
    case 'slide':
      return {
        initial: { opacity: 1, ...offset },
        animate: { opacity: 1, x: 0, y: 0 },
        exit: { opacity: 1, ...reverseOffset },
        transition,
      };
    case 'reveal':
      return {
        initial: { opacity: 1, clipPath: revealClip(direction) },
        animate: { opacity: 1, clipPath: 'inset(0 0 0 0)' },
        exit: { opacity: 1, clipPath: revealClip(direction) },
        transition,
      };
    case 'zoom':
      return {
        initial: { opacity: 0, scale: 0.82 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.12 },
        transition,
      };
    case 'fade':
    case 'blend':
    default:
      return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition,
      };
  }
}
