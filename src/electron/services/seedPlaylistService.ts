import { randomBytes } from 'node:crypto';
import { db, schema } from '../database/index';
import { eq, and } from 'drizzle-orm';

export interface SeedPlaylistDef {
  name: string;
  tag: string;
  keywords: string[];
}

export const SEED_PLAYLISTS: SeedPlaylistDef[] = [
  {
    name: 'Lagu Pujian (Praise)',
    tag: '#Pujian',
    keywords: ['sorak', 'bersuka', 'haleluya', 'megahkan', 'pujilah', 'gembira', 'tepuk', 'sorak-sorai', 'menang', 'puji', 'soraklah'],
  },
  {
    name: 'Lagu Penyembahan (Worship)',
    tag: '#Penyembahan',
    keywords: ['suci', 'kudus', 'hadirat', 'kurindukan', 'sembah', 'diam', 'tenang', 'mulia', 'mengagungkan', 'sujud', 'bertahta'],
  },
  {
    name: 'Lagu Natal (Christmas)',
    tag: '#Natal',
    keywords: ['natal', 'betlehem', 'kandang', 'malam kudus', 'bayi yesus', 'terbit bintang', 'selamat hari natal', 'syalom', 'bintang'],
  },
  {
    name: 'Lagu Paskah (Easter)',
    tag: '#Paskah',
    keywords: ['salib', 'darah', 'bangkit', 'kubur', 'maut', 'korban', 'penebusan', 'pengorbanan', 'dia hidup'],
  },
  {
    name: 'Perjamuan Kudus (Communion)',
    tag: '#PerjamuanKudus',
    keywords: ['perjamuan', 'roti', 'anggur', 'tubuh', 'darah', 'kenangkan', 'peringatan', 'mengingat'],
  },
  {
    name: 'Sekolah Minggu (Kids)',
    tag: '#AnakAnak',
    keywords: ['anak', 'domba', 'kingkong', 'melompat', 'menari', 'jesus loves', 'sekolah minggu', 'kecil', 'gembira'],
  },
  {
    name: 'Respon Firman (Sermon Response)',
    tag: '#Firman',
    keywords: ['firman', 'pelita', 'kebenaran', 'ketaatan', 'sabda', 'renungan', 'ajarku', 'dengar'],
  },
];

export interface AutoTaggingProgress {
  processed: number;
  total: number;
  log: string;
}

export async function runAutoTaggingAndSeedPlaylists(
  onProgress?: (progress: AutoTaggingProgress) => void
): Promise<{ processedSongs: number; totalSongs: number; createdPlaylists: number; tagsAssigned: number }> {
  let createdPlaylistsCount = 0;
  let totalTagsAssigned = 0;

  // 1. Seed Playlists In Database
  const existingPlaylists = await db.select().from(schema.playlists);
  const playlistMap = new Map<string, string>(); // tag -> playlistId

  for (const seed of SEED_PLAYLISTS) {
    let found = existingPlaylists.find((p) => p.name === seed.name || p.name.toLowerCase().includes(seed.tag.toLowerCase().replace('#', '')));
    let playlistId = found?.id;

    if (!playlistId) {
      playlistId = randomBytes(8).toString('hex');
      await db.insert(schema.playlists).values({
        id: playlistId,
        name: seed.name,
      });
      createdPlaylistsCount++;
    }
    playlistMap.set(seed.tag, playlistId);
  }

  // 2. Fetch All Songs
  const allSongs = await db.select().from(schema.songs);
  const totalSongs = allSongs.length;

  if (totalSongs === 0) {
    if (onProgress) {
      onProgress({ processed: 0, total: 0, log: 'Tidak ada lagu di library.' });
    }
    return { processedSongs: 0, totalSongs: 0, createdPlaylists: createdPlaylistsCount, tagsAssigned: 0 };
  }

  // 3. Process Each Song
  for (let i = 0; i < allSongs.length; i++) {
    const song = allSongs[i];
    const searchTarget = `${song.title} ${song.rawLyrics || ''}`.toLowerCase();

    let currentTags: string[] = [];
    try {
      if (song.tags) {
        const parsed = JSON.parse(song.tags);
        if (Array.isArray(parsed)) currentTags = parsed.map(String);
      }
    } catch {
      currentTags = [];
    }

    const matchedTags: string[] = [];

    for (const seed of SEED_PLAYLISTS) {
      const matchFound = seed.keywords.some((kw) => searchTarget.includes(kw.toLowerCase()));
      if (matchFound) {
        matchedTags.push(seed.tag);

        // Add to Playlist if not already in playlist
        const targetPlaylistId = playlistMap.get(seed.tag);
        if (targetPlaylistId) {
          const existingItem = await db
            .select()
            .from(schema.playlistItems)
            .where(
              and(
                eq(schema.playlistItems.playlistId, targetPlaylistId),
                eq(schema.playlistItems.songId, song.id)
              )
            );

          if (existingItem.length === 0) {
            const currentItems = await db
              .select()
              .from(schema.playlistItems)
              .where(eq(schema.playlistItems.playlistId, targetPlaylistId));

            await db.insert(schema.playlistItems).values({
              id: randomBytes(8).toString('hex'),
              playlistId: targetPlaylistId,
              songId: song.id,
              orderIndex: currentItems.length,
            });
          }
        }
      }
    }

    // Merge new matched tags with existing tags
    const updatedTags = Array.from(new Set([...currentTags, ...matchedTags]));

    if (updatedTags.length > currentTags.length) {
      totalTagsAssigned += (updatedTags.length - currentTags.length);
      await db
        .update(schema.songs)
        .set({ tags: JSON.stringify(updatedTags) })
        .where(eq(schema.songs.id, song.id));
    }

    const logMsg = matchedTags.length > 0
      ? `Lagu "${song.title}" diberi tag: ${matchedTags.join(', ')}`
      : `Lagu "${song.title}" diproses.`;

    if (onProgress) {
      onProgress({ processed: i + 1, total: totalSongs, log: logMsg });
    }
  }

  return {
    processedSongs: totalSongs,
    totalSongs,
    createdPlaylists: createdPlaylistsCount,
    tagsAssigned: totalTagsAssigned,
  };
}
