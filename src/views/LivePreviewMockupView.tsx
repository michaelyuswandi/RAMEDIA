import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Tv,
  Play,
  Monitor,
  Music2,
  BookOpen,
  Film,
  Sparkle,
  MousePointerClick
} from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';

function ResizeHandle({ direction }: { direction: 'horizontal' | 'vertical' }) {
  const isHorizontal = direction === 'horizontal';
  return (
    <Separator
      className={`group relative shrink-0 bg-transparent transition ${
        isHorizontal ? 'w-[5px] cursor-col-resize' : 'h-[5px] cursor-row-resize'
      }`}
    >
      <div
        className={`absolute bg-slate-800 transition group-hover:bg-indigo-500/70 group-data-[resize-handle-active]:bg-indigo-600 ${
          isHorizontal ? 'inset-y-0 left-1/2 w-px -translate-x-1/2' : 'inset-x-0 top-1/2 h-px -translate-y-1/2'
        }`}
      />
    </Separator>
  );
}

interface MockItem {
  id: string;
  title: string;
  type: 'song' | 'bible' | 'media';
  category?: string;
  slides: { id: string; label: string; text: string; bgImage: string }[];
}

const mockScheduleItems: MockItem[] = [
  {
    id: 's1',
    title: 'Amazing Grace (Kidung Jemaat)',
    type: 'song',
    slides: [
      { id: 's1-1', label: 'Bait 1', text: 'Amazing grace how sweet the sound\nThat saved a wretch like me', bgImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop' },
      { id: 's1-2', label: 'Bait 2', text: 'I once was lost but now am found\nWas blind but now I see', bgImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop' },
      { id: 's1-3', label: 'Reff', text: 'Hallelujah grace has found us\nGrace will lead us safely home', bgImage: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?q=80&w=800&auto=format&fit=crop' },
      { id: 's1-4', label: 'Bait 3', text: 'Through many dangers toils and snares\nWe have already come', bgImage: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?q=80&w=800&auto=format&fit=crop' }
    ]
  },
  {
    id: 's2',
    title: 'Kejadian 1:1-3',
    type: 'bible',
    slides: [
      { id: 's2-1', label: 'Kej 1:1', text: 'Pada mulanya Allah menciptakan\nlangit dan bumi.', bgImage: 'https://images.unsplash.com/photo-1438317162446-4b29f4561570?q=80&w=800&auto=format&fit=crop' },
      { id: 's2-2', label: 'Kej 1:2', text: 'Bumi belum berbentuk dan kosong;\ngelap gulita menutupi samudera raya.', bgImage: 'https://images.unsplash.com/photo-1438317162446-4b29f4561570?q=80&w=800&auto=format&fit=crop' },
      { id: 's2-3', label: 'Kej 1:3', text: 'Berfirmanlah Allah: "Jadilah terang."\nLalu terang itu jadi.', bgImage: 'https://images.unsplash.com/photo-1438317162446-4b29f4561570?q=80&w=800&auto=format&fit=crop' }
    ]
  },
  {
    id: 's3',
    title: 'Video Bumper Opening.mp4',
    type: 'media',
    slides: [
      { id: 's3-1', label: 'Video Clip', text: '[PLAYING VIDEO]\nOpening Bumper RAMEDIA 2026', bgImage: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?q=80&w=800&auto=format&fit=crop' }
    ]
  }
];

const mockLibrarySongs: MockItem[] = [
  {
    id: 'l1',
    title: 'Bagai Rajawali',
    type: 'song',
    slides: [
      { id: 'l1-1', label: 'Bait 1', text: 'Aku ingin selalu berada di hadirat-Mu\nMelihat kebaikan-Mu dalam hidupku', bgImage: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=800&auto=format&fit=crop' },
      { id: 'l1-2', label: 'Reff', text: 'Bagai rajawali melayang tinggi\nKu terbang bersama-Mu mengatasi badai', bgImage: 'https://images.unsplash.com/photo-1507676184212-d03ab07a01bf?q=80&w=800&auto=format&fit=crop' }
    ]
  },
  {
    id: 'l2',
    title: 'Bapa Sentuh Hatiku',
    type: 'song',
    slides: [
      { id: 'l2-1', label: 'Bait 1', text: 'Betapa kumencintai-Mu Yesus Bapaku\nKau yang mengangkatku dari kejatuhanku', bgImage: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop' },
      { id: 'l2-2', label: 'Reff', text: 'Sentuh hatiku ubah hidupku\nMenjadi bejana yang layak bagi-Mu', bgImage: 'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?q=80&w=800&auto=format&fit=crop' }
    ]
  }
];

export default function LivePreviewMockupView() {
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MockItem | null>(mockScheduleItems[0]);
  const [selectedLiveItem, setSelectedLiveItem] = useState<MockItem | null>(mockScheduleItems[0]);
  const [previewSlide, setPreviewSlide] = useState<any>(mockScheduleItems[0].slides[0]);
  const [liveSlide, setLiveSlide] = useState<any>(mockScheduleItems[0].slides[0]);
  const [isBlack, setIsBlack] = useState(false);
  const [isClear, setIsClear] = useState(false);

  // Tab Library
  const [libraryTab, setLibraryTab] = useState<'rundown' | 'songs'>('rundown');

  // Handle click 1x (Preview)
  const handleItemClick = (item: MockItem) => {
    setSelectedPreviewItem(item);
    if (item.slides.length > 0) {
      setPreviewSlide(item.slides[0]);
    }
  };

  // Handle click 2x (Live)
  const handleItemDoubleClick = (item: MockItem) => {
    setSelectedLiveItem(item);
    setSelectedPreviewItem(item);
    if (item.slides.length > 0) {
      setLiveSlide(item.slides[0]);
      setPreviewSlide(item.slides[0]);
    }
  };

  const handleSlideClick = (slide: any) => {
    setPreviewSlide(slide);
  };

  const handleSlideDoubleClick = (slide: any) => {
    if (selectedPreviewItem) {
      setSelectedLiveItem(selectedPreviewItem);
    }
    setLiveSlide(slide);
  };

  const handleGoLive = () => {
    if (previewSlide) {
      if (selectedPreviewItem) {
        setSelectedLiveItem(selectedPreviewItem);
      }
      setLiveSlide(previewSlide);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] font-sans text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="flex h-14 items-center justify-between border-b border-slate-800 bg-[#0f172a]/90 px-6 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <Link
            to="/controller"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft size={16} />
          </Link>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500/20 text-indigo-400">
              <Tv size={14} />
            </div>
            <span className="text-sm font-bold tracking-wide">Live & Preview Mockup (Double-Click Update)</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
            <Sparkle size={12} className="animate-pulse" /> Click 1x/2x Standardized
          </span>
        </div>
      </header>

      {/* Main Layout Group */}
      <div className="p-4 h-[calc(100vh-56px)] min-h-[680px]">
        <Group orientation="horizontal" className="h-full w-full">
          
          {/* Left Side: Rundown & Library (default 25%) */}
          <Panel defaultSize={25} minSize={15} className="h-full">
            <div className="flex flex-col h-full pr-2">
              <div className="flex-1 flex flex-col rounded-xl border border-slate-800 bg-[#131b2e] overflow-hidden shadow-2xl">
                {/* Tabs */}
                <div className="flex border-b border-slate-800 p-1.5 bg-[#0f1626]">
                  <button
                    onClick={() => setLibraryTab('rundown')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      libraryTab === 'rundown'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Rundown Schedule
                  </button>
                  <button
                    onClick={() => setLibraryTab('songs')}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
                      libraryTab === 'songs'
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Library Songs
                  </button>
                </div>

                {/* List Content */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  <div className="px-1 py-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center justify-between">
                    <span>Daftar Item</span>
                    <span className="text-[9px] lowercase font-normal italic text-slate-600">Double click to Live</span>
                  </div>
                  
                  {libraryTab === 'rundown' ? (
                    mockScheduleItems.map((item) => {
                      const isPreviewed = selectedPreviewItem?.id === item.id;
                      const isLive = selectedLiveItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                          className={`group relative flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                            isLive
                              ? 'border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-[0_4px_12px_rgba(16,185,129,0.1)]'
                              : isPreviewed
                              ? 'border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 shadow-[0_4px_12px_rgba(99,102,241,0.1)]'
                              : 'border-slate-800 bg-[#162035] hover:border-slate-700 hover:bg-[#1a263f]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold ${
                                isLive
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : isPreviewed
                                  ? 'bg-indigo-500/20 text-indigo-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {item.type === 'song' ? <Music2 size={13} /> : item.type === 'bible' ? <BookOpen size={13} /> : <Film size={13} />}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">{item.title}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">
                                {item.type.toUpperCase()} • {item.slides.length} slides
                              </p>
                            </div>
                          </div>

                          {/* Badges */}
                          <div className="flex items-center gap-1.5">
                            {isLive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-extrabold uppercase tracking-wider border border-emerald-500/30">
                                Live
                              </span>
                            )}
                            {!isLive && isPreviewed && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[8px] font-extrabold uppercase tracking-wider border border-indigo-500/30">
                                Preview
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    mockLibrarySongs.map((item) => {
                      const isPreviewed = selectedPreviewItem?.id === item.id;
                      const isLive = selectedLiveItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleItemClick(item)}
                          onDoubleClick={() => handleItemDoubleClick(item)}
                          className={`group relative flex items-center justify-between p-3 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                            isLive
                              ? 'border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 shadow-[0_4px_12px_rgba(16,185,129,0.1)]'
                              : isPreviewed
                              ? 'border-indigo-500 bg-indigo-500/5 hover:bg-indigo-500/10 shadow-[0_4px_12px_rgba(99,102,241,0.1)]'
                              : 'border-slate-800 bg-[#162035] hover:border-slate-700 hover:bg-[#1a263f]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold ${
                                isLive
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : isPreviewed
                                  ? 'bg-indigo-500/20 text-indigo-400'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              <Music2 size={13} />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-xs font-bold">{item.title}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">SONG • {item.slides.length} slides</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isLive && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[8px] font-extrabold uppercase tracking-wider border border-emerald-500/30">
                                Live
                              </span>
                            )}
                            {!isLive && isPreviewed && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-[8px] font-extrabold uppercase tracking-wider border border-indigo-500/30">
                                Preview
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
                
                {/* Guide Info */}
                <div className="p-4 border-t border-slate-800 bg-[#0f1626] text-[11px] text-slate-400 leading-relaxed space-y-2">
                  <div className="flex gap-2 items-center text-indigo-400 font-semibold">
                    <MousePointerClick size={14} className="shrink-0" />
                    <span>Navigasi Terpadu:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1.5">
                    <li><strong className="text-slate-200">Klik 1x</strong> pada list lagu/alkitab = membuka <span className="text-indigo-400 font-semibold">Preview</span>.</li>
                    <li><strong className="text-slate-200">Klik 2x (Double-click)</strong> pada list lagu/alkitab = langsung mengirimnya <span className="text-emerald-400 font-semibold">Live Stage</span>.</li>
                  </ul>
                </div>
              </div>
            </div>
          </Panel>
          <ResizeHandle direction="horizontal" />

          {/* Center: Slide Preview & Control (default 37%) */}
          <Panel defaultSize={37} minSize={25} className="h-full">
            <div className="flex flex-col h-full px-1">
              <div className="flex-1 flex flex-col rounded-xl border border-slate-800 bg-[#131b2e] overflow-hidden shadow-2xl">
                <Group orientation="vertical" className="h-full w-full">
                  {/* Top Panel: Header + Preview Monitor */}
                  <Panel defaultSize={45} minSize={30} className="flex flex-col min-h-0">
                    {/* Middle Header */}
                    <div className={`flex items-center justify-between border-b px-4 py-3 shrink-0 transition-colors duration-300 ${
                      selectedPreviewItem?.id === selectedLiveItem?.id 
                        ? 'border-emerald-500/20 bg-emerald-500/5' 
                        : 'border-indigo-500/20 bg-indigo-500/5'
                    }`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${
                            selectedPreviewItem?.id === selectedLiveItem?.id ? 'bg-emerald-500 animate-pulse' : 'bg-indigo-500'
                          }`} />
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Preview Control
                          </span>
                        </div>
                        <h2 className="text-sm font-bold mt-0.5 truncate max-w-[200px]">
                          {selectedPreviewItem ? selectedPreviewItem.title : 'No item selected'}
                        </h2>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleGoLive}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition active:scale-95 shadow-lg shadow-emerald-500/10"
                        >
                          <Play size={12} fill="currentColor" />
                          GO LIVE
                        </button>
                      </div>
                    </div>

                    {/* Preview Monitor (Small) */}
                    <div className="flex-1 p-4 pb-2 min-h-0">
                      <div className="rounded-xl bg-slate-950 border border-indigo-500/30 relative w-full h-full overflow-hidden flex items-center justify-center text-center shadow-inner">
                        {previewSlide ? (
                          <div 
                            className="w-full h-full flex flex-col items-center justify-center p-4 bg-cover bg-center text-white"
                            style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url(${previewSlide.bgImage})` }}
                          >
                            <p className="text-xs font-extrabold leading-normal whitespace-pre-wrap max-w-[90%] text-shadow-sm">{previewSlide.text}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 font-semibold">Blank Preview</span>
                        )}
                        
                        <div className="absolute bottom-2 right-2 rounded bg-indigo-500 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-white">
                          Preview Stage
                        </div>
                      </div>
                    </div>
                  </Panel>

                  <ResizeHandle direction="vertical" />

                  {/* Bottom Panel: Slide Grid List */}
                  <Panel defaultSize={55} minSize={30} className="flex-1 overflow-y-auto p-4 min-h-0">
                    {selectedPreviewItem ? (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedPreviewItem.slides.map((slide) => {
                          const isSlidePreviewed = previewSlide?.id === slide.id;
                          const isSlideLive = liveSlide?.id === slide.id;
                          
                          return (
                            <div
                              key={slide.id}
                              onClick={() => handleSlideClick(slide)}
                              onDoubleClick={() => handleSlideDoubleClick(slide)}
                              className={`group relative rounded-lg overflow-hidden border cursor-pointer select-none transition-all duration-200 ${
                                isSlideLive
                                  ? 'border-emerald-500 bg-[#142624] shadow-[0_4px_12px_rgba(16,185,129,0.15)] scale-[1.01]'
                                  : isSlidePreviewed
                                  ? 'border-indigo-500 bg-[#16203f] shadow-[0_4px_12px_rgba(99,102,241,0.15)] scale-[1.01]'
                                  : 'border-slate-800 bg-[#18233c] hover:border-slate-700 hover:bg-[#1c2a48]'
                              }`}
                            >
                              {/* Slide Render Miniature */}
                              <div 
                                className="aspect-video w-full flex items-center justify-center p-2 text-center text-[10px] font-semibold text-white relative bg-cover bg-center overflow-hidden"
                                style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url(${slide.bgImage})` }}
                              >
                                <span className="line-clamp-2 leading-tight whitespace-pre-wrap font-sans text-shadow-sm">{slide.text}</span>
                                
                                <div className="absolute top-1.5 left-1.5 flex gap-1">
                                  {isSlideLive && (
                                    <span className="px-1 py-0.5 rounded bg-emerald-500 text-slate-950 text-[6px] font-extrabold uppercase tracking-wide">
                                      Live
                                    </span>
                                  )}
                                  {isSlidePreviewed && !isSlideLive && (
                                    <span className="px-1 py-0.5 rounded bg-indigo-500 text-white text-[6px] font-extrabold uppercase tracking-wide">
                                      Preview
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Footer Label */}
                              <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 text-[9px] text-slate-400 border-t border-slate-800/40">
                                <span className="font-semibold text-slate-300">{slide.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center border border-dashed border-slate-800 rounded-xl">
                        <Monitor size={36} className="mb-2 opacity-30" />
                        <p className="text-xs">Pilih salah satu item di Rundown / Library.</p>
                      </div>
                    )}
                  </Panel>
                </Group>
              </div>
            </div>
          </Panel>
          <ResizeHandle direction="horizontal" />

          {/* Right Side: Live Control (default 38%) */}
          <Panel defaultSize={38} minSize={25} className="h-full">
            <div className="flex flex-col h-full pl-2">
              <div className="flex-1 flex flex-col rounded-xl border border-slate-800 bg-[#131b2e] overflow-hidden shadow-2xl">
                <Group orientation="vertical" className="h-full w-full">
                  {/* Top Panel: Header + Live Monitor + Quick Controls */}
                  <Panel defaultSize={50} minSize={35} className="flex flex-col min-h-0">
                    {/* Right Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-[#0f1626] shrink-0">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Live Control</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500 font-semibold truncate max-w-[150px]">
                          {selectedLiveItem ? selectedLiveItem.title : 'No active item'}
                        </span>
                      </div>
                    </div>

                    {/* Live Monitor + Controls */}
                    <div className="flex-1 p-4 pb-2 flex flex-col gap-3 min-h-0">
                      <div className={`flex-1 rounded-xl relative overflow-hidden flex items-center justify-center text-center shadow-2xl transition-all duration-300 border ${
                        isBlack ? 'bg-black border-slate-900' : 'bg-slate-950 border-emerald-500/40'
                      }`}>
                        {!isBlack && !isClear && liveSlide ? (
                          <div 
                            className="w-full h-full flex flex-col items-center justify-center p-4 bg-cover bg-center text-white transition-all duration-300"
                            style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url(${liveSlide.bgImage})` }}
                          >
                            <p className="text-xs font-extrabold leading-normal whitespace-pre-wrap max-w-[90%] text-shadow-sm">{liveSlide.text}</p>
                          </div>
                        ) : isClear && !isBlack && liveSlide ? (
                          <div 
                            className="w-full h-full flex flex-col items-center justify-center p-4 bg-cover bg-center transition-all duration-300"
                            style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.25), rgba(0, 0, 0, 0.25)), url(${liveSlide.bgImage})` }}
                          >
                            <span className="text-[10px] text-slate-400 bg-black/60 px-3 py-1.5 rounded-full border border-slate-800 backdrop-blur-md">
                              Text Cleared (Background Only)
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600 font-semibold tracking-widest uppercase">BLACK SCREEN</span>
                        )}

                        <div className="absolute bottom-2 right-2 rounded bg-emerald-500 px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider text-slate-950">
                          On Stage Output
                        </div>
                      </div>

                      {/* Stage Quick Controls */}
                      <div className="grid grid-cols-2 gap-2 shrink-0">
                        <button
                          onClick={() => setIsBlack(!isBlack)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all duration-200 ${
                            isBlack
                              ? 'bg-slate-900 border-slate-700 text-white font-extrabold shadow-[0_0_12px_rgba(255,255,255,0.05)]'
                              : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {isBlack ? '🔴 DISABLE BLACK' : '⚫ BLACK'}
                        </button>
                        <button
                          onClick={() => setIsClear(!isClear)}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all duration-200 ${
                            isClear
                              ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 font-extrabold shadow-[0_0_12px_rgba(245,158,11,0.05)]'
                              : 'bg-slate-800/50 border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
                          }`}
                        >
                          {isClear ? '🟡 ENABLE TEXT' : '🧹 CLEAR TEXT'}
                        </button>
                      </div>
                    </div>
                  </Panel>

                  <ResizeHandle direction="vertical" />

                  {/* Bottom Panel: Live Slide Grid List */}
                  <Panel defaultSize={50} minSize={30} className="flex-1 overflow-y-auto p-4 border-t border-slate-800/60 min-h-0">
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Active Live Slides</div>
                    {selectedLiveItem ? (
                      <div className="grid grid-cols-2 gap-2">
                        {selectedLiveItem.slides.map((slide) => {
                          const isSlideLive = liveSlide?.id === slide.id;
                          
                          return (
                            <div
                              key={slide.id}
                              onClick={() => setLiveSlide(slide)}
                              className={`group relative rounded-lg overflow-hidden border cursor-pointer select-none transition-all duration-200 ${
                                isSlideLive
                                  ? 'border-emerald-500 bg-[#142624] shadow-[0_4px_12px_rgba(16,185,129,0.15)] scale-[1.01]'
                                  : 'border-slate-800 bg-[#18233c] hover:border-slate-700 hover:bg-[#1c2a48]'
                              }`}
                            >
                              {/* Slide Render Miniature */}
                              <div 
                                className="aspect-video w-full flex items-center justify-center p-2 text-center text-[10px] font-semibold text-white relative bg-cover bg-center overflow-hidden"
                                style={{ backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.45), rgba(0, 0, 0, 0.45)), url(${slide.bgImage})` }}
                              >
                                <span className="line-clamp-2 leading-tight whitespace-pre-wrap font-sans text-shadow-sm">{slide.text}</span>
                                
                                {isSlideLive && (
                                  <span className="absolute top-1.5 left-1.5 px-1 py-0.5 rounded bg-emerald-500 text-slate-950 text-[6px] font-extrabold uppercase tracking-wide">
                                    Live
                                  </span>
                                )}
                              </div>

                              {/* Footer Label */}
                              <div className="flex items-center justify-between px-2 py-1 bg-slate-950/40 text-[9px] text-slate-400 border-t border-slate-800/40">
                                <span className="font-semibold text-slate-300">{slide.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center border border-dashed border-slate-800 rounded-xl">
                        <Tv size={36} className="mb-2 opacity-30" />
                        <p className="text-xs">Tidak ada item yang aktif secara live.</p>
                      </div>
                    )}
                  </Panel>
                </Group>
              </div>
            </div>
          </Panel>
          
        </Group>
      </div>
    </div>
  );
}
