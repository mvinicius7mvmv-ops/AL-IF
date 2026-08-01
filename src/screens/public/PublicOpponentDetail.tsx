import { useEffect, useState } from 'react';
import { supabase, Opponent, Match } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { Crest } from '@/components/Crest';
import { StatusBadge } from '@/components/Badges';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, MapPin, Shield, Trophy, Calendar, TrendingUp } from 'lucide-react';

export function PublicOpponentDetail({ opponentId }: { opponentId: string }) {
  const { navigate } = useRouter();
  const [opponent, setOpponent] = useState<Opponent | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [opponentId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: o } = await supabase.from('opponents').select('*').eq('id', opponentId).maybeSingle();
      if (!o) { setError('Adversário não encontrado.'); setLoading(false); return; }
      setOpponent(o as Opponent);

      const { data: ms } = await supabase
        .from('matches')
        .select('*')
        .or(`opponent_id.eq.${opponentId},adversario.eq.${(o as Opponent).name}`)
        .order('data', { ascending: false });
      setMatches((ms || []) as Match[]);
    } catch {
      setError('Não foi possível carregar o adversário.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!opponent) return null;

  const completed = matches.filter(m => m.status === 'completed');
  const wins = completed.filter(m => (m.gols_alif ?? 0) > (m.gols_adversario ?? 0)).length;
  const draws = completed.filter(m => (m.gols_alif ?? 0) === (m.gols_adversario ?? 0)).length;
  const losses = completed.filter(m => (m.gols_alif ?? 0) < (m.gols_adversario ?? 0)).length;
  const goalsFor = completed.reduce((s, m) => s + (m.gols_alif ?? 0), 0);
  const goalsAgainst = completed.reduce((s, m) => s + (m.gols_adversario ?? 0), 0);
  const goalDiff = goalsFor - goalsAgainst;
  const winPct = completed.length > 0 ? Math.round((wins / completed.length) * 100) : 0;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/jogos')} className="btn-ghost -ml-2">
        <ArrowLeft size={18} /> Voltar
      </button>

      {/* Profile header */}
      <div className="card p-6">
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-2xl bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center">
            {opponent.logo_url ? <img src={opponent.logo_url} alt={opponent.name} className="w-full h-full object-contain p-2" /> : <Shield size={32} className="text-neutral-600" />}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{opponent.name}</h1>
            {(opponent.city || opponent.state) && (
              <p className="text-neutral-500 text-sm flex items-center justify-center gap-1 mt-1">
                <MapPin size={14} /> {[opponent.city, opponent.state].filter(Boolean).join(' - ')}
              </p>
            )}
          </div>
          {opponent.notes && <p className="text-neutral-400 text-sm text-center max-w-md">{opponent.notes}</p>}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
        <StatCard label="Jogos" value={completed.length} icon={<Calendar size={14} />} />
        <StatCard label="Vitórias" value={wins} color="text-green-400" icon={<Trophy size={14} />} />
        <StatCard label="Empates" value={draws} color="text-yellow-400" />
        <StatCard label="Derrotas" value={losses} color="text-red-400" />
        <StatCard label="Aproveit." value={`${winPct}%`} icon={<TrendingUp size={14} />} />
        <StatCard label="Gols Pró" value={goalsFor} color="text-green-400" />
        <StatCard label="Gols Sofridos" value={goalsAgainst} color="text-red-400" />
        <StatCard label="Saldo" value={goalDiff > 0 ? `+${goalDiff}` : goalDiff} color={goalDiff >= 0 ? 'text-green-400' : 'text-red-400'} />
      </div>

      {/* Recent matches */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-white mb-4">Histórico de Confrontos</h2>
        {matches.length === 0 ? (
          <EmptyState icon={<Calendar size={32} />} title="Nenhum jogo" description="Ainda não há jogos contra este adversário." />
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 15).map(m => {
              const isWin = m.status === 'completed' && (m.gols_alif ?? 0) > (m.gols_adversario ?? 0);
              const isDraw = m.status === 'completed' && (m.gols_alif ?? 0) === (m.gols_adversario ?? 0);
              const isLoss = m.status === 'completed' && (m.gols_alif ?? 0) < (m.gols_adversario ?? 0);
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`/jogos/${m.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
                >
                  <div className={`w-2 h-10 rounded-full shrink-0 ${isWin ? 'bg-green-500' : isDraw ? 'bg-yellow-500' : isLoss ? 'bg-red-500' : 'bg-neutral-700'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Crest size={20} />
                      <span className="text-white text-sm font-medium">{m.gols_alif ?? 0} x {m.gols_adversario ?? 0}</span>
                      <span className="text-neutral-500 text-sm truncate">{opponent.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-neutral-600 text-xs">{formatDate(m.data)}</span>
                      {m.competicao && <span className="text-neutral-600 text-xs">· {m.competicao}</span>}
                    </div>
                  </div>
                  <StatusBadge status={m.status} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-white', icon }: { label: string; value: string | number; color?: string; icon?: React.ReactNode }) {
  return (
    <div className="card p-3 text-center">
      {icon && <div className="flex justify-center mb-1 text-neutral-500">{icon}</div>}
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-neutral-600 text-xs mt-0.5">{label}</p>
    </div>
  );
}
