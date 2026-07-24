import { create } from 'zustand';

export interface SlideLabelSetting {
  id: string;
  sectionType: string;
  label: string;
  backgroundColor: string;
  textColor: string;
  shortcut: string;
}

const STORAGE_KEY = 'rumedia_slide_labels_v1';

export const DEFAULT_SLIDE_LABELS: SlideLabelSetting[] = [
  { id: 'verse', sectionType: 'verse', label: 'Verse', backgroundColor: '#315ea8', textColor: '#f8fafc', shortcut: 'V' },
  { id: 'chorus', sectionType: 'chorus', label: 'Chorus', backgroundColor: '#a54562', textColor: '#fff7f9', shortcut: 'H' },
  { id: 'bridge', sectionType: 'bridge', label: 'Bridge', backgroundColor: '#7550a4', textColor: '#faf5ff', shortcut: 'G' },
  { id: 'pre-chorus', sectionType: 'pre_chorus', label: 'Pre-Chorus', backgroundColor: '#984f71', textColor: '#fff7fb', shortcut: 'R' },
  { id: 'intro', sectionType: 'intro', label: 'Intro', backgroundColor: '#2f7a55', textColor: '#f0fdf4', shortcut: 'I' },
  { id: 'outro', sectionType: 'outro', label: 'Ending', backgroundColor: '#a84c32', textColor: '#fff7ed', shortcut: 'E' },
  { id: 'interlude', sectionType: 'interlude', label: 'Interlude', backgroundColor: '#3b579d', textColor: '#eff6ff', shortcut: '' },
  { id: 'tag', sectionType: 'tag', label: 'Tag', backgroundColor: '#7a3d82', textColor: '#fdf4ff', shortcut: 'T' },
  { id: 'vamp', sectionType: 'vamp', label: 'Vamp', backgroundColor: '#38548e', textColor: '#eff6ff', shortcut: '' },
  { id: 'misc', sectionType: 'misc', label: 'Misc', backgroundColor: '#4a6595', textColor: '#f8fafc', shortcut: 'M' },
  { id: 'slide', sectionType: 'slide', label: 'Slide', backgroundColor: '#475569', textColor: '#f8fafc', shortcut: '' },
];

function loadLabels(): SlideLabelSetting[] {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_SLIDE_LABELS;
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_SLIDE_LABELS;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : DEFAULT_SLIDE_LABELS;
  } catch {
    return DEFAULT_SLIDE_LABELS;
  }
}

interface SlideLabelSettingsState {
  labels: SlideLabelSetting[];
  setLabels: (labels: SlideLabelSetting[]) => void;
  resetToDefaults: () => void;
}

export const useSlideLabelSettingsStore = create<SlideLabelSettingsState>((set) => ({
  labels: loadLabels(),
  setLabels: (labels) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(labels));
    set({ labels });
  },
  resetToDefaults: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SLIDE_LABELS));
    set({ labels: DEFAULT_SLIDE_LABELS });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) {
      useSlideLabelSettingsStore.setState({ labels: loadLabels() });
    }
  });
}

export function normalizeSectionType(value: unknown): string {
  return String(value || 'slide').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export function findSlideLabel(labels: SlideLabelSetting[], slide: any): SlideLabelSetting | null {
  const rawValue = slide?.sectionType || slide?.label || 'slide';
  const sectionType = normalizeSectionType(rawValue);
  const withoutNumber = sectionType.replace(/_?\d+$/, '');
  return labels.find((item) => {
    const configuredType = normalizeSectionType(item.sectionType);
    const configuredLabel = normalizeSectionType(item.label);
    return configuredType === sectionType
      || configuredType === withoutNumber
      || configuredLabel === sectionType
      || configuredLabel === withoutNumber;
  }) || null;
}

export function formatSlideLabel(labels: SlideLabelSetting[], slide: any, fallback = 'Slide'): string {
  const setting = findSlideLabel(labels, slide);
  const base = setting?.label || slide?.sectionType || slide?.label || fallback;
  return `${base}${slide?.sectionNumber ? ` ${slide.sectionNumber}` : ''}`;
}
