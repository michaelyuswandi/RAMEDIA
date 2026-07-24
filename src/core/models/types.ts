export type SlideType = 'lyrics' | 'bible' | 'image' | 'video' | 'media' | 'custom';

export interface StyleProps {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  shadow?: boolean;
  alignment?: 'left' | 'center' | 'right';
  background?: string; // Color or Media ID
}

export interface Slide {
  id: string;
  type: SlideType;
  content: string; // Text content or Media URL
  label?: string; // "Verse 1", "Chorus"
  sectionType?: string; // Shared property for categorization
  notes?: string;
  style?: StyleProps;
}

export interface Presentation {
  id: string;
  title: string;
  author?: string;
  slides: Slide[];
  themeId?: string;
}

export interface LayerState {
  id: string;
  zIndex: number;
  type: 'background' | 'media' | 'overlay' | 'text';
  visible: boolean;
  opacity: number;
  content?: string;
  data?: any;
}

export interface PointerState {
  enabled: boolean;
  visible: boolean;
  x: number;
  y: number;
}

export type TransitionMode = 'fade' | 'slide' | 'zoom' | 'none';

export type CaptureSourceType = 'screen' | 'window' | 'device';

export interface LiveCaptureState {
  active: boolean;
  sourceType: CaptureSourceType | null;
  sourceId: string | null;
  sourceName: string | null;
  includeAudio: boolean;
  startedAt: string | null;
  error: string | null;
}

export interface MediaPlaybackState {
  mediaId: string | null;
  status: 'paused' | 'playing' | 'stopped';
  currentTime: number;
  duration?: number;
  volume: number;
  playbackRate: number;
  behavior: 'loop' | 'stop' | 'hold';
  commandId: string;
  updatedAt: number;
}

export type OutputAlertTone = 'info' | 'warning' | 'emergency' | 'neutral';

export interface OutputAlertMessage {
  id: string;
  text: string;
  tone: OutputAlertTone;
  targetOutputIds: string[];
  position: 'top' | 'bottom';
  durationMs: number | null;
  createdAt: number;
  expiresAt: number | null;
}

export const EMPTY_LIVE_CAPTURE_STATE: LiveCaptureState = {
  active: false,
  sourceType: null,
  sourceId: null,
  sourceName: null,
  includeAudio: false,
  startedAt: null,
  error: null,
};

export interface AnnotationPoint {
  x: number;
  y: number;
}

export interface AnnotationBase {
  id: string;
  color: string;
}

export interface LineAnnotation extends AnnotationBase {
  type: 'line';
  from: AnnotationPoint;
  to: AnnotationPoint;
  width: number;
}

export interface PathAnnotation extends AnnotationBase {
  type: 'pen' | 'highlighter';
  points: AnnotationPoint[];
  width: number;
}

export interface TextAnnotation extends AnnotationBase {
  type: 'text';
  x: number;
  y: number;
  text: string;
  size: number;
}

export type SlideAnnotation = LineAnnotation | PathAnnotation | TextAnnotation;
