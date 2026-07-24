/**
 * Browser-compatible Song Service using local state (for web development)
 * In Electron production, this would be replaced with actual SQLite
 */

import type { Song, Slide, SlideLayer } from './schema';

interface ParsedSection {
  type: string;
  number: number | null;
  content: string;
}

// Generate UUID
function generateId(): string {
  return crypto.randomUUID();
}

// Parse lyrics text into sections
export function parseLyrics(text: string): ParsedSection[] {
  // Split by blank lines
  const sections = text.split(/\n\n+/).filter(s => s.trim());
  
  return sections.map(section => {
    // Match section markers like [VERSE 1], [CHORUS], [V1], [C], etc.
    const match = section.match(/^\[(VERSE|CHORUS|BRIDGE|INTRO|OUTRO|V|C|B|REFF)\s*(\d*)\]/i);
    
    let type = 'verse';
    let number: number | null = null;
    
    if (match) {
      const rawType = match[1].toUpperCase();
      switch (rawType) {
        case 'V': type = 'verse'; break;
        case 'C': case 'REFF': type = 'chorus'; break;
        case 'B': type = 'bridge'; break;
        default: type = rawType.toLowerCase();
      }
      number = match[2] ? parseInt(match[2]) : null;
    }
    
    const content = section.replace(/^\[.*?\]\s*\n?/, '').trim();
    
    return { type, number, content };
  });
}

// Create default 4 FIXED layers for a slide
export function createDefaultLayers(slideId: string, textContent: string): SlideLayer[] {
  return [
    // 1. Base (Bottom) - Color or basic background
    { id: generateId(), slideId, layerType: 'base', layerOrder: 1, content: '#000000', visible: true, opacity: 1, mediaId: null, style: null, transition: null },
    // 2. Media - Video or Image background
    { id: generateId(), slideId, layerType: 'media', layerOrder: 2, content: null, visible: true, opacity: 1, mediaId: null, style: null, transition: null },
    // 3. Text - Main Content (with new dual-mode styling)
    { id: generateId(), slideId, layerType: 'text', layerOrder: 3, content: textContent, visible: true, opacity: 1, mediaId: null, style: JSON.stringify({ 
      // Position
      x: 50, y: 50, rotation: 0,
      // Sizing Mode: 'auto' = box fits text, 'fixed' = text fits box
      sizingMode: 'auto',
      // Fixed Box dimensions (% of container, used when sizingMode='fixed')
      boxWidth: 80, boxHeight: 40,
      // Text behavior
      allowWrap: true,
      // Font limits (cqw units)
      minFontSize: 1.0, maxFontSize: 8.0,
      // Font styling
      scale: 1.0, color: '#ffffff', textAlign: 'center',
      fontFamily: 'Inter, sans-serif', fontWeight: 'bold', fontStyle: 'normal',
      textDecoration: 'none', shadow: true
    }), transition: null },
    // 4. Overlay (Top) - Logos, etc.
    { id: generateId(), slideId, layerType: 'overlay', layerOrder: 4, content: null, visible: true, opacity: 1, mediaId: null, style: null, transition: null },
  ];
}

export interface SongWithSlides extends Song {
  slides: (Slide & { layers: SlideLayer[] })[];
}

// In-memory store
let songsStore: SongWithSlides[] = [];
let initialized = false;

