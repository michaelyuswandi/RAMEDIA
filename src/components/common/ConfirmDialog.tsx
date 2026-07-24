import { X } from 'lucide-react';
import { useEffect } from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  children?: React.ReactNode;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  children,
}: ConfirmDialogProps) {
  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const confirmClasses = confirmVariant === 'danger'
    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30'
    : 'bg-primary/20 text-primary hover:bg-primary/30 border-primary/30';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="relative bg-surface border border-text/10 rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-text/10">
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-text/10 bg-background text-text/55 transition-colors hover:bg-text/10 hover:text-text"
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X size={18} />
          </button>
          <h3 className="text-lg font-bold text-text">{title}</h3>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <p className="text-sm text-text/70">{message}</p>
          {children}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-text/10 bg-surface/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-text/20 hover:bg-text/5 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-4 py-2 text-sm font-bold rounded-lg border transition-colors ${confirmClasses}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
