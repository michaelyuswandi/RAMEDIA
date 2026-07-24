import { useEffect, useRef } from 'react';
import type { MediaPlaybackState } from '../../core/models/types';
import { parseYouTubeVideoId } from '../../core/utils/youtube';

interface YouTubeLayerProps {
  source: string; // YouTube URL or Video ID
  objectFit?: string;
  renderMode: 'output' | 'preview' | 'thumbnail';
  forceMuted?: boolean;
  controlledPlayback?: MediaPlaybackState | null;
}

export default function YouTubeLayer({
  source,
  renderMode,
  forceMuted = false,
  controlledPlayback,
}: YouTubeLayerProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoId = parseYouTubeVideoId(source) || source;
  const lastStateRef = useRef<{ status?: string; time?: number; volume?: number; rate?: number }>({});

  const sendYouTubeCommand = (func: string, args: any[] = []) => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    try {
      iframeRef.current.contentWindow.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
        }),
        '*'
      );
    } catch (err) {
      console.warn('Failed to send command to YouTube iframe:', err);
    }
  };

  const isMuted = forceMuted || (controlledPlayback ? controlledPlayback.volume === 0 : false);

  // Sync state from controlledPlayback or renderMode
  useEffect(() => {
    if (!controlledPlayback) {
      if (renderMode === 'output' && !forceMuted) {
        sendYouTubeCommand('unMute');
        sendYouTubeCommand('playVideo');
      } else {
        sendYouTubeCommand('mute');
        sendYouTubeCommand('pauseVideo');
      }
      return;
    }

    const { status, currentTime, volume, playbackRate } = controlledPlayback;

    // Handle play/pause/stop status
    if (status !== lastStateRef.current.status) {
      lastStateRef.current.status = status;
      if (status === 'playing') {
        sendYouTubeCommand('playVideo');
      } else if (status === 'paused') {
        sendYouTubeCommand('pauseVideo');
      } else if (status === 'stopped') {
        sendYouTubeCommand('pauseVideo');
        sendYouTubeCommand('seekTo', [0, true]);
      }
    }

    // Handle seeking if time changed significantly (> 0.3 sec difference)
    if (typeof currentTime === 'number' && Math.abs((lastStateRef.current.time || 0) - currentTime) > 0.3) {
      lastStateRef.current.time = currentTime;
      sendYouTubeCommand('seekTo', [currentTime, true]);
    } else {
      lastStateRef.current.time = currentTime;
    }

    // Handle volume
    const targetVolume = isMuted ? 0 : Math.max(0, Math.min(100, volume));
    if (lastStateRef.current.volume !== targetVolume) {
      lastStateRef.current.volume = targetVolume;
      if (targetVolume === 0) {
        sendYouTubeCommand('mute');
      } else {
        sendYouTubeCommand('unMute');
        sendYouTubeCommand('setVolume', [targetVolume]);
      }
    }

    // Handle playback rate
    if (playbackRate && lastStateRef.current.rate !== playbackRate) {
      lastStateRef.current.rate = playbackRate;
      sendYouTubeCommand('setPlaybackRate', [playbackRate]);
    }
  }, [controlledPlayback, forceMuted, isMuted, renderMode]);

  const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?enablejsapi=1&autoplay=1&controls=0&showinfo=0&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1${isMuted ? '&mute=1' : ''}`;

  return (
    <div className="relative h-full w-full overflow-hidden bg-black flex items-center justify-center">
      <iframe
        ref={iframeRef}
        src={embedUrl}
        title="YouTube Video Layer"
        className="h-full w-full border-none pointer-events-none scale-105"
        allow="autoplay; encrypted-media"
      />
    </div>
  );
}
