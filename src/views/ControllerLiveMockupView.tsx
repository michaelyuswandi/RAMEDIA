import { useMemo, useState } from 'react';
import { AlignLeft, ArrowLeft, Grid2X2, Grid3X3, Image, Play, Rows3, Tv2 } from 'lucide-react';
import { Link } from 'react-router-dom';

type DisplayMode = 'thumbnail' | 'text';
type LayoutMode = 'grid' | 'list';
type ColumnCount = 2 | 3;

interface MockSlide {
  id: string;
  section: string;
  content: string;
}

const mockSlides: MockSlide[] = [
  {
    id: 'verse-1',
    section: 'Verse 1',
    content: 'Amazing grace how sweet the sound\nThat saved a wretch like me',
  },
  {
    id: 'verse-2',
    section: 'Verse 2',
    content: 'I once was lost but now am found\nWas blind but now I see',
  },
  {
    id: 'chorus-1',
    section: 'Chorus',
    content: 'Hallelujah grace has found us\nGrace will lead us safely home',
  },
  {
    id: 'bridge-1',
    section: 'Bridge',
    content: 'Through many dangers toils and snares\nWe have already come',
  },
  {
    id: 'tag-1',
    section: 'Tag',
    content: 'Grace will lead us home',
  },
  {
    id: 'verse-3',
    section: 'Verse 3',
    content: 'The Lord has promised good to me\nHis word my hope secures',
  },
];

function MockMonitor() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[20px] border border-white/10 bg-black shadow-[0_18px_50px_rgba(0,0,0,0.34)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(88,213,247,0.14),transparent_30%),linear-gradient(180deg,transparent,rgba(0,0,0,0.28))]" />
      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-black/35 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.2em] text-white/70">
        Live Preview
      </div>
      <div className="relative z-10 mx-auto max-w-[72%] text-center text-white">
        <p className="text-[clamp(1.65rem,2vw,2.35rem)] font-semibold leading-tight">
          Amazing grace how sweet the sound
        </p>
        <p className="mt-2 text-[clamp(1.65rem,2vw,2.35rem)] font-semibold leading-tight">
          That saved a wretch like me
        </p>
      </div>
    </div>
  );
}

