import { useEffect, useState } from 'react';
import { supabase, Match, Season, Profile } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { Crest } from '@/components/Crest';
import { formatDate } from '@/lib/utils';
import { Calendar, Users, Trophy, Wallet, TrendingUp, Plus, ArrowRight } from 'lucide-react';
import { HallOfFame } from '@/components/HallOfFame';
import { SponsorCarousel } from '@/components/Sponsors';

export function AdminDashboard() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [season, setSeason] = useState<Season | null>(null);
  const [stats, setStats] = useState({
    jogos: 0, vitorias: 0, empates: 0, derrotas: 0,
    golsMarcados: 0, golsSofridos: 0,
    upcoming: 0, completed: 0, cancelled: 0,
  });
  const [playersCount, setPlayersCount] = useState(0);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [lastMatch, setLastMatch] = useState<Match | null>(null);
  const [finance, setFinance] = useState({ receitas: 0, despesas: 0 });
  const [pendingFees, setPendingFees] = useState(0);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      setSeason(active);

      const [matchesRes, playersRes, feesRes, finRes] = await Promise.all([
        active ? supabase.from('matches').select('*').eq('season_id', active.id).order('data', { ascending: true }) : Promise.resolve({ data: [] }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('monthly_fees').select('status'),
        supabase.from('finance_entries').select('tipo, valor'),
      ]);

      const matches = (matchesRes.data || []) as Match[];
      const completed = matches.filter(m => m.status === 'completed');
      setStats({
        jogos: completed.length,
        vitorias: completed.filter(m => (m.gols_alif ?? 0) > (m.gols_adversario ?? 0)).length,
        empates: completed.filter(m => (m.gols_alif ?? 0) === (m.gols_adversario ?? 0)).length,
        derrotas: completed.filter(m => (m.gols_alif ?? 0) < (m.gols_adversario ?? 0)).length,
        golsMarcados: completed.reduce((s, m) => s + (m.gols_alif ?? 0), 0),
        golsSofridos: completed.reduce((s, m) => s + (m.gols_adversario ?? 0), 0),
        upcoming: matches.filter(m => m.status === 'upcoming').length,
        completed: completed.length,
        cancelled: matches.filter(m => m.status === 'cancelled').length,
      });

      setPlayersCount(playersRes.count || 0);
      setPendingFees((feesRes.data || []).filter((f: any) => f.status !== 'pago').length);

      const fin = finRes.data || [];
      setFinance({
        receitas: fin.filter((e: any) => e.tipo === 'receita').reduce((s: number, e: any) => s + Number(e.valor), 0),
        despesas: fin.filter((e: any) => e.tipo === 'despesa').reduce((s: number, e: any) => s + Number(e.valor), 0),
      });

      setNextMatch(matches.filter(m => m.status === 'upcoming').sort((a, b) => a.data.localeCompare(b.data))[0] || null);
      setLastMatch(completed.sort((a, b) => b.data.localeCompare(a.data))[0] || null);
    } catch {
      setError('Não foi possível carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const saldo = finance.receitas - finance.despesas;
  const saldoGols = stats.golsMarcados - stats.golsSofridos;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Crest size={48} />
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white">Painel Administrativo</h1>
            <p className="text-neutral-500 text-sm">{season?.nome || 'Sem temporada ativa'}</p>
          </div>
        </div>
      </div>

      {/* Patrocinadores - Carousel */}
      <SponsorCarousel />

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction icon={<Plus size={18} />} label="Novo Jogo" onClick={() => navigate('/admin/jogos?novo=1')} />
        <QuickAction icon={<Users size={18} />} label="Novo Jogador" onClick={() => navigate('/admin/jogadores?novo=1')} />
        <QuickAction icon={<Wallet size={18} />} label="Mensalidades" onClick={() => navigate('/admin/mensalidades')} />
        <QuickAction icon={<Trophy size={18} />} label="Temporadas" onClick={() => navigate('/admin/temporadas')} />
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatBox label="Jogadores" value={playersCount} icon={<Users size={14} />} />
        <StatBox label="Próximos" value={stats.upcoming} icon={<Calendar size={14} />} />
        <StatBox label="Realizados" value={stats.completed} icon={<Trophy size={14} />} />
        <StatBox label="Cancelados" value={stats.cancelled} icon={<Calendar size={14} />} />
      </div>

      {/* Campanha */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">Campanha da Temporada</h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <StatBox label="Jogos" value={stats.jogos} />
          <StatBox label="Vitórias" value={stats.vitorias} accent="green" />
          <StatBox label="Empates" value={stats.empates} accent="yellow" />
          <StatBox label="Derrotas" value={stats.derrotas} accent="red" />
          <StatBox label="Gols Pro" value={stats.golsMarcados} />
          <StatBox label="Saldo" value={saldoGols > 0 ? `+${saldoGols}` : saldoGols} accent={saldoGols >= 0 ? 'green' : 'red'} />
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">Próximo Jogo</h3>
          {nextMatch ? (
            <button onClick={() => navigate(`/admin/jogos/${nextMatch.id}`)} className="w-full text-left group">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Crest size={40} />
                  <div>
                    <p className="text-xs text-neutral-500">AL-IF FC vs</p>
                    <p className="text-white font-bold">{nextMatch.adversario}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold text-sm">{formatDate(nextMatch.data)}</p>
                  {nextMatch.horario && <p className="text-neutral-400 text-xs">{nextMatch.horario.slice(0,5)}</p>}
                </div>
              </div>
              <p className="text-red-500 text-xs mt-3 flex items-center gap-1">Abrir jogo <ArrowRight size={12} /></p>
            </button>
          ) : (
            <EmptyState title="Sem jogos agendados" />
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4">Financeiro</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 text-sm flex items-center gap-2"><TrendingUp size={14} className="text-green-400" /> Receitas</span>
              <span className="text-green-400 font-bold tabular-nums">R$ {finance.receitas.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 text-sm flex items-center gap-2"><TrendingUp size={14} className="text-red-400 rotate-180" /> Despesas</span>
              <span className="text-red-400 font-bold tabular-nums">R$ {finance.despesas.toFixed(2)}</span>
            </div>
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-between">
              <span className="text-white text-sm font-semibold">Saldo</span>
              <span className={`font-bold tabular-nums ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {saldo.toFixed(2)}</span>
            </div>
            {pendingFees > 0 && (
              <p className="text-yellow-400 text-xs pt-2">{pendingFees} mensalidade(s) pendente(s)</p>
            )}
          </div>
        </div>
      </div>

      {/* Hall of Fame */}
      <HallOfFame />
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="card p-4 flex items-center gap-3 card-hover text-left">
      <div className="w-10 h-10 rounded-lg bg-red-600 flex items-center justify-center text-white shrink-0">
        {icon}
      </div>
      <span className="text-white font-semibold text-sm">{label}</span>
    </button>
  );
}

function StatBox({ label, value, accent, icon }: { label: string; value: string | number; accent?: 'green' | 'red' | 'yellow'; icon?: React.ReactNode }) {
  const colors = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400' };
  return (
    <div className="card p-4">
      <p className="stat-label flex items-center gap-1">{icon} {label}</p>
      <p className={`stat-value mt-1 ${accent ? colors[accent] : ''}`}>{value}</p>
    </div>
  );
}
