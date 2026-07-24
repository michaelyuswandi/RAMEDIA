import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { Schedule } from '../../electron/database/schema';
import { useI18n } from '../../i18n';

interface ScheduleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Schedule>) => Promise<void>;
  initialData?: Partial<Schedule>;
  mode: 'create' | 'edit';
  title?: string;
  description?: string;
  submitLabel?: string;
}

const SERVICE_TYPES = [
  'Sunday Service',
  'Wednesday Prayer',
  'Youth Service',
  'Special Event',
  'Custom',
];

export default function ScheduleFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  title,
  description,
  submitLabel,
}: ScheduleFormModalProps) {
  const { t } = useI18n();
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    serviceType: initialData?.serviceType || SERVICE_TYPES[0],
    notes: initialData?.notes || '',
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setFormData({
      name: initialData?.name || '',
      date: initialData?.date || new Date().toISOString().split('T')[0],
      serviceType:
        initialData?.serviceType && SERVICE_TYPES.includes(initialData.serviceType)
          ? initialData.serviceType
          : SERVICE_TYPES[0],
      notes: initialData?.notes || '',
    });
    setErrors({});
  }, [isOpen, initialData]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = t('scheduleForm.nameRequired');
    } else if (formData.name.length > 100) {
      newErrors.name = t('scheduleForm.nameTooLong');
    }
    
    if (!formData.date) {
      newErrors.date = t('scheduleForm.dateRequired');
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
    } catch (error) {
      setErrors({ submit: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative bg-surface border border-text/10 rounded-lg shadow-2xl w-full max-w-lg mx-4">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-text/10">
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-text/10 bg-background text-text/55 transition-colors hover:bg-text/10 hover:text-text"
            aria-label="Close schedule form"
            title="Close schedule form"
          >
            <X size={18} />
          </button>
          <h3 className="text-lg font-bold text-text">
            {title || (mode === 'create' ? t('scheduleForm.createTitle') : t('scheduleForm.editTitle'))}
          </h3>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {/* Name */}
          <div>
            <p className="mb-4 text-xs text-text/50">
              {description || (mode === 'create' ? t('scheduleForm.createDescription') : t('scheduleForm.editDescription'))}
            </p>
            <label className="block text-sm font-semibold text-text mb-1.5">
              {t('scheduleForm.nameLabel')} <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-text/20 rounded-lg text-sm text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50 transition-colors"
              placeholder={t('scheduleForm.namePlaceholder')}
              maxLength={100}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-400">{errors.name}</p>
            )}
          </div>

          {/* Date and Service Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">
                {t('scheduleForm.dateLabel')} <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-text/20 rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-colors"
              />
              {errors.date && (
                <p className="mt-1 text-xs text-red-400">{errors.date}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-text mb-1.5">
                {t('scheduleForm.serviceTypeLabel')}
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                className="w-full px-3 py-2 bg-background border border-text/20 rounded-lg text-sm text-text focus:outline-none focus:border-primary/50 transition-colors"
              >
                {SERVICE_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-text mb-1.5">
              {t('scheduleForm.notesLabel')}
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-background border border-text/20 rounded-lg text-sm text-text placeholder:text-text/30 focus:outline-none focus:border-primary/50 transition-colors resize-none"
              placeholder={t('scheduleForm.notesPlaceholder')}
            />
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
              {errors.submit}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-text/20 hover:bg-text/5 transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-bold rounded-lg bg-primary/20 text-primary border border-primary/30 hover:bg-primary/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? t('common.saving') : submitLabel || (mode === 'create' ? t('scheduleForm.createSubmit') : t('scheduleForm.saveSubmit'))}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