// Initialize with sample data
function initStore() {
  if (initialized) return;
  
  const sampleSongs = [
    {
      title: 'Amazing Grace (My Chains Are Gone)',
      author: 'Chris Tomlin',
      rawLyrics: `[VERSE 1]
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now am found
Was blind but now I see

[VERSE 2]
'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed

[CHORUS]
My chains are gone I've been set free
My God, my Savior has ransomed me
And like a flood His mercy rains
Unending love, Amazing grace

[VERSE 3]
The Lord has promised good to me
His word my hope secures
He will my shield and portion be
As long as life endures

[VERSE 4]
The earth shall soon dissolve like snow
The sun forbear to shine
But God, who called me here below
Will be forever mine
Will be forever mine
You are forever mine`
    },
    {
      title: '10,000 Reasons (Bless the Lord)',
      author: 'Matt Redman',
      rawLyrics: `[CHORUS]
Bless the Lord O my soul
O my soul
Worship His Holy name
Sing like never before
O my soul
I'll worship Your Holy name

[VERSE 1]
The sun comes up
It's a new day dawning
It's time to sing Your song again
Whatever may pass
And whatever lies before me
Let me be singing
When the evening comes

[VERSE 2]
You're rich in love
And You're slow to anger
Your name is great
And Your heart is kind
For all Your goodness
I will keep on singing
Ten thousand reasons
For my heart to find

[VERSE 3]
And on that day
When my strength is failing
The end draws near
And my time has come
Still my soul will
Sing Your praise unending
Ten thousand years
And then forevermore`
    },
    {
      title: 'Way Maker',
      author: 'Sinach',
      rawLyrics: `[VERSE 1]
You are here moving in our midst
I worship You I worship You
You are here working in this place
I worship You I worship You

[CHORUS]
Way Maker, Miracle Worker, Promise Keeper
Light in the darkness my God that is who You are
Way Maker, Miracle Worker, Promise Keeper
Light in the darkness my God that is who You are

[VERSE 2]
You are here touching every heart
I worship You I worship You
You are here healing every heart
I worship You I worship You

[VERSE 3]
You are here turning lives around
I worship You I worship You
You are here mending every heart
I worship You I worship You

[BRIDGE]
Even when I don't see it You're working
Even when I don't feel it You're working
You never stop, You never stop working
You never stop, You never stop working`
    },
    {
      title: 'What A Beautiful Name',
      author: 'Hillsong Worship',
      rawLyrics: `[VERSE 1]
You were the Word at the beginning
One with God the Lord Most High
Your hidden glory in creation
Now revealed in You our Christ

[CHORUS 1]
What a beautiful Name it is
What a beautiful Name it is
The Name of Jesus Christ my King
What a beautiful Name it is
Nothing compares to this
What a beautiful Name it is
The Name of Jesus

[VERSE 2]
You didn't want heaven without us
So Jesus You brought heaven down
My sin was great Your love was greater
What could separate us now

[CHORUS 2]
What a wonderful Name it is
What a wonderful Name it is
The Name of Jesus Christ my King
What a wonderful Name it is
Nothing compares to this
What a wonderful Name it is
The Name of Jesus

[BRIDGE]
Death could not hold You
The veil tore before You
You silence the boast of sin and grave
The heavens are roaring
The praise of Your glory
For You are raised to life again`
    },
    {
      title: 'Goodness of God',
      author: 'Bethel Music',
      rawLyrics: `[VERSE 1]
I love You Lord
Oh Your mercy never fails me
All my days
I've been held in Your hands
From the moment that I wake up
Until I lay my head
I will sing of the goodness of God

[CHORUS]
All my life You have been faithful
All my life You have been so, so good
With every breath that I am able
I will sing of the goodness of God

[VERSE 2]
I love Your voice
You have led me through the fire
In darkest night
You are close like no other
I've known You as a father
I've known You as a friend
I have lived in the goodness of God

[BRIDGE]
Your goodness is running after, it's running after me
Your goodness is running after, it's running after me
With my life laid down, I'm surrendered now
I give You everything
Your goodness is running after, it's running after me`
    },
    {
      title: 'Oceans (Where Feet May Fail)',
      author: 'Hillsong United',
      rawLyrics: `[VERSE 1]
You call me out upon the waters
The great unknown where feet may fail
And there I find You in the mystery
In oceans deep
My faith will stand

[CHORUS]
And I will call upon Your name
And keep my eyes above the waves
When oceans rise
My soul will rest in Your embrace
For I am Yours and You are mine

[VERSE 2]
Your grace abounds in deepest waters
Your sovereign hand
Will be my guide
Where feet may fail and fear surrounds me
You've never failed and You won't start now

[BRIDGE]
Spirit lead me where my trust is without borders
Let me walk upon the waters
Wherever You would call me
Take me deeper than my feet could ever wander
And my faith will be made stronger
In the presence of my Savior`
    }
  ];

  for (const song of sampleSongs) {
    createFromLyricsInternal(song.title, song.rawLyrics, song.author);
  }
  
  initialized = true;
  console.log('[SongStore] Initialized with', songsStore.length, 'songs');
}

