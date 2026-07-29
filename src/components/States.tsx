import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export function Loading({ className, size = 24 }: { className?: string; size?: number }) {
  return (
    <div className={cn('flex items-center justify-center py-12', className)}>
      <Loader2 size={size} className="animate-spin text-red-500" />
    </div>
  );
}

export function FullPageLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={40} className="animate-spin text-red-500" />
        <p className="text-neutral-500 text-sm">Carregando...</p>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      {icon && <div className="text-neutral-700 mb-4">{icon}</div>}
      <h3 className="text-neutral-300 font-semibold text-base">{title}</h3>
      {description && <p className="text-neutral-600 text-sm mt-1.5 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-900/30 flex items-center justify-center mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-neutral-300 font-semibold text-base">Erro</h3>
      <p className="text-neutral-500 text-sm mt-1.5 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-5">
          Tentar novamente
        </button>
      )}
    </div>
  );
}
