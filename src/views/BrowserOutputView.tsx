import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { RoleOutputSurface } from '../components/common/RoleOutputSurface';
import type { LiveCaptureState, MediaPlaybackState, OutputAlertMessage, PointerState, Slide, SlideAnnotation, TransitionMode } from '../core/models/types';
import { isScreenProfileId, type ScreenProfileId } from '../core/screens/screenProfiles';
import { DEFAULT_LOGO_OUTPUT_SETTINGS, type LogoOutputSettings, type OutputChannel } from '../core/models/outputSettings';

interface BrowserOutputSnapshot {
  currentSlide: Slide | null;
  previousSlide: Slide | null;
  nextSlide: Slide | null;
  isBlack: boolean;
  isClear: boolean;
  isLogo: boolean;
  logoOutput: LogoOutputSettings;
  transitionMode: TransitionMode;
  annotations: Record<string, SlideAnnotation[]>;
  pointer: PointerState;
  liveCapture: LiveCaptureState;
  mediaPlayback: MediaPlaybackState | null;
  manualAlert: OutputAlertMessage | null;
  role: ScreenProfileId;
  outputName: string | null;
  assignedOutput: OutputChannel | null;
}

const EMPTY_SNAPSHOT: BrowserOutputSnapshot = {
  currentSlide: null,
  previousSlide: null,
  nextSlide: null,
  isBlack: false,
  isClear: false,
  isLogo: false,
  logoOutput: DEFAULT_LOGO_OUTPUT_SETTINGS,
  transitionMode: 'fade',
  annotations: {},
  pointer: {
    enabled: false,
    visible: false,
    x: 0.5,
    y: 0.5,
  },
  liveCapture: {
    active: false,
    sourceType: null,
    sourceId: null,
    sourceName: null,
    includeAudio: false,
    startedAt: null,
    error: null,
  },
  mediaPlayback: null,
  manualAlert: null,
  role: 'audience',
  outputName: null,
  assignedOutput: null,
};

