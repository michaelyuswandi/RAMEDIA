import { useEffect, useMemo, useState } from 'react';
import { Clock, FileText, StickyNote, X } from 'lucide-react';
import type { EnrichedScheduleItem } from '../../electron/database/scheduleService';
import { useI18n } from '../../i18n';

interface EditScheduleItemModalProps {
  isOpen: boolean;
  item: EnrichedScheduleItem | null;
  itemTitle: string;
  isSaving?: boolean;
  onClose: () => void;
  onSubmit: (id: string, data: { content?: string | null; duration: number | null; notes: string | null }) => Promise<void>;
}

export default function EditScheduleItemModal({
  isOpen,
  item,
  itemTitle,
  isSaving = false,
  onClose,
  onSubmit,
}: EditScheduleItemModalProps) {
  const { t } = useI18n();
  const canEditTitle = useMemo(
    () => item?.itemType === 'custom' || item?.itemType === 'announcement',
    [item?.itemType],
  );

  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !item) return;

    setTitle(typeof item.content === 'string' ? item.content : '');
    setDuration(item.duration != null ? String(item.duration) : '');
    setNotes(item.notes || '');
    setError(null);
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (canEditTitle && !title.trim()) {
      setError(t('editScheduleItem.titleRequired'));
      return;
    }

    const nextDuration = duration.trim() === '' ? null : Number(duration);
    if (nextDuration != null && (!Number.isFinite(nextDuration) || nextDuration < 0)) {
      setError(t('editScheduleItem.durationInvalid'));
      return;
    }

    setError(null);

    await onSubmit(item.id, {
      ...(canEditTitle ? { content: title.trim() } : {}),
      duration: nextDuration == null ? null : Math.round(nextDuration),
      notes: notes.trim() || null,
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg rounded-xl border border-text/10 bg-surface shadow-2xl">
        <div className="flex items-start gap-3 border-b border-text/10 px-6 py-4">
          <button
            onClick={onClose}
            className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-text/10 bg-background text-text/55 transition-colors hover:bg-text/10 hover:text-text"
            aria-label="Close item editor"
            title="Close item editor"
          >
            <X size={18} />
          </button>
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-text">{t('editScheduleItem.title')}</h3>
            <p className="mt-1 text-xs text-text/50">
              {t('editScheduleItem.description')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-text">{t('editScheduleItem.sourceItem')}</label>
            <div className="rounded-lg border border-text/10 bg-background px-4 py-3 text-sm text-text/80">
              {itemTitle}
            </div>
          </div>

          {canEditTitle && (
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-text">
                <FileText size={14} />
                {t('editScheduleItem.itemTitle')}
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-text/20 bg-background px-3 py-2 text-sm text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50 transition-colors"
                placeholder={t('editScheduleItem.itemTitlePlaceholder')}
                maxLength={140}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <Clock size={14} />
              {t('editScheduleItem.durationLabel')}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-text/20 bg-background px-3 py-2 text-sm text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="5"
            />
          </div>

          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-text">
              <StickyNote size={14} />
              {t('editScheduleItem.notesLabel')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full resize-none rounded-lg border border-text/20 bg-background px-3 py-2 text-sm text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder={t('editScheduleItem.notesPlaceholder')}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-text/20 px-4 py-2 text-sm font-medium transition-colors hover:bg-text/5"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg border border-primary/30 bg-primary/20 px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-primary/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? t('common.saving') : t('editScheduleItem.saveItem')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
