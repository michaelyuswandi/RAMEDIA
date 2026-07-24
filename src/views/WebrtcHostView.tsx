import { useEffect, useRef, useState } from 'react';

type HostPeer = {
  pc: RTCPeerConnection;
  browserIceIndex: number;
};

export default function WebrtcHostView() {
  const streamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, HostPeer>>(new Map());
  const [status, setStatus] = useState('Starting WebRTC host');

  useEffect(() => {
    let active = true;

    let streamError: string | null = null;

    const ensureStream = async () => {
      if (streamRef.current) return streamRef.current;
      if (streamError) throw new Error(streamError);

      const prepared = await window.api.webrtc.prepareProgramCapture();
      if (!prepared.ok) {
        streamError = prepared.error || 'Unable to prepare output capture';
        throw new Error(streamError);
      }

      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            frameRate: { ideal: 30, max: 30 },
          },
          audio: false,
        });
        streamRef.current = stream;
        setStatus(`Streaming ${prepared.sourceName || 'program output'}`);
        return stream;
      } catch (err) {
        streamError = err instanceof Error ? err.message : 'Failed to capture stream display media';
        throw new Error(streamError);
      }
    };

    const closePeer = (peerId: string) => {
      const peer = peersRef.current.get(peerId);
      if (!peer) return;
      peer.pc.close();
      peersRef.current.delete(peerId);
    };

    const acceptOffer = async (peerId: string, offer: RTCSessionDescriptionInit) => {
      if (peersRef.current.has(peerId)) return;

      const stream = await ensureStream();
      const pc = new RTCPeerConnection({ iceServers: [] });
      const peer: HostPeer = { pc, browserIceIndex: 0 };
      peersRef.current.set(peerId, peer);

      stream.getVideoTracks().forEach((track) => pc.addTrack(track, stream));
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          void window.api.webrtc.sendHostIce({ peerId, candidate: event.candidate.toJSON() });
        }
      };
      pc.onconnectionstatechange = () => {
        if (['closed', 'disconnected', 'failed'].includes(pc.connectionState)) {
          closePeer(peerId);
        }
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await window.api.webrtc.sendAnswer({ peerId, answer });
    };

    let lastLoggedError: string | null = null;
    const poll = async () => {
      try {
        const offers = await window.api.webrtc.getPendingOffers();
        await Promise.all(offers.map((offer) => acceptOffer(offer.peerId, offer.offer)));

        for (const [peerId, peer] of peersRef.current.entries()) {
          const response = await window.api.webrtc.getBrowserIce({ peerId, after: peer.browserIceIndex });
          peer.browserIceIndex = response.next;
          for (const candidate of response.candidates) {
            await peer.pc.addIceCandidate(candidate).catch(() => undefined);
          }
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'WebRTC host failed';
        if (lastLoggedError !== msg) {
          console.error('[WebRTC Host] Poll failed:', error);
          lastLoggedError = msg;
        }
        setStatus(msg);
      }
    };

    void poll();
    const timer = window.setInterval(() => {
      if (active) void poll();
    }, 500);

    return () => {
      active = false;
      window.clearInterval(timer);
      peersRef.current.forEach((peer) => peer.pc.close());
      peersRef.current.clear();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-6 text-center text-white">
      <div>
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-white/40">RAMEDIA WebRTC Host</div>
        <div className="mt-3 text-lg">{status}</div>
      </div>
    </div>
  );
}