export default function BrowserOutputView() {
  const { pairingCode } = useParams();
  const [snapshot, setSnapshot] = useState<BrowserOutputSnapshot>(EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [webrtcStatus, setWebrtcStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const webrtcVideoRef = useRef<HTMLVideoElement | null>(null);
  const shouldShowWebrtcLayer =
    webrtcStatus === 'connected'
    && snapshot.liveCapture.active
    && !snapshot.isLogo
    && !snapshot.isBlack;
  const hasTargetedManualAlert = !!snapshot.manualAlert
    && !!snapshot.assignedOutput?.id
    && snapshot.manualAlert.targetOutputIds.includes(snapshot.assignedOutput.id);

  useEffect(() => {
    if (!pairingCode) return;
    let active = true;

    const hydrate = async () => {
      try {
        const response = await fetch(`/api/browser-output/${pairingCode}/state`);
        if (!response.ok) throw new Error('Failed to fetch browser output state');
        const next = await response.json() as BrowserOutputSnapshot;
        if (active) {
          setSnapshot({
            ...EMPTY_SNAPSHOT,
            ...next,
            role: isScreenProfileId(next.role) ? next.role : 'audience',
          });
          setStatus('connected');
        }
      } catch {
        if (active) setStatus('error');
      }
    };

    void hydrate();

    const eventSource = new EventSource(`/api/browser-output/${pairingCode}/events`);
    eventSource.addEventListener('state', (event) => {
      if (!active) return;
      const next = JSON.parse(event.data) as BrowserOutputSnapshot;
      setSnapshot({
        ...EMPTY_SNAPSHOT,
        ...next,
        role: isScreenProfileId(next.role) ? next.role : 'audience',
      });
      setStatus('connected');
    });
    eventSource.onerror = () => {
      if (active) setStatus('error');
    };

    return () => {
      active = false;
      eventSource.close();
    };
  }, [pairingCode]);

  useEffect(() => {
    if (!pairingCode) return;

    let active = true;
    let peerId: string | null = null;
    let hostIceIndex = 0;
    const pendingCandidates: RTCIceCandidateInit[] = [];
    const pc = new RTCPeerConnection({ iceServers: [] });

    const postBrowserIce = async (candidate: RTCIceCandidateInit) => {
      if (!peerId) {
        pendingCandidates.push(candidate);
        return;
      }

      await fetch(`/api/webrtc/${peerId}/ice/browser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidate }),
      }).catch(() => undefined);
    };

    const start = async () => {
      try {
        setWebrtcStatus('connecting');
        pc.ontrack = (event) => {
          const [stream] = event.streams;
          if (!stream || !webrtcVideoRef.current) return;
          webrtcVideoRef.current.srcObject = stream;
          void webrtcVideoRef.current.play().catch(() => undefined);
          if (active) setWebrtcStatus('connected');
        };
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            void postBrowserIce(event.candidate.toJSON());
          }
        };
        pc.onconnectionstatechange = () => {
          if (!active) return;
          if (pc.connectionState === 'connected') setWebrtcStatus('connected');
          if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) setWebrtcStatus('error');
        };

        pc.addTransceiver('video', { direction: 'recvonly' });
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        const offerResponse = await fetch(`/api/webrtc/${pairingCode}/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offer }),
        });
        if (!offerResponse.ok) throw new Error('WebRTC offer rejected');
        const offerResult = await offerResponse.json() as { peerId: string };
        peerId = offerResult.peerId;
        await Promise.all(pendingCandidates.splice(0).map(postBrowserIce));

        const answerTimer = window.setInterval(async () => {
          if (!active || !peerId || pc.remoteDescription) return;
          const answerResponse = await fetch(`/api/webrtc/${peerId}/answer`).catch(() => null);
          if (!answerResponse?.ok) return;
          const answerResult = await answerResponse.json() as { answer: RTCSessionDescriptionInit | null };
          if (answerResult.answer && !pc.remoteDescription) {
            await pc.setRemoteDescription(answerResult.answer).catch(() => undefined);
          }
        }, 500);

        const iceTimer = window.setInterval(async () => {
          if (!active || !peerId || !pc.remoteDescription) return;
          const iceResponse = await fetch(`/api/webrtc/${peerId}/ice/host?after=${hostIceIndex}`).catch(() => null);
          if (!iceResponse?.ok) return;
          const iceResult = await iceResponse.json() as { candidates: RTCIceCandidateInit[]; next: number };
          hostIceIndex = iceResult.next;
          for (const candidate of iceResult.candidates) {
            await pc.addIceCandidate(candidate).catch(() => undefined);
          }
        }, 500);

        return () => {
          window.clearInterval(answerTimer);
          window.clearInterval(iceTimer);
        };
      } catch (error) {
        console.error('[Browser Output] WebRTC failed:', error);
        if (active) setWebrtcStatus('error');
        return undefined;
      }
    };

    let stopPolling: (() => void) | undefined;
    void start().then((cleanup) => {
      stopPolling = cleanup;
    });

    return () => {
      active = false;
      stopPolling?.();
      pc.close();
      if (webrtcVideoRef.current) {
        webrtcVideoRef.current.srcObject = null;
      }
    };
  }, [pairingCode]);

  if (!pairingCode) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#020617] text-white">
        Invalid pairing code.
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-black">
      <RoleOutputSurface
        role={snapshot.assignedOutput?.role || snapshot.role}
        outputConfig={snapshot.assignedOutput}
        outputName={snapshot.assignedOutput?.name || snapshot.outputName || undefined}
        currentSlide={snapshot.currentSlide}
        previousSlide={snapshot.previousSlide}
        nextSlide={snapshot.nextSlide}
        isBlack={snapshot.isBlack}
        isClear={snapshot.isClear}
        isLogo={snapshot.isLogo}
        logoOutput={snapshot.logoOutput}
        pointer={snapshot.pointer}
        annotations={snapshot.annotations}
        transitionMode={snapshot.transitionMode}
        liveCapture={snapshot.liveCapture}
        mediaPlayback={snapshot.mediaPlayback}
        manualAlert={snapshot.manualAlert}
      />

      <video
        ref={webrtcVideoRef}
        className={`pointer-events-none absolute inset-0 z-30 h-full w-full bg-black object-contain transition-opacity duration-200 ${
          shouldShowWebrtcLayer ? 'opacity-100' : 'opacity-0'
        }`}
        autoPlay
        playsInline
        muted
      />

      {((!snapshot.currentSlide && !snapshot.liveCapture.active && !snapshot.isBlack && !snapshot.isLogo && !hasTargetedManualAlert) || status !== 'connected') ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 px-6">
          <div className="max-w-lg rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-5 text-center text-white shadow-2xl backdrop-blur-md">
            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/42">Browser Output</div>
            <div className="mt-3 text-xl font-semibold">
              {status === 'connected'
                ? 'Connected, waiting for live slide'
                : status === 'connecting'
                  ? 'Connecting to output server'
                  : 'Cannot load this browser client'}
            </div>
            <div className="mt-2 text-sm leading-6 text-white/58">
              {status === 'connected'
                ? `Pairing code ${pairingCode?.toUpperCase()} is valid. Push a slide or capture source to live.`
                : `Check that RAMEDIA is running in Electron and the pairing code ${pairingCode?.toUpperCase()} exists.`}
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 backdrop-blur-sm">
        {webrtcStatus === 'connected'
          ? 'WebRTC'
          : status === 'connected'
            ? 'Connected'
            : status === 'connecting'
              ? 'Connecting'
              : 'Reconnecting'}
      </div>
    </div>
  );
}
