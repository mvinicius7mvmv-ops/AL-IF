import { useEffect, useState } from 'react';
import { supabase, Match, Profile, Season, MatchEvent } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Crest } from '@/components/Crest';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { formatDate } from '@/lib/utils';
import { Calendar, MapPin, Trophy, TrendingUp, Goal, Shield } from 'lucide-react';
import { HallOfFame } from '@/components/HallOfFame';
import { SponsorCarousel } from '@/components/Sponsors';

interface DashboardData {
  season: Season | null;
  nextMatch: (Match & { opponent_events?: MatchEvent[] }) | null;
  lastMatch: Match | null;
  stats: {
    jogos: number;
    vitorias: number;
    empates: number;
    derrotas: number;
    golsMarcados: number;
    golsSofridos: number;
  };
  artilheiro: { nome: string; apelido: string | null; gols: number; foto_url: string | null } | null;
  assistente: { nome: string; apelido: string | null; assistencias: number; foto_url: string | null } | null;
}

export function PublicDashboard() {
  const { navigate } = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase
        .from('seasons')
        .select('*')
        .order('ano', { ascending: false });
      const activeSeason = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      if (!activeSeason) {
        setData({
          season: null,
          nextMatch: null,
          lastMatch: null,
          stats: { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsMarcados: 0, golsSofridos: 0 },
          artilheiro: null,
          assistente: null,
        });
        setLoading(false);
        return;
      }

      const { data: matches } = await supabase
        .from('matches')
        .select('*')
        .eq('season_id', activeSeason.id)
        .order('data', { ascending: true });

      const completed = (matches || []).filter(m => m.status === 'completed');
      const upcoming = (matches || []).filter(m => m.status === 'upcoming');

      const stats = {
        jogos: completed.length,
        vitorias: completed.filter(m => (m.gols_alif ?? 0) > (m.gols_adversario ?? 0)).length,
        empates: completed.filter(m => (m.gols_alif ?? 0) === (m.gols_adversario ?? 0)).length,
        derrotas: completed.filter(m => (m.gols_alif ?? 0) < (m.gols_adversario ?? 0)).length,
        golsMarcados: completed.reduce((sum, m) => sum + (m.gols_alif ?? 0), 0),
        golsSofridos: completed.reduce((sum, m) => sum + (m.gols_adversario ?? 0), 0),
      };

      const nextMatch = upcoming.sort((a, b) => a.data.localeCompare(b.data))[0] || null;
      const lastMatch = completed.sort((a, b) => b.data.localeCompare(a.data))[0] || null;

      // Artilheiro & assistente
      const { data: events } = await supabase
        .from('match_events')
        .select('tipo, player_id, profiles!inner(nome, apelido, foto_url)')
        .in('match_id', completed.map(m => m.id))
        .not('player_id', 'is', null);

      const goalsByPlayer = new Map<string, { nome: string; apelido: string | null; foto_url: string | null; gols: number }>();
      const assistsByPlayer = new Map<string, { nome: string; apelido: string | null; foto_url: string | null; assistencias: number }>();
      (events || []).forEach((ev: any) => {
        const p = ev.profiles;
        if (!p) return;
        if (ev.tipo === 'gol') {
          const cur = goalsByPlayer.get(ev.player_id);
          if (cur) cur.gols++;
          else goalsByPlayer.set(ev.player_id, { nome: p.nome, apelido: p.apelido, foto_url: p.foto_url, gols: 1 });
        } else if (ev.tipo === 'assistencia') {
          const cur = assistsByPlayer.get(ev.player_id);
          if (cur) cur.assistencias++;
          else assistsByPlayer.set(ev.player_id, { nome: p.nome, apelido: p.apelido, foto_url: p.foto_url, assistencias: 1 });
        }
      });

      // Include manual adjustments
      const { data: adjs } = await supabase
        .from('manual_stat_adjustments')
        .select('tipo, valor, player_id, profiles!inner(nome, apelido, foto_url)')
        .eq('season_id', activeSeason.id);

      (adjs || []).forEach((adj: any) => {
        const p = adj.profiles;
        if (!p) return;
        if (adj.tipo === 'gols') {
          const cur = goalsByPlayer.get(adj.player_id);
          if (cur) cur.gols += adj.valor;
          else goalsByPlayer.set(adj.player_id, { nome: p.nome, apelido: p.apelido, foto_url: p.foto_url, gols: adj.valor });
        } else if (adj.tipo === 'assistencias') {
          const cur = assistsByPlayer.get(adj.player_id);
          if (cur) cur.assistencias += adj.valor;
          else assistsByPlayer.set(adj.player_id, { nome: p.nome, apelido: p.apelido, foto_url: p.foto_url, assistencias: adj.valor });
        }
      });

      const artilheiroArr = [...goalsByPlayer.values()].sort((a, b) => b.gols - a.gols);
      const assistenteArr = [...assistsByPlayer.values()].sort((a, b) => b.assistencias - a.assistencias);

      setData({
        season: activeSeason,
        nextMatch,
        lastMatch,
        stats,
        artilheiro: artilheiroArr[0] || null,
        assistente: assistenteArr[0] || null,
      });
    } catch (e) {
      setError('Não foi possível carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const saldo = data.stats.golsMarcados - data.stats.golsSofridos;

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900 to-red-950/30 p-6 md:p-8">
        <div className="absolute -right-8 -top-8 opacity-10">
          <Crest size={220} />
        </div>
        <div className="relative">
          <div className="flex items-center gap-4 mb-4">
            <Crest size={64} className="shadow-xl" />
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">AL-IF FC</h1>
              <p className="text-neutral-400 text-sm mt-0.5">
                {data.season ? data.season.nome : 'Nenhuma temporada ativa'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="badge bg-red-600/20 text-red-400 border border-red-800/50">
              <Trophy size={12} /> {data.season?.ano ?? '-'}
            </span>
            <span className="badge bg-neutral-800 text-neutral-300 border border-neutral-700">
              {data.stats.jogos} jogos disputados
            </span>
          </div>
        </div>
      </div>

      {/* Patrocinadores - Carousel */}
      <SponsorCarousel />

      {/* Campanha */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-red-500" /> Campanha da Temporada
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Jogos" value={data.stats.jogos} />
          <StatCard label="Vitórias" value={data.stats.vitorias} accent="green" />
          <StatCard label="Empates" value={data.stats.empates} accent="yellow" />
          <StatCard label="Derrotas" value={data.stats.derrotas} accent="red" />
          <StatCard label="Gols Marcados" value={data.stats.golsMarcados} icon={<Goal size={14} />} />
          <StatCard label="Gols Sofridos" value={data.stats.golsSofridos} />
          <StatCard label="Saldo de Gols" value={saldo > 0 ? `+${saldo}` : saldo} accent={saldo >= 0 ? 'green' : 'red'} />
          <StatCard label="Aproveitamento" value={data.stats.jogos ? `${Math.round((data.stats.vitorias * 100) / data.stats.jogos)}%` : '0%'} />
        </div>
      </div>

      {/* Próximo jogo + último resultado */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Calendar size={16} className="text-red-500" /> Próximo Jogo
          </h3>
          {data.nextMatch ? (
            <button
              onClick={() => navigate(`/jogos/${data.nextMatch!.id}`)}
              className="w-full text-left group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Crest size={48} />
                  <div>
                    <p className="text-xs text-neutral-500">AL-IF FC vs</p>
                    <p className="text-white font-bold text-lg">{data.nextMatch.adversario}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{formatDate(data.nextMatch.data)}</p>
                  {data.nextMatch.horario && <p className="text-neutral-400 text-sm">{data.nextMatch.horario.slice(0,5)}</p>}
                </div>
              </div>
              {data.nextMatch.local && (
                <p className="text-neutral-500 text-sm mt-3 flex items-center gap-1.5">
                  <MapPin size={14} /> {data.nextMatch.local}
                </p>
              )}
              {data.nextMatch.competicao && (
                <p className="text-red-400 text-xs mt-2 font-medium">{data.nextMatch.competicao}</p>
              )}
            </button>
          ) : (
            <EmptyState title="Sem jogos agendados" description="Não há próximos jogos no momento." />
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <Shield size={16} className="text-red-500" /> Último Resultado
          </h3>
          {data.lastMatch ? (
            <button
              onClick={() => navigate(`/jogos/${data.lastMatch!.id}`)}
              className="w-full text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Crest size={40} />
                  <p className="text-white font-semibold text-sm">AL-IF FC</p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800">
                  <span className="text-2xl font-bold text-white tabular-nums">{data.lastMatch.gols_alif ?? 0}</span>
                  <span className="text-neutral-600 text-xs">x</span>
                  <span className="text-2xl font-bold text-white tabular-nums">{data.lastMatch.gols_adversario ?? 0}</span>
                </div>
                <div className="flex items-center gap-2 flex-1 justify-end">
                  <p className="text-white font-semibold text-sm text-right truncate">{data.lastMatch.adversario}</p>
                </div>
              </div>
              <p className="text-neutral-500 text-xs mt-3 text-center">{formatDate(data.lastMatch.data)}</p>
            </button>
          ) : (
            <EmptyState title="Sem jogos realizados" description="Nenhum jogo foi finalizado ainda." />
          )}
        </div>
      </div>

      {/* Destaques individuais */}
      <div className="grid md:grid-cols-2 gap-4">
        <PlayerHighlight
          title="Artilheiro"
          icon={<Goal size={16} />}
          player={data.artilheiro}
          value={data.artilheiro?.gols ?? 0}
          valueLabel="gols"
        />
        <PlayerHighlight
          title="Líder de Assistências"
          icon={<TrendingUp size={16} />}
          player={data.assistente}
          value={data.assistente?.assistencias ?? 0}
          valueLabel="assistências"
        />
      </div>

      {/* Hall da Fama */}
      <HallOfFame />
    </div>
  );
}

function StatCard({
  label, value, accent, icon,
}: { label: string; value: string | number; accent?: 'green' | 'red' | 'yellow'; icon?: React.ReactNode }) {
  const colors = {
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  };
  return (
    <div className="card p-4">
      <p className="stat-label flex items-center gap-1">{icon} {label}</p>
      <p className={`stat-value mt-1 ${accent ? colors[accent] : ''}`}>{value}</p>
    </div>
  );
}

function PlayerHighlight({
  title, icon, player, value, valueLabel,
}: {
  title: string;
  icon: React.ReactNode;
  player: { nome: string; apelido: string | null; foto_url: string | null } | null;
  value: number;
  valueLabel: string;
}) {
  return (
    <div className="card p-5">
      <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4 flex items-center gap-2 text-red-500">
        {icon} {title}
      </h3>
      {player ? (
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-neutral-800 overflow-hidden border-2 border-red-600/50 shrink-0">
            {player.foto_url ? (
              <img src={player.foto_url} alt={player.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold text-lg">
                {(player.apelido || player.nome).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold truncate">{player.apelido || player.nome}</p>
            <p className="text-neutral-500 text-xs truncate">{player.nome}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-red-500 tabular-nums">{value}</p>
            <p className="text-neutral-600 text-xs">{valueLabel}</p>
          </div>
        </div>
      ) : (
        <EmptyState title="Sem dados" description="Nenhum registro ainda." />
      )}
    </div>
  );
}
