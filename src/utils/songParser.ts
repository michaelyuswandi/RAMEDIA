export interface ParsedSongSection {
  type: string;
  number: number | null;
  content: string;
}

function normalizeSectionType(rawType: string) {
  const normalized = rawType.trim().toUpperCase().replace(/[\s_-]+/g, '');

  switch (normalized) {
    case 'V':
    case 'VERSE':
      return 'verse';
    case 'C':
    case 'CHORUS':
    case 'REF':
    case 'REFF':
    case 'REFRAIN':
      return 'chorus';
    case 'B':
    case 'BRIDGE':
      return 'bridge';
    case 'PRECHORUS':
      return 'pre_chorus';
    case 'I':
    case 'INTRO':
      return 'intro';
    case 'O':
    case 'OUTRO':
    case 'ENDING':
      return 'outro';
    case 'TAG':
      return 'tag';
    default:
      return rawType.trim().toLowerCase().replace(/[\s-]+/g, '_') || 'verse';
  }
}

export function parseSongLyrics(text: string): ParsedSongSection[] {
  const sections = text.split(/\n\n+/).filter((section) => section.trim());

  return sections.map((section) => {
    const match = section.match(/^\[([A-Z][A-Z\s_-]*?)(?:\s+(\d+))?\]/i);

    let type = 'verse';
    let number: number | null = null;

    if (match) {
      type = normalizeSectionType(match[1]);
      number = match[2] ? parseInt(match[2], 10) : null;
    }

    const content = section.replace(/^\[.*?\]\s*\n?/, '').trim();

    return { type, number, content };
  });
}
