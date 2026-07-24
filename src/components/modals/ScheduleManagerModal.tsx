import { useState, useEffect, useMemo } from 'react';
import { X, Search, Plus, Filter } from 'lucide-react';
import { useScheduleStore } from '../../core/stores/useScheduleStore';
import { useToast } from '../common/Toast';
import ScheduleListItem from '../schedule/ScheduleListItem';
import ScheduleFormModal from './ScheduleFormModal';
import ConfirmDialog from '../common/ConfirmDialog';
import type { Schedule } from '../../electron/database/schema';
import { getIntlLocale, useI18n } from '../../i18n';

interface ScheduleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (scheduleId: string) => void;
  mode?: 'select' | 'manage';
}

type FilterType = 'all' | 'this-week' | 'this-month' | 'past' | 'upcoming';

export default function ScheduleManagerModal({
  isOpen,
  onClose,
  onSelect,
  mode = 'select',
}: ScheduleManagerModalProps) {
  const { locale, t } = useI18n();
  const { 
    schedules, 
    loadSchedules, 
    createSchedule, 
    updateSchedule, 
    deleteSchedule,
    cloneSchedule,
  } = useScheduleStore();
  
  const toast = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Modals
  const [showFormModal, setShowFormModal] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingSchedule, setDeletingSchedule] = useState<Schedule | null>(null);

  // Load schedules on mount
  useEffect(() => {
    if (isOpen) {
      loadSchedules();
    }
  }, [isOpen, loadSchedules]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showFormModal || showDeleteConfirm) return; // Let nested modals handle
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleCreateNew();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showFormModal, showDeleteConfirm, onClose]);

  // Filter schedules
  const filteredSchedules = useMemo(() => {
    let filtered = [...schedules];
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(query) ||
        s.notes?.toLowerCase().includes(query) ||
        s.serviceType?.toLowerCase().includes(query)
      );
    }
    
    // Apply date filter
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    switch (filterType) {
      case 'this-week':
        filtered = filtered.filter(s => {
          if (!s.date) return false;
          const date = new Date(s.date);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 7);
          return date >= startOfWeek && date < endOfWeek;
        });
        break;
      case 'this-month':
        filtered = filtered.filter(s => {
          if (!s.date) return false;
          const date = new Date(s.date);
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          return date >= startOfMonth && date <= endOfMonth;
        });
        break;
      case 'past':
        filtered = filtered.filter(s => {
          if (!s.date) return false;
          return new Date(s.date) < now;
        });
        break;
      case 'upcoming':
        filtered = filtered.filter(s => {
          if (!s.date) return false;
          return new Date(s.date) >= now;
        });
        break;
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => {
      if (!a.date || !b.date) return 0;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    
    return filtered;
  }, [schedules, searchQuery, filterType]);

  // Handlers
  const handleCreateNew = () => {
    setFormMode('create');
    setEditingSchedule(null);
    setShowFormModal(true);
  };

  const handleEdit = (schedule: Schedule) => {
    setFormMode('edit');
    setEditingSchedule(schedule);
    setShowFormModal(true);
  };

  const handleClone = async (schedule: Schedule) => {
    try {
      const newName = prompt(
        t('scheduleManager.clonePrompt', { name: schedule.name }),
        t('scheduleManager.cloneCopySuffix', { name: schedule.name }),
      );
      if (!newName) return;
      
      await cloneSchedule(schedule.id, newName);
      await loadSchedules();
      toast.success(t('scheduleManager.cloned', { name: newName }));
    } catch (error) {
      toast.error(t('scheduleManager.cloneFailed'));
    }
  };

  const handleDelete = (schedule: Schedule) => {
    setDeletingSchedule(schedule);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!deletingSchedule) return;
    
    try {
      await deleteSchedule(deletingSchedule.id);
      await loadSchedules();
      toast.success(t('scheduleManager.deleted', { name: deletingSchedule.name }));
      setDeletingSchedule(null);
    } catch (error) {
      toast.error(t('scheduleManager.deleteFailed'));
    }
  };

  const handleFormSubmit = async (data: Partial<Schedule>) => {
    try {
      if (formMode === 'create') {
        const id = await createSchedule(data);
        toast.success(t('scheduleManager.created'));
        setSelectedId(id);
      } else if (editingSchedule) {
        await updateSchedule(editingSchedule.id, data);
        toast.success(t('scheduleManager.updated'));
      }
      await loadSchedules();
      setShowFormModal(false);
    } catch (error) {
      throw error; // Let form handle error display
    }
  };

  const handleLoadSelected = () => {
    if (selectedId && onSelect) {
      onSelect(selectedId);
      toast.info(t('scheduleManager.loaded', { name: schedules.find(s => s.id === selectedId)?.name || '' }));
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        
        {/* Modal */}
        <div className="relative bg-surface border border-text/10 rounded-lg shadow-2xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-text/10 shrink-0">
            <button
              onClick={onClose}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-text/10 bg-background text-text/55 transition-colors hover:bg-text/10 hover:text-text"
              aria-label="Close schedule manager"
              title="Close schedule manager"
            >
              <X size={18} />
            </button>
            <h3 className="text-lg font-bold text-text">📅 {t('scheduleManager.title')}</h3>
          </div>

          {/* Toolbar */}
          <div className="px-6 py-3 border-b border-text/10 space-y-3 shrink-0">
            {/* Search and New Button */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text/30" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('scheduleManager.searchPlaceholder')}
                  className="w-full pl-9 pr-3 py-2 bg-background border border-text/20 rounded-lg text-sm text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm font-bold hover:bg-primary/30 transition-colors flex items-center gap-1.5 shrink-0"
              >
                <Plus size={16} />
                {t('scheduleManager.newSchedule')}
              </button>
            </div>

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-text/50" />
              <div className="flex items-center gap-1">
                {(['all', 'this-week', 'this-month', 'upcoming', 'past'] as FilterType[]).map(filter => (
                  <button
                    key={filter}
                    onClick={() => setFilterType(filter)}
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      filterType === filter
                        ? 'bg-primary/20 text-primary font-bold'
                        : 'text-text/50 hover:text-text hover:bg-text/5'
                    }`}
                  >
                    {filter === 'all' ? t('scheduleManager.all') : 
                     filter === 'this-week' ? t('scheduleManager.thisWeek') :
                     filter === 'this-month' ? t('scheduleManager.thisMonth') :
                     filter === 'upcoming' ? t('scheduleManager.upcoming') : t('scheduleManager.past')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredSchedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="text-4xl mb-2">📅</div>
                <p className="text-sm font-semibold text-text/70">
                  {searchQuery || filterType !== 'all' 
                    ? t('scheduleManager.noSchedulesFound') 
                    : t('scheduleManager.noSchedulesYet')}
                </p>
                <p className="text-xs text-text/50 mt-1">
                  {searchQuery || filterType !== 'all'
                    ? t('scheduleManager.adjustSearch')
                    : t('scheduleManager.clickNew')}
                </p>
              </div>
            ) : (
              filteredSchedules.map(schedule => (
                <ScheduleListItem
                  key={schedule.id}
                  schedule={schedule}
                  itemCount={(schedule as any).itemCount || 0}
                  totalDuration={(schedule as any).totalDuration || 0}
                  lastModified={schedule.updatedAt ? getRelativeTime(schedule.updatedAt, locale) : undefined}
                  onEdit={() => handleEdit(schedule)}
                  onClone={() => handleClone(schedule)}
                  onDelete={() => handleDelete(schedule)}
                  onSelect={() => setSelectedId(schedule.id)}
                  isSelected={selectedId === schedule.id}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-text/10 shrink-0 bg-surface/50">
            <p className="text-xs text-text/50">
              {filteredSchedules.length} {filteredSchedules.length !== 1 ? t('scheduleManager.schedulePlural') : t('scheduleManager.scheduleSingular')}
              {selectedId && ` • ${t('scheduleManager.selectedCount')}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-text/20 hover:bg-text/5 transition-colors"
              >
                {t('common.cancel')}
              </button>
              {mode === 'select' && (
                <button
                  onClick={handleLoadSelected}
                  disabled={!selectedId}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('scheduleManager.loadSelected')}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      <ScheduleFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
        initialData={editingSchedule || undefined}
        mode={formMode}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setDeletingSchedule(null);
        }}
        onConfirm={confirmDelete}
        title={t('scheduleManager.deleteTitle')}
        message={t('scheduleManager.deleteMessage', { name: deletingSchedule?.name || '' })}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        confirmVariant="danger"
      >
        <p className="text-xs text-text/50 mt-2">
          ⚠️ {t('scheduleManager.deleteWarning')}
        </p>
      </ConfirmDialog>
    </>
  );
}

// Helper function
function getRelativeTime(dateString: string, locale: 'en' | 'id'): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffMins < 1) return locale === 'id' ? 'baru saja' : 'just now';
  if (diffMins < 60) return locale === 'id' ? `${diffMins}m lalu` : `${diffMins}m ago`;
  if (diffHours < 24) return locale === 'id' ? `${diffHours}j lalu` : `${diffHours}h ago`;
  if (diffDays < 7) return locale === 'id' ? `${diffDays}h lalu` : `${diffDays}d ago`;
  return date.toLocaleDateString(getIntlLocale(locale));
}
