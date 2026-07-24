import type { LogoOutputSettings } from '../../core/models/outputSettings';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';

function resolveLogoSource(settings: LogoOutputSettings) {
  const isBrowserOutput =
    typeof window !== 'undefined'
    && !window.api
    && (window.location.protocol === 'http:' || window.location.protocol === 'https:')
    && window.location.pathname.startsWith('/browser-output');

  if (isBrowserOutput && settings.mediaId) {
    return `/api/media/${encodeURIComponent(settings.mediaId)}/stream`;
  }

  return toRenderableMediaUrl(settings.source);
}

export function LogoOutputSurface({ settings, showStatus = false }: { settings: LogoOutputSettings; showStatus?: boolean }) {
  const source = resolveLogoSource(settings);
  const objectFit = settings.fit;

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-black">
      {source && settings.mediaType === 'video' ? (
        <video
          key={source}
          src={source}
          className="h-full w-full"
          style={{ objectFit }}
          autoPlay
          loop={settings.loop}
          muted
          playsInline
          disablePictureInPicture
        />
      ) : source && settings.mediaType === 'image' ? (
        <img src={source} alt="" className="h-full w-full" style={{ objectFit }} />
      ) : (
        <div className="text-center text-white/35">
          <div className="text-lg font-semibold">Logo media belum dipilih</div>
          <div className="mt-2 text-sm">Pilih gambar atau video di Settings → Logo Output.</div>
        </div>
      )}

      {showStatus && (
        <div className="absolute bottom-3 left-3 rounded-md bg-amber-400 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-950 shadow-sm">
          Logo Live
        </div>
      )}
    </div>
  );
}
