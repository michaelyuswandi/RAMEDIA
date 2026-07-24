import type { Slide } from '../models/types';

export const MOCK_SLIDES: Slide[] = [
  { id: '1', type: 'lyrics', content: 'Amazing grace how sweet the sound\nThat saved a wretch like me', label: 'Verse 1' },
  { id: '2', type: 'lyrics', content: 'I once was lost but now am found\nWas blind but now I see', label: 'Verse 2' },
  { id: '3', type: 'lyrics', content: 'Through many dangers toils and snares\nI have already come', label: 'Verse 3' },
  { id: '4', type: 'lyrics', content: 'When we\'ve been there ten thousand years\nBright shining as the sun', label: 'Verse 4' },
  { id: 'c1', type: 'lyrics', content: 'My chains are gone\nI\'ve been set free\nMy God, my Savior has ransomed me', label: 'Chorus' },
];
