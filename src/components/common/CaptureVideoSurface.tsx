import { useEffect, useRef, useState } from 'react';
import type { LiveCaptureState } from '../../core/models/types';

interface CaptureVideoSurfaceProps {
  capture: LiveCaptureState;
  mode?: 'output' | 'preview';
  onError?: (message: string) => void;
}

function getCaptureErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') {
      return 'Screen capture permission is required. Enable Screen Recording for RAMEDIA, then restart the app.';
    }

    if (error.name === 'NotFoundError') {
      return 'The selected capture source is no longer available.';
    }
  }

  return error instanceof Error ? error.message : 'Capture failed';
}

export function CaptureVideoSurface({ capture, mode = 'output', onError }: CaptureVideoSurfaceProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (mode !== 'output' || !capture.active) return undefined;

    let isCancelled = false;

    const stopStream = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };

    const startCapture = async () => {
      try {
        stopStream();
        setLocalError(null);
        setIsStarting(true);

        const stream =
          capture.sourceType === 'device' && capture.sourceId
            ? await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: capture.sourceId } },
                audio: capture.includeAudio,
              })
            : capture.sourceId
            ? await navigator.mediaDevices
                .getUserMedia({
                  audio: false,
                  video: {
                    mandatory: {
                      chromeMediaSource: 'desktop',
                      chromeMediaSourceId: capture.sourceId,
                      maxFrameRate: 30,
                    },
                  } as unknown as MediaTrackConstraints,
                })
                .catch(() =>
                  navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: false,
                  }),
                )
            : await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: false,
              });

        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        const [videoTrack] = stream.getVideoTracks();
        if (!videoTrack) {
          throw new Error('Capture started without a video track.');
        }

        if (videoTrack) {
          videoTrack.onended = () => {
            if (!isCancelled) {
              const message = 'Capture source ended.';
              setLocalError(message);
              onError?.(message);
            }
          };
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setIsStarting(false);
        }
      } catch (error) {
        if (!isCancelled) {
          const message = getCaptureErrorMessage(error);
          setLocalError(message);
          setIsStarting(false);
          onError?.(message);
        }
      }
    };

    void startCapture();

    return () => {
      isCancelled = true;
      setIsStarting(false);
      stopStream();
    };
  }, [capture.active, capture.sourceId, capture.sourceType, capture.includeAudio, mode, onError]);

  if (mode !== 'output') {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        <div className="max-w-[78%] rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-300">Live Capture</div>
          <div className="mt-2 truncate text-sm font-semibold text-white/88">{capture.sourceName || 'Screen share'}</div>
          <div className="mt-1 text-[11px] leading-5 text-white/42">Showing on output</div>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-black">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={!capture.includeAudio}
        className="h-full w-full object-contain"
      />

      {isStarting && !localError && !capture.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">Starting Capture</div>
            <div className="mt-2 text-sm text-white/62">{capture.sourceName || 'Preparing live source'}</div>
          </div>
        </div>
      )}

      {(localError || capture.error) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="max-w-[72%] rounded-xl border border-red-400/25 bg-red-950/35 px-5 py-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-300">Capture Error</div>
            <div className="mt-2 text-sm leading-6 text-white/78">{localError || capture.error}</div>
          </div>
        </div>
      )}
    </div>
  );
}
