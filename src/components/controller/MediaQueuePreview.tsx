import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, Square, Volume2, VolumeX, RotateCcw, RotateCw, Globe, Gauge } from 'lucide-react';
import type { Media } from '../../electron/database/schema';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import YouTubeLayer from '../common/YouTubeLayer';

interface MediaQueuePreviewProps {
  media: Media;
  onPreviewTimeChange?: (time: number) => void;
  variant?: 'preview' | 'live';
}

function formatTime(time: number) {
  if (!Number.isFinite(time) || time < 0) return '00:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function MediaQueuePreview({ media, onPreviewTimeChange, variant = 'preview' }: MediaQueuePreviewProps) {
  const isLiveVariant = variant === 'live';
  const videoRef = useRef<HTMLVideoElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const parsedSettings = useMemo(() => {
    try {
      return media.playbackSettings ? JSON.parse(media.playbackSettings) : {};
    } catch {
      return {};
    }
  }, [media.playbackSettings]);
  const playbackSettings = useMemo(() => {
    if (parsedSettings.playbackSettings && typeof parsedSettings.playbackSettings === 'object') {
      return parsedSettings.playbackSettings as Record<string, any>;
    }
    return parsedSettings as Record<string, any>;
  }, [parsedSettings]);

  const initialVolume = isLiveVariant
    ? (typeof playbackSettings.volume === 'number' ? playbackSettings.volume : 100)
    : 0;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(playbackSettings.speed || 1);
  const [volume, setVolume] = useState(initialVolume);
  const [showVolumeControl, setShowVolumeControl] = useState(false);
  const [showSpeedControl, setShowSpeedControl] = useState(false);
  const [source, setSource] = useState(() => toRenderableMediaUrl(media.filepath));
  const volumePopoverRef = useRef<HTMLDivElement | null>(null);
  const isYouTube = media.mediaType === 'youtube' || media.filepath.includes('youtube.com') || media.filepath.includes('youtu.be');
  const isVideoOrYouTube = media.mediaType === 'video' || isYouTube;

  const mediaPlayback = usePresentationStore((state) => state.mediaPlayback);
  const controlLiveMediaPlayback = usePresentationStore((state) => state.controlLiveMediaPlayback);
  const livePlayback = isLiveVariant && mediaPlayback?.mediaId === media.id ? mediaPlayback : null;
  const displayedIsPlaying = livePlayback ? livePlayback.status === 'playing' : isPlaying;
  const getActualCurrentTime = () => videoRef.current?.currentTime ?? currentTime;

  useEffect(() => {
    let cancelled = false;

    const loadSource = async () => {
      const nextSource = toRenderableMediaUrl(media.filepath);

      if (media.mediaType !== 'video') {
        setSource(nextSource);
        return;
      }

      try {
        const response = await fetch(nextSource);
        if (!response.ok) throw new Error(`Failed to fetch video: ${response.status}`);
        const blob = await response.blob();
        if (cancelled) return;

        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
        }

        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;
        setSource(blobUrl);
      } catch {
        if (!cancelled) {
          setSource(nextSource);
        }
      }
    };

    void loadSource();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [media.filepath, media.id, media.mediaType]);

  useEffect(() => {
    if (!videoRef.current || media.mediaType !== 'video') return;
    videoRef.current.currentTime = playbackSettings.startTime || 0;
    videoRef.current.volume = isLiveVariant ? (volume ?? 0) / 100 : 0;
    videoRef.current.playbackRate = playbackSpeed || playbackSettings.speed || 1;
  }, [isLiveVariant, media.mediaType, playbackSettings.startTime, playbackSettings.speed, playbackSpeed, source, volume]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(isYouTube ? 300 : 0);
    setIsPlaying(false);
    setVolume(initialVolume);
    setShowVolumeControl(false);
  }, [initialVolume, isLiveVariant, isYouTube, media.id]);

  useEffect(() => {
    if (!showVolumeControl && !showSpeedControl) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (volumePopoverRef.current && target && !volumePopoverRef.current.contains(target)) {
        setShowVolumeControl(false);
        setShowSpeedControl(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [showVolumeControl, showSpeedControl]);

  const playPreview = () => {
    const nextTime = getActualCurrentTime();
    if (isLiveVariant) {
      controlLiveMediaPlayback({
        mediaId: media.id,
        status: 'playing',
        currentTime: nextTime,
        volume,
        playbackRate: playbackSpeed,
      });
    }
    if (videoRef.current) {
      void videoRef.current.play();
    }
    setIsPlaying(true);
  };

  const pausePreview = () => {
    const nextTime = getActualCurrentTime();
    if (isLiveVariant) {
      controlLiveMediaPlayback({
        mediaId: media.id,
        status: 'paused',
        currentTime: nextTime,
        volume,
        playbackRate: playbackSpeed,
      });
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
  };

  const stopPreview = () => {
    const resetTime = playbackSettings.startTime || 0;
    if (isLiveVariant) {
      controlLiveMediaPlayback({
        mediaId: media.id,
        status: 'stopped',
        currentTime: resetTime,
        volume,
        playbackRate: playbackSpeed,
      });
    }
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = resetTime;
    }
    setCurrentTime(resetTime);
    onPreviewTimeChange?.(resetTime);
    setIsPlaying(false);
  };

  const togglePlayback = () => {
    if (displayedIsPlaying) {
      pausePreview();
      return;
    }
    playPreview();
  };

  const handleSeek = (nextTime: number) => {
    setCurrentTime(nextTime);
    onPreviewTimeChange?.(nextTime);
    if (videoRef.current) {
      videoRef.current.currentTime = nextTime;
    }
    if (isLiveVariant) {
      controlLiveMediaPlayback({
        mediaId: media.id,
        status: displayedIsPlaying ? 'playing' : 'paused',
        currentTime: nextTime,
        volume,
        playbackRate: playbackSpeed,
      });
    }
  };

  const handleSkipTime = (deltaSeconds: number) => {
    const target = Math.max(0, getActualCurrentTime() + deltaSeconds);
    handleSeek(target);
  };

  const handleSpeedChange = (speedRate: number) => {
    setPlaybackSpeed(speedRate);
    if (videoRef.current) {
      videoRef.current.playbackRate = speedRate;
    }
    if (isLiveVariant) {
      controlLiveMediaPlayback({
        mediaId: media.id,
        status: displayedIsPlaying ? 'playing' : 'paused',
        currentTime: getActualCurrentTime(),
        volume,
        playbackRate: speedRate,
      });
    }
    setShowSpeedControl(false);
  };

  const handleVolume = (nextVolume: number) => {
    const nextTime = getActualCurrentTime();
    setVolume(nextVolume);
    if (videoRef.current) {
      videoRef.current.volume = nextVolume / 100;
    }
    if (isLiveVariant) {
      controlLiveMediaPlayback({
        mediaId: media.id,
        status: displayedIsPlaying ? 'playing' : 'paused',
        currentTime: nextTime,
        volume: nextVolume,
        playbackRate: playbackSpeed,
      });
    }
  };

  useEffect(() => {
    onPreviewTimeChange?.(currentTime);
  }, [currentTime, onPreviewTimeChange]);

  useEffect(() => {
    if (!livePlayback) return;
    const elapsed = livePlayback.status === 'playing' ? (Date.now() - livePlayback.updatedAt) / 1000 : 0;
    const nextTime = Math.max(0, livePlayback.currentTime + elapsed);
    setCurrentTime(nextTime);
    setVolume(livePlayback.volume);
    if (livePlayback.playbackRate) setPlaybackSpeed(livePlayback.playbackRate);

    if (videoRef.current) {
      if (Math.abs(videoRef.current.currentTime - nextTime) > 0.25) {
        videoRef.current.currentTime = nextTime;
      }
      videoRef.current.volume = isLiveVariant ? livePlayback.volume / 100 : 0;
      videoRef.current.playbackRate = livePlayback.playbackRate || playbackSettings.speed || 1;
      if (livePlayback.status === 'playing') {
        void videoRef.current.play().catch(() => undefined);
      } else {
        videoRef.current.pause();
      }
    }
  }, [isLiveVariant, livePlayback, playbackSettings.speed]);

  useEffect(() => {
    if (!livePlayback || livePlayback.status !== 'playing') return;
    const timer = window.setInterval(() => {
      setCurrentTime(Math.max(0, livePlayback.currentTime + (Date.now() - livePlayback.updatedAt) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [livePlayback]);

  const effectiveDuration = Math.max(media.duration || 0, duration || 0) || (isYouTube ? 300 : 300);

  if (!isVideoOrYouTube) {
    return (
      <div className={`overflow-hidden border border-white/8 ${isLiveVariant ? 'rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]' : 'rounded-[22px] bg-white/[0.03]'}`}>
        <div className="relative aspect-[16/9] overflow-hidden bg-black">
          <img src={source} alt={media.filename} className="h-full w-full object-contain" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.18))]" />
        </div>
        <div className={`flex items-center justify-between gap-4 border-t border-white/6 ${isLiveVariant ? 'px-5 py-4' : 'px-4 py-3'}`}>
          <div className="min-w-0">
            <div className={`${isLiveVariant ? 'text-base' : 'text-sm'} truncate font-semibold text-text`}>{media.filename}</div>
          </div>
          <div className={`rounded-full border border-white/10 bg-black/20 ${isLiveVariant ? 'px-3.5 py-1.5 text-[11px]' : 'px-3 py-1 text-[10px]'} font-medium uppercase tracking-[0.16em] text-text/45`}>
            Image
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden border border-white/8 ${isLiveVariant ? 'rounded-[24px] bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))]' : 'rounded-[22px] bg-white/[0.03]'}`}>
      {/* Media Player Area */}
      <div className="relative aspect-[16/9] overflow-hidden bg-black">
        {isYouTube ? (
          <YouTubeLayer
            source={media.filepath}
            renderMode={isLiveVariant ? 'output' : 'preview'}
            forceMuted={!isLiveVariant && volume === 0}
            controlledPlayback={livePlayback}
          />
        ) : (
          <video
            ref={videoRef}
            src={source}
            className="h-full w-full object-contain"
            loop
            muted={!isLiveVariant || volume === 0}
            onClick={displayedIsPlaying ? pausePreview : playPreview}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadedMetadata={() => {
              const nextDuration = videoRef.current?.duration || 0;
              const nextStartTime = playbackSettings.startTime || 0;
              setDuration(nextDuration);
              setCurrentTime(nextStartTime);
              if (videoRef.current) {
                videoRef.current.currentTime = nextStartTime;
                videoRef.current.pause();
              }
              setIsPlaying(false);
              onPreviewTimeChange?.(nextStartTime);
            }}
            onTimeUpdate={() => {
              const nextTime = videoRef.current?.currentTime || 0;
              setCurrentTime(nextTime);
              onPreviewTimeChange?.(nextTime);
            }}
          />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(0,0,0,0.24))]" />

        {isYouTube && (
          <span className="absolute top-3 left-3 rounded-lg bg-red-600/90 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow backdrop-blur flex items-center gap-1.5">
            <Globe size={12} /> {isLiveVariant ? 'YOUTUBE LIVE' : 'YOUTUBE PREVIEW'}
          </span>
        )}

        {!isLiveVariant && volume === 0 && (
          <span className="absolute top-3 right-3 rounded-lg bg-slate-900/80 px-2.5 py-1 text-[10px] font-semibold text-slate-300 backdrop-blur border border-white/10">
            🔇 PREVIEW (MUTED)
          </span>
        )}
      </div>

      {/* Control Bar - Only rendered when isLiveVariant is TRUE, or simple title in preview */}
      {!isLiveVariant ? (
        <div className="border-t border-white/6 px-4 py-3 flex items-center justify-between">
          <div className="text-sm font-semibold text-text truncate">{media.filename}</div>
          <span className="text-[10px] font-mono text-text/40 uppercase tracking-wider">Preview Only</span>
        </div>
      ) : (
        <div className="border-t border-white/6 px-5 py-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="text-base truncate font-semibold text-text">{media.filename}</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-bold">
                {playbackSpeed}x SPEED
              </span>
            </div>
          </div>

          {/* Scrubber Timeline */}
          <div className="flex items-center gap-3 mb-3">
            <span className="w-14 text-[12px] font-mono text-text/42">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.1}
              value={Math.min(currentTime, effectiveDuration)}
              onInput={(e) => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
              onChange={(e) => handleSeek(parseFloat((e.target as HTMLInputElement).value))}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
            />
            <span className="w-14 text-[12px] text-right font-mono text-text/42">
              {formatTime(effectiveDuration)}
            </span>
          </div>

          {/* Buttons Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Rewind -10s */}
              <button
                onClick={() => handleSkipTime(-10)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-text/78 hover:border-primary/30 hover:text-white transition-colors"
                title="Rewind -10s"
              >
                <RotateCcw size={14} />
              </button>

              {/* Play/Pause */}
              <button
                onClick={togglePlayback}
                className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-text/78 transition-colors duration-150 hover:border-primary/30 hover:bg-primary hover:text-black h-10 w-10"
                title={displayedIsPlaying ? 'Pause live video' : 'Play live video'}
              >
                {displayedIsPlaying ? <Pause size={15} /> : <Play size={15} className="ml-0.5" />}
              </button>

              {/* Stop */}
              <button
                onClick={stopPreview}
                className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-text/78 transition-colors duration-150 hover:border-primary/30 hover:text-text h-10 w-10"
                title="Stop playback"
              >
                <Square size={14} />
              </button>

              {/* Forward +10s */}
              <button
                onClick={() => handleSkipTime(10)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/25 text-text/78 hover:border-primary/30 hover:text-white transition-colors"
                title="Forward +10s"
              >
                <RotateCw size={14} />
              </button>
            </div>

            <div ref={volumePopoverRef} className="flex items-center gap-2 relative">
              {/* Playback Speed Popover */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowSpeedControl((prev) => !prev);
                    setShowVolumeControl(false);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-black/25 text-xs text-text/80 hover:bg-white/10 transition-colors"
                  title="Playback Speed"
                >
                  <Gauge size={13} />
                  <span className="font-mono font-bold text-[11px]">{playbackSpeed}x</span>
                </button>

                {showSpeedControl && (
                  <div className="absolute right-0 bottom-11 z-20 w-36 rounded-xl border border-white/10 bg-[#0a0d13]/95 p-2 shadow-xl backdrop-blur">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-white/40 mb-1.5 px-2">
                      Kecepatan Putar
                    </div>
                    {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => handleSpeedChange(rate)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs font-mono transition-colors ${
                          playbackSpeed === rate ? 'bg-primary text-black font-bold' : 'text-white/70 hover:bg-white/10'
                        }`}
                      >
                        {rate}x {rate === 1.0 ? '(Normal)' : ''}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Volume Popover */}
              <button
                onClick={() => {
                  setShowVolumeControl((value) => !value);
                  setShowSpeedControl(false);
                }}
                className="flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/25 text-text/78 transition-colors duration-150 hover:border-primary/30 hover:text-text h-10 w-10"
                title="Volume"
              >
                {volume === 0 ? <VolumeX size={15} /> : <Volume2 size={15} />}
              </button>
              {showVolumeControl && (
                <div className="absolute right-0 z-20 w-44 rounded-2xl border border-white/10 bg-[#0a0d13]/95 p-3 shadow-[0_12px_30px_rgba(0,0,0,0.35)] backdrop-blur bottom-12">
                  <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-text/34">
                    <span>Volume</span>
                    <span className="font-mono">{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={volume}
                    onInput={(e) => handleVolume(parseInt((e.target as HTMLInputElement).value, 10))}
                    className="h-2 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-primary"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

