import { useEffect, useState } from 'react';
import { supabase, Competition, Match, MatchEvent, Profile } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Loading, ErrorState, EmptyState } from '@/components/States';
import { StatusBadge } from '@/components/Badges';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Trophy, Calendar, TrendingUp, Goal, Shirt } from 'lucide-react';
import { TYPE_LABELS } from '@/screens/admin/AdminCompetitions';

export function PublicCompetitionDetail({ competitionId }: { competitionId: string }) {
  const { navigate } = useRouter();
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [topScorers, setTopScorers] = useState<{ player: Profile; count: number }[]>([]);
  const [topAssists, setTopAssists] = useState<{ player: Profile; count: number }[]>([]);
  const [cardCount, setCardCount] = useState({ yellow: 0, red: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [competitionId]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: c } = await supabase.from('competitions').select('*').eq('id', competitionId).maybeSingle();
      if (!c) { setError('Competição não encontrada.'); setLoading(false); return; }
      setCompetition(c as Competition);

      const { data: ms } = await supabase
        .from('matches')
        .select('*')
        .or(`competition_id.eq.${competitionId},segunda_competition_id.eq.${competitionId}`)
        .order('data', { ascending: false });
      const matchList = (ms || []) as Match[];
      setMatches(matchList);

      const completed = matchList.filter(m => m.status === 'completed');
      const matchIds = completed.map(m => m.id);
      if (matchIds.length > 0) {
        const { data: events } = await supabase
          .from('match_events')
          .select('tipo, player_id, profiles(*)')
          .in('match_id', matchIds)
          .not('player_id', 'is', null);
        const evts = events || [];

        const goalMap = new Map<string, { player: Profile; count: number }>();
        const assistMap = new Map<string, { player: Profile; count: number }>();
        let yellow = 0, red = 0;

        evts.forEach((e: any) => {
          const p = e.profiles as Profile;
          if (!p) return;
          if (e.tipo === 'gol') {
            const cur = goalMap.get(p.id);
            if (cur) cur.count++;
            else goalMap.set(p.id, { player: p, count: 1 });
          } else if (e.tipo === 'assistencia') {
            const cur = assistMap.get(p.id);
            if (cur) cur.count++;
            else assistMap.set(p.id, { player: p, count: 1 });
          } else if (e.tipo === 'cartao_amarelo') {
            yellow++;
          } else if (e.tipo === 'cartao_vermelho') {
            red++;
          }
        });

        setTopScorers(Array.from(goalMap.values()).sort((a, b) => b.count - a.count).slice(0, 5));
        setTopAssists(Array.from(assistMap.values()).sort((a, b) => b.count - a.count).slice(0, 5));
        setCardCount({ yellow, red });
      }
    } catch {
      setError('Não foi possível carregar a competição.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!competition) return null;

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
            {competition.logo_url ? <img src={competition.logo_url} alt={competition.name} className="w-full h-full object-contain p-2" /> : <Trophy size={32} className="text-neutral-600" />}
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">{competition.name}</h1>
            <p className="text-red-500 text-sm mt-1">{TYPE_LABELS[competition.type]}</p>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        <StatCard label="Jogos" value={completed.length} icon={<Calendar size={14} />} />
        <StatCard label="Vitórias" value={wins} color="text-green-400" icon={<Trophy size={14} />} />
        <StatCard label="Empates" value={draws} color="text-yellow-400" />
        <StatCard label="Derrotas" value={losses} color="text-red-400" />
        <StatCard label="Gols Pró" value={goalsFor} color="text-green-400" />
        <StatCard label="Gols Sofridos" value={goalsAgainst} color="text-red-400" />
        <StatCard label="Saldo" value={goalDiff > 0 ? `+${goalDiff}` : goalDiff} color={goalDiff >= 0 ? 'text-green-400' : 'text-red-400'} />
        <StatCard label="Aproveit." value={`${winPct}%`} icon={<TrendingUp size={14} />} />
      </div>

      {/* Top scorers & assists */}
      {(topScorers.length > 0 || topAssists.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-4">
          {topScorers.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2"><Goal size={16} className="text-green-400" /> Artilheiros</h2>
              <div className="space-y-2">
                {topScorers.map((s, i) => (
                  <div key={s.player.id} className="flex items-center gap-3">
                    <span className="text-neutral-600 text-xs w-5">{i + 1}.</span>
                    <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden shrink-0">
                      {s.player.foto_url ? <img src={s.player.foto_url} alt={s.player.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-neutral-600">{(s.player.apelido || s.player.nome).charAt(0).toUpperCase()}</div>}
                    </div>
                    <span className="text-white text-sm flex-1 truncate">{s.player.apelido || s.player.nome}</span>
                    <span className="text-green-400 font-bold text-sm tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {topAssists.length > 0 && (
            <div className="card p-5">
              <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-blue-400" /> Líder de Assistências</h2>
              <div className="space-y-2">
                {topAssists.map((s, i) => (
                  <div key={s.player.id} className="flex items-center gap-3">
                    <span className="text-neutral-600 text-xs w-5">{i + 1}.</span>
                    <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden shrink-0">
                      {s.player.foto_url ? <img src={s.player.foto_url} alt={s.player.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs font-bold text-neutral-600">{(s.player.apelido || s.player.nome).charAt(0).toUpperCase()}</div>}
                    </div>
                    <span className="text-white text-sm flex-1 truncate">{s.player.apelido || s.player.nome}</span>
                    <span className="text-blue-400 font-bold text-sm tabular-nums">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cards summary */}
      {(cardCount.yellow > 0 || cardCount.red > 0) && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-3 flex items-center gap-2"><Shirt size={16} className="text-red-400" /> Cartões</h2>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-6 rounded bg-yellow-400" />
              <span className="text-white font-bold tabular-nums">{cardCount.yellow}</span>
              <span className="text-neutral-500 text-sm">Amarelos</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-6 rounded bg-red-500" />
              <span className="text-white font-bold tabular-nums">{cardCount.red}</span>
              <span className="text-neutral-500 text-sm">Vermelhos</span>
            </div>
          </div>
        </div>
      )}

      {/* Match list */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-white mb-4">Jogos</h2>
        {matches.length === 0 ? (
          <EmptyState icon={<Calendar size={32} />} title="Nenhum jogo" description="Ainda não há jogos nesta competição." />
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 15).map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`/jogos/${m.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50 hover:bg-neutral-800 transition-colors text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">AL-IF FC vs {m.adversario}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-neutral-600 text-xs">{formatDate(m.data)}</span>
                    {m.status === 'completed' && <span className="text-neutral-400 text-xs font-bold">{m.gols_alif ?? 0} x {m.gols_adversario ?? 0}</span>}
                  </div>
                </div>
                <StatusBadge status={m.status} />
              </button>
            ))}
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
