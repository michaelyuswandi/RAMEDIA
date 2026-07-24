import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Music2, X } from 'lucide-react';
import SongEditorModal from '../components/modals/SongEditorModal';
import { ipcSongService, type SongWithSlides } from '../core/services/ipcSongService';

export default function SongEditorView() {
  const location = useLocation();
  const id = new URLSearchParams(location.search).get('id');
  const [song, setSong] = useState<SongWithSlides | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(id));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!id) {
      document.title = 'New Song — RAMEDIA';
      setIsLoading(false);
      return;
    }
    void ipcSongService.getById(id).then((nextSong) => {
      if (cancelled) return;
      if (!nextSong) throw new Error('Song could not be found. It may have been deleted.');
      setSong(nextSong);
      document.title = `Edit Song: ${nextSong.title} — RAMEDIA`;
    }).catch((loadError) => {
      if (!cancelled) setError((loadError as Error).message || 'Failed to open song.');
    }).finally(() => {
      if (!cancelled) setIsLoading(false);
    });
    return () => { cancelled = true; };
  }, [id]);

  const closeWindow = () => {
    if (window.api?.workspaceWindow) window.api.workspaceWindow.close();
    else window.close();
  };

  if (isLoading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-6 text-text">
        <div className="w-full max-w-md space-y-4">
          <div className="h-3 w-24 animate-pulse rounded bg-text/10" />
          <div className="h-8 w-64 animate-pulse rounded bg-text/10" />
          <div className="h-48 animate-pulse rounded-xl border border-text/10 bg-surface" />
          <p className="text-xs font-semibold text-text/40">Loading song workspace…</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="grid min-h-[100dvh] place-items-center bg-background px-6 text-text">
        <section className="w-full max-w-lg border-t border-error/40 pt-6">
          <Music2 size={28} className="text-error" />
          <h1 className="mt-5 text-xl font-semibold">Song editor unavailable</h1>
          <p className="mt-2 text-sm leading-relaxed text-text/50">{error}</p>
          <button type="button" onClick={closeWindow} className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg border border-text/15 px-4 text-sm font-semibold text-text/70 transition hover:bg-text/5 active:scale-[0.98]">
            <X size={15} /> Close editor
          </button>
        </section>
      </main>
    );
  }

  return (
    <SongEditorModal
      song={song}
      standalone
      onDirtyChange={(dirty) => window.api?.workspaceWindow?.setDirty(dirty)}
      onClose={closeWindow}
      onSave={(songId) => window.api?.workspaceWindow?.notifySaved({ kind: 'song', id: songId || id })}
    />
  );
}

