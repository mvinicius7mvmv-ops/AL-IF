import React, { createContext, useContext, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const remove = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const icons = {
    success: <CheckCircle size={18} className="text-green-400 shrink-0" />,
    error: <XCircle size={18} className="text-red-400 shrink-0" />,
    info: <AlertCircle size={18} className="text-blue-400 shrink-0" />,
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full px-4 sm:px-0">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border text-sm font-medium animate-slide-in',
              t.type === 'success' && 'bg-neutral-900 border-green-800 text-white',
              t.type === 'error' && 'bg-neutral-900 border-red-800 text-white',
              t.type === 'info' && 'bg-neutral-900 border-blue-800 text-white',
            )}
          >
            {icons[t.type]}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} className="text-neutral-400 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
