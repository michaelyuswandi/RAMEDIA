import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

type LibraryMode = 'grid' | 'compact' | 'visual-list';
type ContentType = 'Song' | 'Media' | 'Presentation';

interface LibraryMockItem {
  id: string;
  title: string;
  type: ContentType;
  detail: string;
  meta: string;
  excerpt: string;
  palette: string;
}

const ITEMS: LibraryMockItem[] = [
  {
    id: 'bersandar',
    title: "'Ku Bersandar Pada Yang Kekal",
    type: 'Song',
    detail: 'Unknown Artist',
    meta: '5 slides · Verse, Chorus',
    excerpt: "Jalan musafir indah dan permai\n'Ku bersandar pada yang kekal",
    palette: 'linear-gradient(145deg,#132234,#0a111a 58%,#315b72)',
  },
  {
    id: 'kasih-setia',
    title: 'Kasih SetiaMu',
    type: 'Song',
    detail: 'Franky Sihombing',
    meta: '7 slides · Verse, Chorus, Bridge',
    excerpt: 'Kasih setiaMu yang kurasakan\nLebih tinggi dari langit biru',
    palette: 'linear-gradient(145deg,#3d2a1c,#aa6842 54%,#e2b27d)',
  },
  {
    id: 'heavenly',
    title: 'Heavenly Clouds',
    type: 'Media',
    detail: 'Motion Background',
    meta: '00:42 · 1920 × 1080',
    excerpt: 'Looping background · No audio',
    palette: 'linear-gradient(145deg,#d6edf4,#78b8d3 52%,#4c7b9b)',
  },
  {
    id: 'besar-setia',
    title: 'Besar SetiaMu',
    type: 'Song',
    detail: 'Thomas O. Chisholm',
    meta: '6 slides · Verse, Chorus',
    excerpt: 'Besar setiaMu Allah Bapaku\nTiada bayangan pertukaranMu',
    palette: 'linear-gradient(145deg,#17271d,#375f44 55%,#83a77c)',
  },
  {
    id: 'welcome',
    title: 'Sunday Welcome',
    type: 'Presentation',
    detail: 'Service Slides',
    meta: '12 pages · Updated today',
    excerpt: 'Welcome · Announcements · Giving',
    palette: 'linear-gradient(145deg,#2a1c35,#684d78 55%,#c298ab)',
  },
  {
    id: 'great-outdoors',
    title: 'The Great Outdoors',
    type: 'Media',
    detail: 'Still Background',
    meta: '3840 × 2160 · JPG',
    excerpt: 'Mountain lake · Dark center area',
    palette: 'linear-gradient(145deg,#101b20,#365851 52%,#b28c55)',
  },
];

