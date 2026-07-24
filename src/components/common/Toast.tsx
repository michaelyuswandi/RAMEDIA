import { create } from 'zustand';
import { CheckCircle, XCircle, Info, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  
  addToast: (type, message, duration = 3000) => {
    const id = `${Date.now()}-${Math.random()}`;
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, duration }],
    }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter((t) => t.id !== id),
        }));
      }, duration);
    }
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// Toast component
export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function Toast({ type, message, onClose }: Toast & { onClose: () => void }) {
  const config = {
    success: { icon: CheckCircle, bg: 'bg-success/12', border: 'border-success/25', text: 'text-success' },
    error: { icon: XCircle, bg: 'bg-error/12', border: 'border-error/25', text: 'text-error' },
    info: { icon: Info, bg: 'bg-info/12', border: 'border-info/25', text: 'text-info' },
    warning: { icon: AlertCircle, bg: 'bg-warning/12', border: 'border-warning/25', text: 'text-warning' },
  }[type];

  const Icon = config.icon;

  return (
    <div className={`panel-shell flex min-w-[300px] max-w-md items-center gap-3 rounded-xl border px-4 py-3 ${config.bg} ${config.border}`}>
      <Icon size={18} className={config.text} />
      <p className="text-sm text-text flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-text/50 transition-colors duration-150 hover:text-text"
      >
        <XCircle size={16} />
      </button>
    </div>
  );
}

// Helper hook
export const useToast = () => {
  const addToast = useToastStore((state) => state.addToast);
  
  return {
    success: (message: string) => addToast('success', message),
    error: (message: string) => addToast('error', message),
    info: (message: string) => addToast('info', message),
    warning: (message: string) => addToast('warning', message),
  };
};