function createFromLyricsInternal(title: string, rawLyrics: string, author?: string): string {
  const songId = generateId();
  const parsedSections = parseLyrics(rawLyrics);
  
  const slides: (Slide & { layers: SlideLayer[] })[] = parsedSections.map((section, index) => {
    const slideId = generateId();
    const layers = createDefaultLayers(slideId, section.content);
    
    return {
      id: slideId,
      songId,
      orderIndex: index + 1,
      sectionType: section.type,
      sectionNumber: section.number,
      content: section.content,
      notes: null,
      customThemeId: null,
      createdAt: new Date().toISOString(),
      layers,
    };
  });

  const song: SongWithSlides = {
    id: songId,
    title,
    author: author || null,
    copyright: null,
    ccliNumber: null,
    tempo: null,
    songKey: null,
    tags: JSON.stringify([]),
    rawLyrics,
    defaultThemeId: null,
    defaultTemplateId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slides,
  };

  songsStore.push(song);
  return songId;
}

// Song Service (browser-compatible)
export const songService = {
  // Initialize store
  init() {
    initStore();
  },

  parseLyrics, // Expose helper

  // Get all songs
  getAll(): Song[] {
    initStore();
    return songsStore.map(({ slides, ...song }) => song);
  },

  // Get song by ID with slides
  getById(id: string): SongWithSlides | null {
    initStore();
    return songsStore.find(s => s.id === id) || null;
  },

  // Search songs (Title, Author, Lyrics)
  search(query: string): Song[] {
    initStore();
    const lowerQuery = query.toLowerCase();
    
    // Helper to check if a specific collection tag matches
    const isCollectionSearch = query.startsWith('tag:');
    if (isCollectionSearch) {
       const tag = query.replace('tag:', '').toLowerCase();
       return songsStore
         .filter(s => {
            const tags = JSON.parse(s.tags || '[]');
            return tags.some((t: string) => t.toLowerCase() === tag);
         })
         .map(({ slides, ...song }) => song);
    }

    return songsStore
      .filter(s => {
         const inTitle = s.title.toLowerCase().includes(lowerQuery);
         const inAuthor = s.author?.toLowerCase().includes(lowerQuery);
         const inLyrics = s.rawLyrics?.toLowerCase().includes(lowerQuery);
         return inTitle || inAuthor || inLyrics;
      })
      .map(({ slides, ...song }) => song);
  },

  // Collections (Tags)
  getCollections(): string[] {
     initStore();
     const allTags = new Set<string>();
     songsStore.forEach(s => {
        try {
           const tags = JSON.parse(s.tags || '[]');
           tags.forEach((t: string) => allTags.add(t));
        } catch (e) {
           // ignore bad json
        }
     });
     return Array.from(allTags).sort();
  },

  addTag(songId: string, tag: string) {
     initStore();
     const index = songsStore.findIndex(s => s.id === songId);
     if (index === -1) return;

     const song = songsStore[index];
     const tags = JSON.parse(song.tags || '[]');
     if (!tags.includes(tag)) {
        tags.push(tag);
        songsStore[index] = { ...song, tags: JSON.stringify(tags), updatedAt: new Date().toISOString() };
     }
  },

  removeTag(songId: string, tag: string) {
     initStore();
     const index = songsStore.findIndex(s => s.id === songId);
     if (index === -1) return;

     const song = songsStore[index];
     let tags = JSON.parse(song.tags || '[]');
     tags = tags.filter((t: string) => t !== tag);
     songsStore[index] = { ...song, tags: JSON.stringify(tags), updatedAt: new Date().toISOString() };
  },

  // Create new song from raw lyrics (Easy Mode)
  createFromLyrics(title: string, rawLyrics: string, author?: string): string {
    initStore();
    return createFromLyricsInternal(title, rawLyrics, author);
  },

  // Update song
  update(id: string, data: Partial<Song>) {
    initStore();
    const index = songsStore.findIndex(s => s.id === id);
    if (index !== -1) {
      songsStore[index] = { 
        ...songsStore[index], 
        ...data, 
        updatedAt: new Date().toISOString() 
      };
    }
  },

  // Delete song
  delete(id: string) {
    initStore();
    songsStore = songsStore.filter(s => s.id !== id);
  },
};

export default songService;
