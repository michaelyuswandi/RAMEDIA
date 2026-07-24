import { useState } from 'react';
import { X, FileImage, FileText, Plus, Video } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import { ipcMediaService } from '../../core/services/ipcMediaService';
import type { Media } from '../../electron/database/schema';
import { useI18n } from '../../i18n';
import { toRenderableMediaUrl } from '../../core/utils/mediaUrl';
import { appendMediaTag, SCHEDULE_ONLY_MEDIA_TAG } from '../../core/utils/mediaVisibility';
import { importPdfWithRasterizerDetailed } from '../../core/utils/pdf';

interface AddScheduleItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AddScheduleItemModal({ isOpen, onClose }: AddScheduleItemModalProps) {
  const { t } = useI18n();
  const { addItem, isLoading: isSaving } = useScheduleStore();
  const [isLoading, setIsLoading] = useState(false);

  const tagAsScheduleOnly = async (media: Media) => {
    await ipcMediaService.update(media.id, {
      tags: appendMediaTag(media.tags, SCHEDULE_ONLY_MEDIA_TAG),
    });
  };

  const attachImportedMedia = async (mediaItems: Media[]) => {
    for (const media of mediaItems) {
      await tagAsScheduleOnly(media);
      await addItem({
        itemType: 'media',
        mediaId: media.id,
        content: media.filename,
        duration: 1,
      });
    }
  };

  const handleImportMedia = async () => {
    if (!window.api) {
      alert(t('addScheduleItem.desktopOnly'));
      return;
    }

    setIsLoading(true);
    try {
      const imported = await ipcMediaService.importFile();
      const mediaItems = Array.isArray(imported) ? (imported as Media[]) : [];
      if (mediaItems.length === 0) return;

      await attachImportedMedia(mediaItems);
      onClose();
    } catch (error) {
      alert(t('addScheduleItem.addMediaFailed', { message: (error as Error).message }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportPdf = async () => {
    if (!window.api) {
      alert(t('addScheduleItem.desktopOnly'));
      return;
    }

    setIsLoading(true);
    try {
      const imported = await importPdfWithRasterizerDetailed(ipcMediaService, toRenderableMediaUrl);
      if (imported.length === 0) return;

      await attachImportedMedia(imported);
      onClose();
    } catch (error) {
      alert(t('addScheduleItem.addMediaFailed', { message: (error as Error).message }));
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-text/10 rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-background px-6 py-4 border-b border-text/5 flex items-center gap-3">
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-text/10 bg-surface text-text/55 transition-colors hover:bg-text/10 hover:text-text"
            aria-label="Close add item"
            title="Close add item"
          >
            <X size={18} />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Plus size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text">{t('addScheduleItem.title')}</h2>
              <p className="text-xs text-text/50">{t('addScheduleItem.description')}</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 min-h-[360px]">
          <div className="grid gap-4 md:grid-cols-2">
            <button
              onClick={handleImportMedia}
              disabled={isLoading || isSaving}
              className="group rounded-2xl border border-text/10 bg-background p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileImage size={22} />
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-text">
                {t('addScheduleItem.uploadMedia')}
                <Video size={16} className="text-text/35 transition-colors group-hover:text-primary" />
              </div>
              <p className="mt-2 text-sm text-text/65">{t('addScheduleItem.uploadMediaDescription')}</p>
            </button>

            <button
              onClick={handleImportPdf}
              disabled={isLoading || isSaving}
              className="group rounded-2xl border border-text/10 bg-background p-5 text-left transition-all hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText size={22} />
              </div>
              <div className="flex items-center gap-2 text-sm font-bold text-text">
                {t('addScheduleItem.uploadPdf')}
                <Plus size={16} className="text-text/35 transition-colors group-hover:text-primary" />
              </div>
              <p className="mt-2 text-sm text-text/65">{t('addScheduleItem.uploadPdfDescription')}</p>
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary/80">
              {t('addScheduleItem.noteTitle')}
            </p>
            <p className="mt-2 text-sm text-text/70">{t('addScheduleItem.noteDescription')}</p>
          </div>

          {(isLoading || isSaving) && (
            <div className="mt-5 flex items-center gap-3 rounded-xl border border-text/10 bg-text/5 px-4 py-3 text-sm text-text/70">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              <span>{t('addScheduleItem.importing')}</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
