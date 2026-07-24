import { useState, useEffect } from 'react';
import { Clock, GripVertical, MoreVertical, Plus, Music, Video, BookOpen, FileText, Trash2, Copy, Calendar, Edit, MonitorUp } from 'lucide-react';
import { TEMP_SCHEDULE_ID, useScheduleStore } from '../../core/stores/useScheduleStore';
import { useUIStore } from '../../core/stores/useUIStore';
import { formatDuration } from '../../utils/timeUtils';
import AddScheduleItemModal from '../modals/AddScheduleItemModal';
import ScheduleFormModal from '../modals/ScheduleFormModal';
import EditScheduleItemModal from '../modals/EditScheduleItemModal';
import { useToast } from '../common/Toast';
import { usePresentationStore } from '../../core/stores/usePresentationStore';
import { buildMediaVirtualSlides } from '../../core/utils/mediaSlides';
import { buildBibleVirtualSlides } from '../../core/utils/bibleSlides';
import { getIntlLocale, useI18n } from '../../i18n';

// Item type configuration with icons and colors
const ITEM_TYPE_CONFIG = {
  song: { icon: Music, labelKey: 'schedulePanel.typeSong', classes: 'bg-info/12 text-info border-info/25' },
  media: { icon: Video, labelKey: 'schedulePanel.typeMedia', classes: 'bg-primary/12 text-primary border-primary/25' },
  bible: { icon: BookOpen, labelKey: 'schedulePanel.typeBible', classes: 'bg-success/12 text-success border-emerald-400/25' },
  announcement: { icon: FileText, labelKey: 'schedulePanel.typeAnnouncement', classes: 'bg-warning/12 text-warning border-amber-400/25' },
  custom: { icon: FileText, labelKey: 'schedulePanel.typeCustom', classes: 'bg-text/8 text-text/55 border-text/10' },
} as const;

interface SchedulePanelProps {
  onOpenScheduleManager: () => void;
  onOpenSongEditor?: (song: any) => void;
}