export default function ControllerLiveMockupView() {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('thumbnail');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('grid');
  const [columnCount, setColumnCount] = useState<ColumnCount>(3);
  const [selectedId, setSelectedId] = useState<string>('verse-1');

  const selectedIndex = mockSlides.findIndex((slide) => slide.id === selectedId);
  const previousId = selectedIndex > 0 ? mockSlides[selectedIndex - 1]?.id : null;
  const nextId = selectedIndex < mockSlides.length - 1 ? mockSlides[selectedIndex + 1]?.id : null;

  const columnsClass = columnCount === 2 ? 'grid-cols-2' : 'grid-cols-3';

  const recommendations = useMemo(
    () => [
      'Area bawah live jangan selalu list tunggal. Default ke grid padat supaya operator cepat scan banyak slide.',
      'Tambahkan switch thumbnail vs text. Thumbnail cocok untuk cek visual layer, text cocok untuk operasi lagu cepat.',
      'Kolom grid cukup 2 atau 3. Untuk layar lebar 3 kolom paling efisien, untuk laptop/operator booth 2 kolom lebih aman.',
      'Status `Live`, `Next`, dan `Previous` tetap dipertahankan, tapi ditaruh langsung di card agar tidak perlu baca satu per satu.',
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-background text-text">
      <div className="mx-auto flex min-h-screen max-w-[1600px] gap-5 p-5">
        <aside className="panel-shell flex w-[360px] shrink-0 flex-col overflow-hidden rounded-[28px]">
          <div className="border-b border-white/6 px-5 py-4">
            <div className="flex gap-4">
              <Link
                to="/controller"
                className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-text/55 transition-colors hover:text-text"
              >
                <ArrowLeft size={14} />
                Back To Controller
              </Link>
              <Link
                to="/live-preview-mockup"
                className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em] text-indigo-400 transition-colors hover:text-indigo-300"
              >
                Go to New Live & Preview Mockup →
              </Link>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="rounded-2xl border border-primary/25 bg-primary/10 p-2 text-primary">
                <Tv2 size={18} />
              </div>
              <div>
                <h1 className="text-lg font-semibold">Live Controller Song Mockup</h1>
                <p className="mt-1 text-sm leading-relaxed text-text/60">
                  Fokus di area live sebelah kanan. Existing flow tetap dipertahankan, tapi list song dibuat lebih padat dan lebih mudah dikontrol.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 overflow-y-auto px-5 py-5">
            <section>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text/35">Masalah Sekarang</div>
              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm leading-relaxed text-text/70">
                Song queue di panel live masih satu kolom panjang. Saat jumlah slide banyak, operator harus scroll jauh dan area lebar panel tidak terpakai maksimal.
              </div>
            </section>

            <section>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text/35">Usulan UX</div>
              <div className="space-y-2">
                {recommendations.map((item) => (
                  <div key={item} className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-relaxed text-text/72">
                    {item}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text/35">Catatan Implementasi</div>
              <div className="rounded-2xl border border-info/20 bg-info/10 px-4 py-3 text-sm leading-relaxed text-text/78">
                Karena `CenterPanel` sebenarnya sudah punya mode `thumbnail/text` dan `grid/list`, perilaku itu bisa dipindahkan atau dishare ke `RightPanel` agar konsisten. Jadi effort teknisnya relatif kecil dan tidak perlu redesign total.
              </div>
            </section>
          </div>
        </aside>

        <main className="panel-shell flex min-h-[920px] min-w-0 flex-1 flex-col overflow-hidden rounded-[32px]">
          <div className="flex items-center justify-between border-b border-white/6 bg-white/[0.03] px-5 py-3">
            <div className="flex items-center gap-2">
              <span className="status-chip border-error/25 bg-error/10 text-error">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-error" />
                </span>
                On Air
              </span>
              <button className="control-button px-3 py-2 text-[11px] font-medium">Clear</button>
              <button className="control-button px-3 py-2 text-[11px] font-medium">Black</button>
              <button className="control-button-primary flex items-center gap-2 px-4 py-2 text-[11px] font-medium">
                <Play size={14} fill="currentColor" className="text-black" />
                <span className="text-black">Go Live</span>
              </button>
            </div>
            <div className="rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] font-medium tracking-[0.04em] text-text/58">
              Mockup Only
            </div>
          </div>

          <div className="grid min-h-0 flex-1 grid-rows-[360px_auto_minmax(220px,1fr)]">
            <div className="surface-grid flex items-center justify-center bg-black p-5">
              <div className="h-full w-full max-w-[960px]">
                <MockMonitor />
              </div>
            </div>

            <div className="border-y border-white/6 bg-black/15 px-4 py-3">
              <div className="flex items-center gap-3">
                <button className="control-button px-3 py-2 text-[11px] font-medium">Prev</button>
                <button className="control-button px-3 py-2 text-[11px] font-medium">Next</button>
                <div className="min-w-0 flex-1 rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  {mockSlides[selectedIndex]?.section ?? 'No Live Item'}
                </div>
                <div className="text-[11px] font-mono tracking-[0.08em] text-text/35">
                  {selectedIndex + 1} / {mockSlides.length}
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-col bg-white/[0.02]">
              <div className="flex flex-wrap items-center gap-3 border-b border-white/6 bg-black/10 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text/32">Live Slides</div>

                <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.04] p-0.5">
                  <button
                    onClick={() => setDisplayMode('thumbnail')}
                    className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-medium transition-all ${
                      displayMode === 'thumbnail' ? 'bg-primary text-black' : 'text-text/52 hover:text-text'
                    }`}
                  >
                    <Image size={13} />
                    Thumbnail
                  </button>
                  <button
                    onClick={() => setDisplayMode('text')}
                    className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-medium transition-all ${
                      displayMode === 'text' ? 'bg-primary text-black' : 'text-text/52 hover:text-text'
                    }`}
                  >
                    <AlignLeft size={13} />
                    Text
                  </button>
                </div>

                <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.04] p-0.5">
                  <button
                    onClick={() => setLayoutMode('grid')}
                    className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-medium transition-all ${
                      layoutMode === 'grid' ? 'bg-info/20 text-info' : 'text-text/52 hover:text-text'
                    }`}
                  >
                    <Grid3X3 size={13} />
                    Grid
                  </button>
                  <button
                    onClick={() => setLayoutMode('list')}
                    className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-medium transition-all ${
                      layoutMode === 'list' ? 'bg-info/20 text-info' : 'text-text/52 hover:text-text'
                    }`}
                  >
                    <Rows3 size={13} />
                    List
                  </button>
                </div>

                {layoutMode === 'grid' && (
                  <div className="flex items-center rounded-xl border border-white/8 bg-white/[0.04] p-0.5">
                    <button
                      onClick={() => setColumnCount(2)}
                      className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-medium transition-all ${
                        columnCount === 2 ? 'bg-white/12 text-text' : 'text-text/52 hover:text-text'
                      }`}
                    >
                      <Grid2X2 size={13} />
                      2 Col
                    </button>
                    <button
                      onClick={() => setColumnCount(3)}
                      className={`flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-medium transition-all ${
                        columnCount === 3 ? 'bg-white/12 text-text' : 'text-text/52 hover:text-text'
                      }`}
                    >
                      <Grid3X3 size={13} />
                      3 Col
                    </button>
                  </div>
                )}

                <div className="ml-auto text-[11px] font-mono tracking-[0.06em] text-text/32">
                  click: preview, double click: live
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                {layoutMode === 'list' ? (
                  <div className="space-y-2">
                    {mockSlides.map((slide) => {
                      const isLive = slide.id === selectedId;
                      const isPrev = slide.id === previousId;
                      const isNext = slide.id === nextId;

                      return (
                        <button
                          key={slide.id}
                          onClick={() => setSelectedId(slide.id)}
                          className={`flex w-full items-start gap-4 rounded-2xl border px-4 py-3 text-left transition-all ${
                            isLive
                              ? 'border-primary/30 bg-primary/10 shadow-[0_12px_30px_rgba(245,158,11,0.14)]'
                              : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
                          }`}
                        >
                          <span className={`mt-0.5 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            isLive ? 'bg-primary text-black' : 'bg-white/8 text-text/55'
                          }`}>
                            {slide.section}
                          </span>
                          <p className={`flex-1 whitespace-pre-line text-sm leading-relaxed ${
                            isLive ? 'text-text' : 'text-text/72'
                          }`}>
                            {slide.content}
                          </p>
                          <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                            isLive ? 'text-primary' : isPrev ? 'text-text/40' : isNext ? 'text-info' : 'text-transparent'
                          }`}>
                            {isLive ? 'Live' : isPrev ? 'Prev' : isNext ? 'Next' : '.'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className={`grid ${columnsClass} gap-3`}>
                    {mockSlides.map((slide) => {
                      const isLive = slide.id === selectedId;
                      const isPrev = slide.id === previousId;
                      const isNext = slide.id === nextId;

                      return (
                        <button
                          key={slide.id}
                          onClick={() => setSelectedId(slide.id)}
                          className={`group relative overflow-hidden rounded-[22px] border text-left transition-all ${
                            isLive
                              ? 'border-primary/30 bg-primary/10 shadow-[0_14px_36px_rgba(245,158,11,0.16)]'
                              : 'border-white/8 bg-white/[0.03] hover:border-white/14 hover:bg-white/[0.05]'
                          }`}
                        >
                          {displayMode === 'thumbnail' ? (
                            <div className="aspect-video bg-black p-3">
                              <div className="relative flex h-full items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-[radial-gradient(circle_at_top,rgba(88,213,247,0.12),transparent_35%),linear-gradient(180deg,#05070A,#000)] px-5 text-center">
                                <div className="absolute left-2 top-2 rounded-full bg-black/45 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-text/65">
                                  {slide.section}
                                </div>
                                <p className={`line-clamp-4 whitespace-pre-line text-sm font-semibold leading-tight ${
                                  isLive ? 'text-text' : 'text-text/82'
                                }`}>
                                  {slide.content}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="p-4">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                  isLive ? 'bg-primary text-black' : 'bg-white/8 text-text/55'
                                }`}>
                                  {slide.section}
                                </span>
                                <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                  isLive ? 'text-primary' : isPrev ? 'text-text/40' : isNext ? 'text-info' : 'text-transparent'
                                }`}>
                                  {isLive ? 'Live' : isPrev ? 'Prev' : isNext ? 'Next' : '.'}
                                </span>
                              </div>
                              <p className={`line-clamp-5 whitespace-pre-line text-sm leading-relaxed ${
                                isLive ? 'text-text' : 'text-text/72'
                              }`}>
                                {slide.content}
                              </p>
                            </div>
                          )}

                          {displayMode === 'thumbnail' && (
                            <div className="flex items-center justify-between border-t border-white/6 px-3 py-2">
                              <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                isLive ? 'text-primary' : 'text-text/42'
                              }`}>
                                {slide.section}
                              </span>
                              <span className={`text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                isLive ? 'text-primary' : isPrev ? 'text-text/40' : isNext ? 'text-info' : 'text-transparent'
                              }`}>
                                {isLive ? 'Live' : isPrev ? 'Prev' : isNext ? 'Next' : '.'}
                              </span>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
