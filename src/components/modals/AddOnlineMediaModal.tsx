import { useState, useEffect } from 'react';
import { Globe, X, Check, Loader2, Play } from 'lucide-react';
import { parseYouTubeVideoId, fetchYouTubeDetails, type YouTubeVideoDetails } from '../../core/utils/youtube';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import { useI18n } from '../../i18n';

interface AddOnlineMediaModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddOnlineMediaModal({ onClose, onSuccess }: AddOnlineMediaModalProps) {
  const { t } = useI18n();
  const [urlInput, setUrlInput] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [details, setDetails] = useState<YouTubeVideoDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const videoId = parseYouTubeVideoId(urlInput);
    if (!videoId) {
      setDetails(null);
      setError(urlInput.trim().length > 5 ? (t('mediaPanel.invalidUrl') || 'Invalid YouTube URL') : null);
      return;
    }

    setError(null);
    let isCancelled = false;

    const loadDetails = async () => {
      setLoading(true);
      const res = await fetchYouTubeDetails(videoId);
      if (!isCancelled) {
        setDetails(res);
        if (res && (!customTitle || customTitle === details?.title)) {
          setCustomTitle(res.title);
        }
        setLoading(false);
      }
    };

    const timer = setTimeout(loadDetails, 400);
    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [urlInput]);

  const handleSave = async () => {
    if (!details) return;

    try {
      setLoading(true);
      const mediaTitle = customTitle.trim() || details.title || `YouTube Video (${details.videoId})`;
      const playbackSettings = JSON.stringify({
        youtubeId: details.videoId,
        volume: 100,
        speed: 1,
        startTime: 0,
        behavior: 'stop',
      });

      await ipcMediaService.create({
        filename: mediaTitle,
        filepath: details.url,
        mediaType: 'youtube',
        mimeType: 'video/youtube',
        thumbnail: details.thumbnailUrl,
        playbackSettings,
        tags: JSON.stringify(['youtube', 'online']),
      });

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Failed to save YouTube online media:', err);
      setError(t('mediaPanel.saveError') || 'Failed to save media');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 text-white shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Globe size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-base tracking-wide text-white">{t('mediaPanel.addOnlineMedia') || 'Add Online Media (YouTube)'}</h3>
              <p className="text-xs text-white/50">{t('mediaPanel.addOnlineDesc') || 'Stream video live without downloading'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
              {t('mediaPanel.youtubeUrl') || 'YouTube Video Link / URL'}
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                autoFocus
                placeholder="https://www.youtube.com/watch?v=..."
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 focus:border-red-500/60 focus:bg-white/10 focus:outline-none transition-colors"
              />
              {loading && (
                <div className="absolute right-3 text-red-400">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}
            </div>
            {error && <p className="mt-1.5 text-xs text-red-400 font-medium">{error}</p>}
          </div>

          {/* Preview Card */}
          {details && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex gap-4 items-center">
              <div className="relative aspect-video w-36 overflow-hidden rounded-lg border border-white/10 bg-black flex-shrink-0">
                <img src={details.thumbnailUrl} alt={details.title} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Play size={20} className="text-white drop-shadow-md" fill="white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <span className="inline-block rounded bg-red-500/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-400 border border-red-500/30 mb-1">
                  YouTube ID: {details.videoId}
                </span>
                <p className="text-xs font-medium text-white truncate">{details.title}</p>
                {details.authorName && <p className="text-[11px] text-white/50 truncate mt-0.5">{details.authorName}</p>}
              </div>
            </div>
          )}

          {details && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                {t('mediaPanel.mediaTitle') || 'Media Title'}
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white focus:border-red-500/60 focus:outline-none transition-colors"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/10 px-6 py-4 bg-black/20">
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
          >
            {t('common.cancel') || 'Cancel'}
          </button>
          <button
            onClick={handleSave}
            disabled={!details || loading}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-red-600/25 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Check size={16} />
            {t('common.save') || 'Add to Library'}
          </button>
        </div>
      </div>
    </div>
  );
}