export default function SchedulePanel({ onOpenScheduleManager, onOpenSongEditor }: SchedulePanelProps) {
  const { locale, t } = useI18n();
  const setActiveView = useUIStore((state) => state.setActiveView);
  const {
    currentSchedule,
    selectedItemId,
    loadSchedules,
    deleteItem,
    duplicateItem,
    saveTemporarySchedule,
    updateItem,
    reorderItems,
    setSelectedItem,
    getTotalDuration,
    getEstimatedEndTime,
    addItem, // Added addItem
    setPresenterMedia,
    isLoading,
  } = useScheduleStore();
  const { goLive, setPreviewSlide } = usePresentationStore();

  const toast = useToast();
  const [showContextMenu, setShowContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showSaveScheduleModal, setShowSaveScheduleModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ itemId: string; position: 'before' | 'after' } | null>(null);

  // Load schedules on mount
  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  // Get current time for clock display
  const [currentTime, setCurrentTime] = useState('');
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString(getIntlLocale(locale), { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [locale]);

  // Right-click context menu
  const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
    e.preventDefault();
    setShowContextMenu({ x: e.clientX, y: e.clientY, itemId });
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setShowContextMenu(null);
    if (showContextMenu) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [showContextMenu]);

  // Handle Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('text/x-rundown-item')) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'song') {
        const item = await addItem({
            itemType: 'song',
            songId: data.id,
            content: data.title || null,
            duration: 5 // Default 5 mins
        });
        if (item) {
           setSelectedItem(item);
        }
      } else if (data.type === 'media') {
        const item = await addItem({
            itemType: 'media',
            mediaId: data.id,
            content: data.title || null,
            duration: 1 // Default 1 min for media
        });
        if (item) {
           setSelectedItem(item);
        }
      }
    } catch (err) {
      console.error("Drop failed:", err);
    }
  };

  // Get display title for item
  const getItemTitle = (item: any): string => {
    if (item.itemType === 'song' && item.songData) {
      return item.songData.title;
    }
    if (item.itemType === 'media' && item.mediaData) {
      return item.mediaData.filename;
    }
    if (item.itemType === 'bible' && item.content) {
      try {
        const parsed = JSON.parse(item.content);
        return parsed.reference || t('schedulePanel.bibleReading');
      } catch {
        return t('schedulePanel.bibleReading');
      }
    }
    if (item.itemType === 'bible' && item.bibleBook && item.bibleChapter && item.bibleVerseStart) {
      return `${item.bibleBook} ${item.bibleChapter}:${item.bibleVerseStart}${
        item.bibleVerseEnd ? `-${item.bibleVerseEnd}` : ''
      }`;
    }
    return item.content || t('schedulePanel.untitled');
  };

  const handleSaveTemporarySchedule = async (data: any) => {
    try {
      const id = await saveTemporarySchedule(data);
      toast.success(t('schedulePanel.quickRundownSaved'));
      setShowSaveScheduleModal(false);
      setSelectedItem(null);
      if (!id) {
        toast.warning(t('schedulePanel.scheduleRefreshFailed'));
      }
    } catch (error) {
      toast.error((error as Error).message || t('schedulePanel.saveQuickRundownFailed'));
      throw error;
    }
  };

  const handleEditItem = async (id: string, data: { content?: string | null; duration: number | null; notes: string | null }) => {
    try {
      await updateItem(id, data);
      setEditingItemId(null);
      toast.success(t('schedulePanel.rundownItemUpdated'));
    } catch (error) {
      toast.error((error as Error).message || t('schedulePanel.updateItemFailed'));
      throw error;
    }
  };

  const handleItemGoLive = (item: any) => {
    setSelectedItem(item.id);

    if (item.itemType === 'media' && item.mediaData) {
      const slides = buildMediaVirtualSlides(item.mediaData);
      const slide = slides[0];
      if (slide) {
        setPreviewSlide(slide as any);
        goLive(slide as any);
      }
      return;
    }

    if (item.itemType === 'song' && item.songData?.slides?.[0]) {
      setPreviewSlide(item.songData.slides[0] as any);
      goLive(item.songData.slides[0] as any);
      return;
    }

    if (item.itemType === 'bible') {
      const [slide] = buildBibleVirtualSlides(item);
      if (slide) {
        setPreviewSlide(slide as any);
        goLive(slide as any);
      }
    }
  };

  const handleSelectItem = (item: any) => {
    setSelectedItem(item.id);
  };

  const handleOpenPdfPresenter = (item: any) => {
    if (!item.mediaData || item.mediaData.mediaType !== 'pdf') return;
    setSelectedItem(item.id);
    setPresenterMedia(item.mediaData);
    setActiveView('prd');
  };

  const handleOpenPdfStandard = (item: any) => {
    setSelectedItem(item.id);
    setActiveView('songs');
  };

  const handleItemDragStart = (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    e.stopPropagation();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-rundown-item', itemId);
    setDraggedItemId(itemId);
    setSelectedItem(itemId);
  };

  const handleItemDragOver = (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    if (!draggedItemId || draggedItemId === itemId) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';

    const rect = e.currentTarget.getBoundingClientRect();
    const position = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';

    setDropIndicator((current) => {
      if (current?.itemId === itemId && current.position === position) {
        return current;
      }
      return { itemId, position };
    });
  };

  const handleItemDrop = async (e: React.DragEvent<HTMLDivElement>, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!currentSchedule || !draggedItemId || !dropIndicator) {
      setDraggedItemId(null);
      setDropIndicator(null);
      return;
    }

    if (draggedItemId === itemId) {
      setDraggedItemId(null);
      setDropIndicator(null);
      return;
    }

    const itemIds = currentSchedule.items.map((item) => item.id);
    const draggedIndex = itemIds.indexOf(draggedItemId);
    const targetIndex = itemIds.indexOf(itemId);
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedItemId(null);
      setDropIndicator(null);
      return;
    }

    const reorderedIds = [...itemIds];
    const [movedId] = reorderedIds.splice(draggedIndex, 1);
    const nextTargetIndex = reorderedIds.indexOf(itemId);
    const insertIndex = dropIndicator.position === 'before' ? nextTargetIndex : nextTargetIndex + 1;
    reorderedIds.splice(insertIndex, 0, movedId);

    setDraggedItemId(null);
    setDropIndicator(null);

    if (reorderedIds.every((id, index) => id === itemIds[index])) {
      return;
    }

    try {
      await reorderItems(reorderedIds);
    } catch (error) {
      toast.error((error as Error).message || t('schedulePanel.reorderFailed'));
    }
  };

  const handleItemDragEnd = () => {
    setDraggedItemId(null);
    setDropIndicator(null);
  };

  const defaultSaveData = {
    name:
      currentSchedule?.name && currentSchedule.name !== 'Quick Rundown'
        ? currentSchedule.name
        : t('schedulePanel.saveNameFallback', { date: new Date().toISOString().split('T')[0] }),
    date: new Date().toISOString().split('T')[0],
    serviceType: 'Custom',
    notes:
      currentSchedule?.notes === 'Temporary rundown for quick operation'
        ? ''
        : currentSchedule?.notes || '',
  };

  const editingItem = currentSchedule?.items.find((item) => item.id === editingItemId) || null;

  return (
    <div 
        className="panel-shell surface-grid flex h-full w-full flex-col overflow-hidden border-r border-text/5"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
    >
      {/* Header - Prominent Schedule Button */}
      <div className="shrink-0 border-b border-text/5 p-3">
        <button
          onClick={onOpenScheduleManager}
          className="panel-muted group w-full rounded-xl px-3 py-3 text-left transition-colors duration-150 hover:border-primary/30 hover:bg-white/[0.05]"
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/12 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <Calendar size={16} className="shrink-0" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-primary/75">{t('schedulePanel.rundown')}</div>
              <div className="truncate text-sm font-medium text-text/88">
                {currentSchedule?.name || t('schedulePanel.quickRundown')}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {currentSchedule?.id === TEMP_SCHEDULE_ID && (
                <div className="status-chip border-info/25 bg-info/10 text-info">{t('schedulePanel.temporary')}</div>
              )}
              <div className="status-chip border-primary/25 bg-primary/10 text-primary transition-colors group-hover:border-primary/40">{t('schedulePanel.open')}</div>
            </div>
          </div>
        </button>

        {currentSchedule?.id === TEMP_SCHEDULE_ID && (
          <button
            onClick={() => setShowSaveScheduleModal(true)}
            disabled={!currentSchedule.items.length || isLoading}
            className="mt-2 w-full rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[11px] font-medium tracking-[0.03em] text-primary transition-colors hover:border-primary/40 hover:bg-primary/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t('schedulePanel.saveQuickRundown')}
          </button>
        )}

        
        {/* Clock & Stats */}
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="rounded-full border border-text/10 bg-text/5 px-2.5 py-1 text-[10px] font-mono text-text/50">
            {currentTime}
          </span>
          
          {currentSchedule && currentSchedule.items.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.05em] text-text/40">
              <span className="flex items-center gap-1">
                <Clock size={10} />
                {formatDuration(getTotalDuration())}
              </span>
              <span>•</span>
              <span>{t('schedulePanel.endPrefix')} {getEstimatedEndTime(currentTime)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Schedule Items List */}
      <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
        {!currentSchedule ? (
          <div className="flex items-center justify-center h-full text-text/30 text-xs text-center px-4">
            <div>
                <Calendar size={32} className="mx-auto mb-2 opacity-20" />
                <p>{t('schedulePanel.startQuickRundown')}</p>
                <p className="text-[10px] mt-1 opacity-50">{t('schedulePanel.dragSongsHint')}</p>
            </div>
          </div>
        ) : currentSchedule.items.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text/30 text-xs text-center px-4">
            <div>
                <div className="mx-auto mb-2 opacity-20 border-2 border-dashed border-text/30 rounded-lg p-2 w-12 h-12 flex items-center justify-center">
                    <Plus size={20} />
                </div>
                <p>{t('schedulePanel.dragSongsHere')}</p>
                <p className="text-[10px] mt-1 opacity-50">{t('schedulePanel.dragSongsHint')}</p>
            </div>
          </div>
        ) : (
          currentSchedule.items.map((item) => {
            const typeConfig = ITEM_TYPE_CONFIG[item.itemType as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.custom;
            const Icon = typeConfig.icon;
            const isSelected = item.id === selectedItemId;

            return (
              <div
                key={item.id}
                onClick={() => handleSelectItem(item)}
                onDoubleClick={() => void handleItemGoLive(item)}
                onContextMenu={(e) => handleContextMenu(e, item.id)}
                draggable={currentSchedule.items.length > 1}
                onDragStart={(e) => handleItemDragStart(e, item.id)}
                onDragOver={(e) => handleItemDragOver(e, item.id)}
                onDrop={(e) => handleItemDrop(e, item.id)}
                onDragEnd={handleItemDragEnd}
                className={`group relative flex cursor-pointer items-start gap-2 rounded-xl border px-2.5 py-2.5 transition-all duration-150 ${
                  isSelected
                    ? 'border-primary/35 bg-white/[0.05] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_10px_24px_rgba(0,0,0,0.18)]'
                    : 'border-transparent bg-transparent hover:border-text/8 hover:bg-white/[0.04]'
                } ${draggedItemId === item.id ? 'opacity-50' : ''}`}
              >
                {dropIndicator?.itemId === item.id && (
                  <div
                    className={`absolute left-2 right-2 h-0.5 rounded-full bg-primary/80 ${
                      dropIndicator.position === 'before' ? 'top-0' : 'bottom-0'
                    }`}
                  />
                )}
                <div className={`absolute inset-y-2 left-0 w-1 rounded-r-full transition-colors ${isSelected ? 'bg-primary' : 'bg-transparent group-hover:bg-info/40'}`} />

                {/* Drag Handle */}
                <div className="mt-0.5 shrink-0 cursor-grab text-text/25 transition-colors duration-150 active:cursor-grabbing group-hover:text-text/65">
                  <GripVertical size={12} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <div className={`truncate text-xs font-medium ${isSelected ? 'text-text' : 'text-text/78'}`}>
                    {getItemTitle(item)}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {/* Type Badge */}
                    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[8px] font-medium tracking-[0.05em] ${typeConfig.classes}`}>
                      <Icon size={8} />
                      {t(typeConfig.labelKey)}
                    </span>

                    {/* Duration */}
                    {item.duration && (
                      <span className="flex items-center gap-0.5 text-[8px] font-mono text-text/34">
                        <Clock size={7} /> {formatDuration(item.duration)}
                      </span>
                    )}
                  </div>

                  {/* Notes (if present) */}
                  {item.notes && (
                    <div className="mt-1 text-[10px] text-text/50 italic line-clamp-1">
                      📝 {item.notes}
                    </div>
                  )}

                  {item.itemType === 'media' && item.mediaData?.mediaType === 'pdf' && isSelected && (
                    <div className="mt-2 flex items-center gap-1.5">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPdfPresenter(item);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-primary/25 bg-primary/12 text-primary transition-colors hover:border-primary/45 hover:bg-primary/18"
                        title={t('schedulePanel.openInPresenter')}
                      >
                        <MonitorUp size={13} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenPdfStandard(item);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-text/72 transition-colors hover:border-white/20 hover:bg-white/[0.08] hover:text-text"
                        title={t('schedulePanel.openInStandard')}
                      >
                        <FileText size={13} />
                      </button>
                    </div>
                  )}
                </div>

                {/* More Options */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, item.id);
                  }}
                  className="shrink-0 rounded p-1 text-text/40 opacity-0 transition-all duration-150 hover:bg-text/10 hover:text-text group-hover:opacity-100"
                >
                  <MoreVertical size={12} />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          className="panel-shell fixed z-50 min-w-[140px] rounded-xl py-1"
          style={{ top: showContextMenu.y, left: showContextMenu.x }}
        >
          {currentSchedule?.items.find(i => i.id === showContextMenu.itemId)?.itemType === 'song' && onOpenSongEditor && (
            <button
              onClick={async () => {
                const item = currentSchedule.items.find(i => i.id === showContextMenu.itemId);
                if (item?.songData) {
                  onOpenSongEditor(item.songData);
                }
                setShowContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-text/5 flex items-center gap-2 text-primary"
            >
              <Music size={12} />
              {t('schedulePanel.editSong')}
            </button>
          )}
          <button
            onClick={() => {
              setEditingItemId(showContextMenu.itemId);
              setShowContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-text/5 flex items-center gap-2"
          >
            <Edit size={12} />
            {t('schedulePanel.editItem')}
          </button>
          <button
            onClick={() => {
              duplicateItem(showContextMenu.itemId);
              setShowContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-text/5 flex items-center gap-2"
          >
            <Copy size={12} />
            {t('schedulePanel.duplicate')}
          </button>
          <button
            onClick={() => {
              deleteItem(showContextMenu.itemId);
              setShowContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-red-500/10 text-red-400 flex items-center gap-2"
          >
            <Trash2 size={12} />
            {t('common.delete')}
          </button>
        </div>
      )}

      {/* Footer / Add Button */}
      <div className="p-3 border-t border-text/5">
        <button
          onClick={() => setShowAddItemModal(true)}
          className="w-full py-2 rounded-lg border border-dashed border-text/20 text-text/50 text-xs font-medium tracking-[0.03em] hover:bg-text/5 hover:border-text/40 transition-all flex items-center justify-center gap-1"
        >
          <Plus size={14} />
          {t('schedulePanel.addItem')}
        </button>
      </div>

      <AddScheduleItemModal
        isOpen={showAddItemModal}
        onClose={() => setShowAddItemModal(false)}
      />

      <ScheduleFormModal
        key={showSaveScheduleModal ? 'save-temp-open' : 'save-temp-closed'}
        isOpen={showSaveScheduleModal}
        onClose={() => setShowSaveScheduleModal(false)}
        onSubmit={handleSaveTemporarySchedule}
        initialData={defaultSaveData}
        mode="create"
        title={t('schedulePanel.saveQuickRundown')}
        description={t('schedulePanel.saveDescription')}
        submitLabel={t('common.save')}
      />

      <EditScheduleItemModal
        isOpen={!!editingItem}
        item={editingItem}
        itemTitle={editingItem ? getItemTitle(editingItem) : ''}
        isSaving={isLoading}
        onClose={() => setEditingItemId(null)}
        onSubmit={handleEditItem}
      />
    </div>
  );
}
