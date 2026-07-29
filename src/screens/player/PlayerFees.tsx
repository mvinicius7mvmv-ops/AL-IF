import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, MonthlyFee } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { formatDate, cn } from '@/lib/utils';
import { Wallet, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export function PlayerFees() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [fees, setFees] = useState<(MonthlyFee & { profiles?: { nome: string; apelido: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await supabase
        .from('monthly_fees')
        .select('*, profiles(nome, apelido)')
        .eq('player_id', profile.id)
        .order('competencia', { ascending: false });
      if (e) throw e;
      setFees(data || []);
    } catch {
      setError('Não foi possível carregar suas mensalidades.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [profile]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const totalPago = fees.filter(f => f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0);
  const totalPendente = fees.filter(f => f.status !== 'pago').reduce((s, f) => s + Number(f.valor), 0);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Minhas Mensalidades</h1>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Total Pago</p>
          <p className="text-2xl font-bold text-green-400 tabular-nums mt-1">R$ {totalPago.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium">Pendente</p>
          <p className="text-2xl font-bold text-yellow-400 tabular-nums mt-1">R$ {totalPendente.toFixed(2)}</p>
        </div>
      </div>

      {fees.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="Sem mensalidades" description="Nenhuma mensalidade cadastrada para você ainda." />
      ) : (
        <div className="space-y-2">
          {fees.map(fee => (
            <div key={fee.id} className="card p-4 flex items-center gap-4">
              <div className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center shrink-0',
                fee.status === 'pago' ? 'bg-green-500/20' : fee.status === 'atrasado' ? 'bg-red-500/20' : 'bg-yellow-500/20',
              )}>
                {fee.status === 'pago' ? <CheckCircle size={20} className="text-green-400" />
                  : fee.status === 'atrasado' ? <AlertTriangle size={20} className="text-red-400" />
                  : <Clock size={20} className="text-yellow-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{fee.competencia}</p>
                {fee.vencimento && (
                  <p className="text-neutral-500 text-xs">Vencimento: {formatDate(fee.vencimento)}</p>
                )}
                {fee.pago_em && (
                  <p className="text-green-400 text-xs">Pago em: {formatDate(fee.pago_em)}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-bold tabular-nums">R$ {Number(fee.valor).toFixed(2)}</p>
                <span className={cn(
                  'badge mt-1',
                  fee.status === 'pago' ? 'bg-green-500/15 text-green-400 border border-green-800/40'
                    : fee.status === 'atrasado' ? 'bg-red-500/15 text-red-400 border border-red-800/40'
                    : 'bg-yellow-500/15 text-yellow-400 border border-yellow-800/40',
                )}>
                  {fee.status === 'pago' ? 'Pago' : fee.status === 'atrasado' ? 'Atrasado' : 'Pendente'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