function MiniPreview({ item, large = false }: { item: LibraryMockItem; large?: boolean }) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden border border-white/10 ${large ? 'aspect-video w-full rounded-xl' : 'h-12 w-[78px] rounded-lg'}`}
      style={{ background: item.palette }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.24),transparent_28%),linear-gradient(180deg,transparent,rgba(0,0,0,0.38))]" />
      {item.type === 'Song' ? (
        <div className="absolute inset-x-[10%] top-1/2 -translate-y-1/2 text-center text-[5px] font-bold leading-tight text-white/90">
          {item.excerpt.split('\n').map((line) => <div key={line}>{line}</div>)}
        </div>
      ) : (
        <div className="absolute bottom-1.5 left-2 text-[6px] font-bold uppercase tracking-[0.14em] text-white/80">{item.type}</div>
      )}
    </div>
  );
}

function ModeButton({ active, label, description, onClick }: { active: boolean; label: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={description}
      className={`min-w-[92px] rounded-lg border px-3 py-2 text-left transition active:scale-[0.98] ${
        active
          ? 'border-amber-500/55 bg-amber-500/12 text-amber-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
          : 'border-white/8 bg-white/[0.025] text-zinc-400 hover:border-white/15 hover:text-zinc-200'
      }`}
    >
      <span className="block text-[11px] font-bold uppercase tracking-[0.08em]">{label}</span>
      <span className="mt-0.5 block text-[9px] text-current opacity-55">{description}</span>
    </button>
  );
}

export default function LibraryViewMockupView() {
  const [mode, setMode] = useState<LibraryMode>('visual-list');
  const [selectedId, setSelectedId] = useState('bersandar');
  const [typeFilter, setTypeFilter] = useState<'All' | ContentType>('All');
  const [query, setQuery] = useState('');

  const filteredItems = useMemo(() => ITEMS.filter((item) => {
    const matchesType = typeFilter === 'All' || item.type === typeFilter;
    const haystack = `${item.title} ${item.detail} ${item.excerpt}`.toLowerCase();
    return matchesType && haystack.includes(query.trim().toLowerCase());
  }), [query, typeFilter]);

  const selected = ITEMS.find((item) => item.id === selectedId) || ITEMS[0];

  return (
    <div className="min-h-[100dvh] bg-[#111214] font-sans text-zinc-100">
      <header className="border-b border-white/8 bg-[#17181b]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/controller" className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-zinc-400 transition hover:text-white">
              Back
            </Link>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-400/80">Library UX Study</div>
              <h1 className="mt-1 text-lg font-semibold tracking-tight">Visual List — compact, but still recognizable</h1>
            </div>
          </div>
          <div className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">Mockup only</div>
        </div>
      </header>

      <main className="mx-auto grid min-h-[860px] max-w-[1600px] grid-cols-[190px_minmax(0,1fr)] border-x border-white/6 xl:grid-cols-[220px_minmax(0,1fr)_290px]">
        <aside className="border-r border-white/8 bg-[#151619] p-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Content</div>
          <div className="mt-3 space-y-1">
            {(['All', 'Song', 'Media', 'Presentation'] as const).map((type) => {
              const count = type === 'All' ? ITEMS.length : ITEMS.filter((item) => item.type === type).length;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTypeFilter(type)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-xs transition active:scale-[0.98] ${
                    typeFilter === type ? 'bg-amber-500/12 font-semibold text-amber-200' : 'text-zinc-400 hover:bg-white/[0.035] hover:text-zinc-200'
                  }`}
                >
                  <span>{type === 'All' ? 'All Library' : type}</span>
                  <span className="font-mono text-[10px] opacity-45">{count}</span>
                </button>
              );
            })}
          </div>

          <div className="mt-8 border-t border-white/8 pt-5">
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Collections</div>
            <div className="mt-3 space-y-1 text-xs text-zinc-500">
              <div className="rounded-lg px-3 py-2 hover:bg-white/[0.03]">Sunday Service</div>
              <div className="rounded-lg px-3 py-2 hover:bg-white/[0.03]">Youth Worship</div>
              <div className="rounded-lg px-3 py-2 hover:bg-white/[0.03]">Christmas</div>
            </div>
          </div>
        </aside>

        <section className="flex min-w-0 flex-col bg-[#191a1d]">
          <div className="border-b border-white/8 px-5 py-4">
            <div className="flex items-center gap-3">
              <label className="min-w-0 flex-1">
                <span className="sr-only">Search library</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, lyrics, author..."
                  className="h-11 w-full rounded-xl border border-white/10 bg-[#111214] px-4 text-sm text-zinc-200 outline-none transition placeholder:text-zinc-600 focus:border-amber-500/45"
                />
              </label>
              <button className="h-11 rounded-xl border border-white/10 bg-white/[0.035] px-4 text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.06] active:scale-[0.98]">All Fields</button>
              <button className="h-11 rounded-xl bg-amber-500 px-4 text-xs font-bold text-[#1b160d] transition hover:bg-amber-400 active:scale-[0.98]">Add Content</button>
            </div>

            <div className="mt-4 flex items-end justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">View density</div>
                <div className="mt-2 flex gap-2">
                  <ModeButton active={mode === 'grid'} label="Grid" description="Visual browse" onClick={() => setMode('grid')} />
                  <ModeButton active={mode === 'compact'} label="Compact" description="Data first" onClick={() => setMode('compact')} />
                  <ModeButton active={mode === 'visual-list'} label="Visual List" description="Image + detail" onClick={() => setMode('visual-list')} />
                </div>
              </div>
              <div className="pb-1 text-right text-[10px] font-mono uppercase tracking-[0.1em] text-zinc-600">
                {filteredItems.length} items · double-click to live
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="flex h-full min-h-[420px] items-center justify-center text-center">
                <div>
                  <div className="text-sm font-semibold text-zinc-400">No content found</div>
                  <div className="mt-1 text-xs text-zinc-600">Try another keyword or content filter.</div>
                </div>
              </div>
            ) : mode === 'grid' ? (
              <div className="grid grid-cols-3 gap-3 xl:grid-cols-4">
                {filteredItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`rounded-xl border p-2 text-left transition hover:-translate-y-0.5 active:scale-[0.98] ${selectedId === item.id ? 'border-amber-500/55 bg-amber-500/8' : 'border-white/8 bg-white/[0.025] hover:border-white/15'}`}>
                    <MiniPreview item={item} large />
                    <div className="mt-2 truncate text-xs font-semibold text-zinc-200">{item.title}</div>
                    <div className="mt-1 truncate text-[10px] text-zinc-600">{item.detail}</div>
                  </button>
                ))}
              </div>
            ) : mode === 'compact' ? (
              <div className="overflow-hidden rounded-xl border border-white/8">
                <div className="grid grid-cols-[minmax(0,1fr)_180px_190px_90px] border-b border-white/8 bg-white/[0.035] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                  <span>Title</span><span>Author / Type</span><span>Info</span><span className="text-right">Action</span>
                </div>
                {filteredItems.map((item) => (
                  <button key={item.id} type="button" onClick={() => setSelectedId(item.id)} className={`grid w-full grid-cols-[minmax(0,1fr)_180px_190px_90px] items-center border-b border-white/6 px-3 py-2 text-left text-xs transition last:border-0 ${selectedId === item.id ? 'bg-amber-500/10' : 'hover:bg-white/[0.03]'}`}>
                    <span className="truncate font-semibold text-zinc-200">{item.title}</span><span className="truncate text-zinc-500">{item.detail}</span><span className="truncate text-zinc-600">{item.meta}</span><span className="text-right text-[9px] font-bold uppercase text-amber-400/75">Preview</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-white/8 bg-[#16171a]">
                <div className="grid grid-cols-[88px_minmax(0,1.3fr)_minmax(180px,0.8fr)_145px_78px] border-b border-white/8 bg-white/[0.035] px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">
                  <span>Preview</span><span>Title & content</span><span>Creator / format</span><span>Technical</span><span className="text-right">Status</span>
                </div>
                {filteredItems.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`grid w-full grid-cols-[88px_minmax(0,1.3fr)_minmax(180px,0.8fr)_145px_78px] items-center border-b border-white/6 px-3 py-2.5 text-left transition last:border-0 active:scale-[0.998] ${
                      selectedId === item.id ? 'bg-amber-500/10 shadow-[inset_3px_0_0_#d69a32]' : index % 2 ? 'bg-white/[0.012] hover:bg-white/[0.04]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <MiniPreview item={item} />
                    <span className="min-w-0 pr-5">
                      <span className="block truncate text-xs font-semibold text-zinc-100">{item.title}</span>
                      <span className="mt-1 block truncate whitespace-pre-line text-[10px] leading-tight text-zinc-500">{item.excerpt.replace('\n', ' · ')}</span>
                    </span>
                    <span className="min-w-0 pr-4">
                      <span className="block truncate text-[11px] font-medium text-zinc-300">{item.detail}</span>
                      <span className="mt-1 block text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-600">{item.type}</span>
                    </span>
                    <span className="truncate font-mono text-[9px] text-zinc-600">{item.meta}</span>
                    <span className="text-right text-[9px] font-bold uppercase tracking-[0.08em] text-zinc-600">Ready</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="hidden border-l border-white/8 bg-[#141518] p-4 xl:block">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-600">Inspector</div>
          <div className="mt-3"><MiniPreview item={selected} large /></div>
          <div className="mt-4 text-base font-semibold leading-tight text-zinc-100">{selected.title}</div>
          <div className="mt-1 text-xs text-zinc-500">{selected.detail}</div>
          <div className="mt-5 border-y border-white/8 py-4">
            <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-zinc-600">Content preview</div>
            <div className="mt-2 whitespace-pre-line text-xs leading-relaxed text-zinc-400">{selected.excerpt}</div>
          </div>
          <div className="mt-4 space-y-2">
            <button className="h-10 w-full rounded-lg bg-amber-500 text-xs font-bold text-[#1b160d] transition hover:bg-amber-400 active:scale-[0.98]">Add to Schedule</button>
            <button className="h-10 w-full rounded-lg border border-white/10 bg-white/[0.03] text-xs font-semibold text-zinc-300 transition hover:bg-white/[0.06] active:scale-[0.98]">Open Editor</button>
          </div>
          <div className="mt-6 rounded-xl border border-amber-500/18 bg-amber-500/[0.06] p-3 text-[10px] leading-relaxed text-amber-100/65">
            Visual List keeps EasyWorship’s fast scanning behavior, but uses a clearer thumbnail, two-line context, and restrained row density.
          </div>
        </aside>
      </main>
    </div>
  );
}
