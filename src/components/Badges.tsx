import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: 'upcoming' | 'completed' | 'cancelled' }) {
  const map = {
    upcoming: { label: 'Próximo', cls: 'bg-blue-500/15 text-blue-400 border-blue-800/40' },
    completed: { label: 'Realizado', cls: 'bg-green-500/15 text-green-400 border-green-800/40' },
    cancelled: { label: 'Cancelado', cls: 'bg-red-500/15 text-red-400 border-red-800/40' },
  };
  const s = map[status];
  return <span className={cn('badge border', s.cls)}>{s.label}</span>;
}

export function EventIcon({ tipo, size = 16 }: { tipo: string; size?: number }) {
  switch (tipo) {
    case 'gol':
      return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-500/20 text-green-400 text-xs font-bold">G</span>;
    case 'assistencia':
      return <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">A</span>;
    case 'cartao_amarelo':
      return <span className="inline-flex items-center justify-center w-4 h-5 rounded-sm bg-yellow-400" style={{ width: size * 0.7, height: size }} />;
    case 'cartao_vermelho':
      return <span className="inline-flex items-center justify-center w-4 h-5 rounded-sm bg-red-600" style={{ width: size * 0.7, height: size }} />;
    default:
      return null;
  }
}

export function eventTypeLabel(tipo: string): string {
  const map: Record<string, string> = {
    gol: 'Gol',
    assistencia: 'Assistência',
    cartao_amarelo: 'Cartão Amarelo',
    cartao_vermelho: 'Cartão Vermelho',
  };
  return map[tipo] || tipo;
}
