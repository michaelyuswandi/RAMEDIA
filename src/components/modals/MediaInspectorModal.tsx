import { useState, useRef, useEffect } from 'react';
import { X, Play, Pause, Save, RotateCcw, Volume2, VolumeX, Maximize, Target } from 'lucide-react';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import type { Media } from '../../electron/database/schema';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import { getPdfPlaybackSettings } from '../../core/utils/pdf';

interface MediaInspectorModalProps {
  media: Media;
  onClose: () => void;
}

export default function MediaInspectorModal({ media, onClose }: MediaInspectorModalProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentPdfPage, setCurrentPdfPage] = useState(1);

  // Parsed playback settings
  const parsedSettings = media.playbackSettings ? JSON.parse(media.playbackSettings) : {
    startTime: 0,
    endTime: 0,
    behavior: 'loop',
    scaling: 'cover',
    volume: media.mediaType === 'video' ? 100 : 0,
    speed: 1.0
  };

  const [startTime, setStartTime] = useState(parsedSettings.startTime || 0);
  const [endTime, setEndTime] = useState(parsedSettings.endTime || 0);
  const [behavior, setBehavior] = useState(parsedSettings.behavior || 'loop');
  const [scaling, setScaling] = useState(parsedSettings.scaling || 'cover');
  const [volume, setVolume] = useState(parsedSettings.volume ?? (media.mediaType === 'video' ? 100 : 0));
  const [speed, setSpeed] = useState(parsedSettings.speed || 1.0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaSource = toRenderableMediaUrl(media.filepath);
  const pdfSettings = getPdfPlaybackSettings(media);
  const pdfPageCount = Math.max(pdfSettings.pageCount, pdfSettings.pageUrls.length || 1);
  const currentPdfSrc = toRenderableMediaUrl(pdfSettings.pageUrls[currentPdfPage - 1] || media.thumbnail || media.filepath);

  useEffect(() => {
    setCurrentPdfPage(1);
  }, [media.id]);

  // Initialize video settings
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.playbackRate = speed;
      videoRef.current.currentTime = startTime;
    }
  }, [startTime, speed, volume]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cTime = videoRef.current.currentTime;
      setCurrentTime(cTime);
      
      // End behavior logic
      if (endTime > 0 && cTime >= endTime) {
        if (behavior === 'loop') {
          videoRef.current.currentTime = startTime;
          videoRef.current.play();
        } else if (behavior === 'stop') {
          videoRef.current.pause();
          setIsPlaying(false);
        } else if (behavior === 'hold') {
          videoRef.current.pause();
          setIsPlaying(false);
          videoRef.current.currentTime = endTime;
        }
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      const vidDuration = videoRef.current.duration;
      setDuration(vidDuration);
      if (endTime === 0 || endTime > vidDuration) {
        setEndTime(vidDuration);
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        if (videoRef.current.currentTime >= endTime && behavior !== 'loop') {
           videoRef.current.currentTime = startTime;
        }
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    const newSettings =
      media.mediaType === 'pdf'
        ? {
            ...parsedSettings,
            scaling,
            pageCount: pdfSettings.pageCount,
            aspectRatio: pdfSettings.aspectRatio,
            pageWidth: pdfSettings.pageWidth,
            pageHeight: pdfSettings.pageHeight,
          }
        : {
            startTime,
            endTime,
            behavior,
            scaling,
            volume,
            speed,
          };
    
    await ipcMediaService.update(media.id, { playbackSettings: JSON.stringify(newSettings) });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-6 font-sans backdrop-blur-md">
      <div className="flex w-full max-w-4xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0A0D14] shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/5 bg-white/[0.02] px-6 py-4">
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-text/55 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close media inspector"
            title="Close media inspector"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold tracking-wide text-text">{media.filename}</h2>
            <p className="text-[10px] font-medium tracking-widest text-text/40 uppercase mt-0.5">Media Inspector</p>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Main Player Area */}
          <div className="flex flex-1 flex-col bg-black">
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black/50">
              {media.mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={mediaSource}
                  className="h-full w-full outline-none"
                  style={{ objectFit: scaling as any }}
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  autoPlay
                  onClick={togglePlay}
                />
              ) : media.mediaType === 'pdf' ? (
                <div className="flex h-full w-full flex-col">
                  <div className="flex min-h-0 flex-1 items-center justify-center">
                    <img
                      src={currentPdfSrc}
                      className="h-full w-full object-contain"
                      alt={`${media.filename} - Page ${currentPdfPage}`}
                    />
                  </div>

                  {pdfPageCount > 1 && (
                    <div className="border-t border-white/10 bg-[#0c1017] px-4 py-3">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-text/38">
                          PDF Pages
                        </div>
                        <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-text/45">
                          Page {currentPdfPage} / {pdfPageCount}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCurrentPdfPage((page) => Math.max(1, page - 1))}
                          disabled={currentPdfPage <= 1}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-text transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Prev
                        </button>
                        <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
                          {Array.from({ length: pdfPageCount }, (_, index) => {
                            const page = index + 1;
                            const src = toRenderableMediaUrl(pdfSettings.pageUrls[index] || '');
                            const isActive = page === currentPdfPage;
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPdfPage(page)}
                                className={`group shrink-0 overflow-hidden rounded-xl border transition-all duration-150 ${
                                  isActive
                                    ? 'border-primary/50 bg-primary/12 shadow-[0_8px_22px_rgba(245,158,11,0.2)]'
                                    : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]'
                                }`}
                              >
                                <div className="flex h-16 w-24 items-center justify-center bg-black/40">
                                  {src ? (
                                    <img src={src} alt={`Page ${page}`} className="h-full w-full object-contain" />
                                  ) : (
                                    <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/30">
                                      Page {page}
                                    </div>
                                  )}
                                </div>
                                <div className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] ${isActive ? 'text-primary' : 'text-text/45'}`}>
                                  {page}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                        <button
                          onClick={() => setCurrentPdfPage((page) => Math.min(pdfPageCount, page + 1))}
                          disabled={currentPdfPage >= pdfPageCount}
                          className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-medium text-text transition-colors hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-35"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <img
                  src={mediaSource}
                  className="h-full w-full"
                  style={{ objectFit: scaling as any }}
                  alt={media.filename}
                />
              )}
            </div>

            {/* Timestamps & Slider area (Only for video) */}
            {media.mediaType === 'video' && (
              <div className="border-t border-white/10 bg-[#0c1017] p-5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="text-xs font-mono text-primary">{formatTime(currentTime)}</div>
                  <div className="text-xs font-mono text-text/30">{formatTime(duration)}</div>
                </div>

                <div className="relative mt-2 h-8 w-full select-none">
                  {/* Timeline track */}
                  <div className="absolute top-3 h-1.5 w-full rounded-full bg-white/10" />
                  
                  {/* Active highlight inside trim area */}
                  <div 
                    className="absolute top-3 h-1.5 bg-primary/40"
                    style={{
                      left: `${(startTime / duration) * 100}%`,
                      width: `${((endTime - startTime) / duration) * 100}%`
                    }}
                  />

                  {/* Playhead */}
                  <div 
                    className="absolute top-2.5 h-2.5 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    style={{ left: `${(currentTime / duration) * 100}%` }}
                  />

                  {/* In-Point Thumb */}
                  <input
                     type="range"
                     min={0}
                     max={duration}
                     step={0.1}
                     value={startTime}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       if (val < endTime) {
                         setStartTime(val);
                         if (videoRef.current) videoRef.current.currentTime = val;
                       }
                     }}
                     className="absolute -top-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:cursor-ew-resize"
                  />

                  {/* Out-Point Thumb */}
                  <input
                     type="range"
                     min={0}
                     max={duration}
                     step={0.1}
                     value={endTime}
                     onChange={(e) => {
                       const val = parseFloat(e.target.value);
                       if (val > startTime) setEndTime(val);
                     }}
                     className="absolute -top-1 w-full appearance-none bg-transparent outline-none [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-sm [&::-webkit-slider-thumb]:bg-rose-400 [&::-webkit-slider-thumb]:cursor-ew-resize"
                  />
                </div>
                
                <div className="mt-4 flex items-center justify-center gap-4">
                  <button onClick={togglePlay} className="rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-primary hover:text-black">
                     {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
                  </button>
                  <button 
                     onClick={() => { setStartTime(0); setEndTime(duration); }}
                     className="rounded-full border border-white/10 p-2.5 text-text/50 transition-colors hover:bg-white/5 hover:text-white"
                     title="Reset Trims"
                  >
                     <RotateCcw size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Properties Sidebar */}
          <div className="w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-white/5 bg-[#0e121a] p-5">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-widest text-text/40">Playback Rules</h3>

            {media.mediaType === 'pdf' && (
              <div className="mb-5 rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/38">PDF Info</div>
                <div className="mt-3 space-y-2 text-xs text-text/72">
                  <div className="flex items-center justify-between">
                    <span>Pages</span>
                    <span className="font-mono text-white/88">{pdfSettings.pageCount}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Page Size</span>
                    <span className="font-mono text-white/88">
                      {pdfSettings.pageWidth || 0} x {pdfSettings.pageHeight || 0}
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {media.mediaType === 'video' && (
              <>
                <div className="mb-4">
                  <label className="mb-2 block text-xs font-medium text-text/70">Behavior at Out-Point</label>
                  <div className="flex rounded-lg border border-white/10 bg-black/20 p-1">
                     <button
                       onClick={() => setBehavior('loop')}
                       className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${behavior === 'loop' ? 'bg-white/10 text-white' : 'text-text/40 hover:text-white'}`}
                     >
                       Loop
                     </button>
                     <button
                       onClick={() => setBehavior('stop')}
                       className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${behavior === 'stop' ? 'bg-white/10 text-white' : 'text-text/40 hover:text-white'}`}
                     >
                       Stop
                     </button>
                     <button
                       onClick={() => setBehavior('hold')}
                       className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${behavior === 'hold' ? 'bg-white/10 text-white' : 'text-text/40 hover:text-white'}`}
                     >
                       Hold
                     </button>
                  </div>
                </div>

                <div className="mb-5">
                  <label className="mb-2 flex items-center justify-between text-xs font-medium text-text/70">
                    Playback Speed <span className="text-primary">{speed}x</span>
                  </label>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-text/30">0.2x</span>
                    <input 
                      type="range" min="0.2" max="2.0" step="0.1" 
                      value={speed} onChange={e => setSpeed(parseFloat(e.target.value))}
                      className="flex-1 accent-primary"
                    />
                    <span className="text-[10px] text-text/30">2.0x</span>
                  </div>
                </div>
              </>
            )}

            <div className="mb-5">
              <label className="mb-2 block text-xs font-medium text-text/70">Scaling Mode</label>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setScaling('cover')}
                  className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${scaling === 'cover' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/5 bg-white/5 text-text/50 hover:bg-white/10'}`}
                >
                  <Maximize size={16} />
                  <div>
                    <div className="text-xs font-medium">Scale to Fill (Cover)</div>
                    <div className="text-[9px] opacity-70">Fills screen, croppping edges</div>
                  </div>
                </button>
                <button 
                  onClick={() => setScaling('contain')}
                  className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-colors ${scaling === 'contain' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-white/5 bg-white/5 text-text/50 hover:bg-white/10'}`}
                >
                  <Target size={16} />
                  <div>
                    <div className="text-xs font-medium">Scale to Fit (Contain)</div>
                    <div className="text-[9px] opacity-70">Keeps ratio, adds black bars</div>
                  </div>
                </button>
              </div>
            </div>

            {media.mediaType === 'video' && (
              <div className="mb-5">
                <label className="mb-2 flex items-center justify-between text-xs font-medium text-text/70">
                  Audio Volume <span className="text-white">{volume}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setVolume(0)} className="text-text/40 hover:text-white"><VolumeX size={14}/></button>
                  <input 
                    type="range" min="0" max="100" step="1" 
                    value={volume} onChange={e => setVolume(parseFloat(e.target.value))}
                    className="flex-1 accent-primary"
                  />
                  <button onClick={() => setVolume(100)} className="text-text/40 hover:text-white"><Volume2 size={14}/></button>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex justify-end gap-3 border-t border-white/5 bg-[#080b0f] px-6 py-4">
           <button onClick={onClose} className="rounded-xl border border-white/10 px-5 py-2 text-xs font-medium text-text hover:bg-white/5">
             Cancel
           </button>
           <button onClick={handleSave} className="flex items-center gap-2 rounded-xl bg-primary px-6 py-2 text-xs font-bold text-black shadow-[0_0_20px_rgba(88,213,247,0.3)] hover:scale-[1.02] active:scale-[0.98]">
             <Save size={14} /> Save Properties
           </button>
        </div>

      </div>
    </div>
  );
}
