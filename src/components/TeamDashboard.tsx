import { useEffect, useState } from 'react';
import { supabase, Match, Season } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Crest } from '@/components/Crest';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { formatDate } from '@/lib/utils';
import { Calendar, MapPin, Trophy, TrendingUp, Goal, Shield, ChevronRight, Flame } from 'lucide-react';
import { HallOfFame } from '@/components/HallOfFame';
import { SponsorStrip } from '@/components/Sponsors';

export interface TeamDashboardData {
  season: Season | null;
  nextMatch: Match | null;
  lastMatch: Match | null;
  recentResults: Match[];
  upcomingMatches: Match[];
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

async function loadTeamDashboardData(): Promise<TeamDashboardData> {
  const { data: seasons } = await supabase
    .from('seasons')
    .select('*')
    .order('ano', { ascending: false });
  const activeSeason = seasons?.find(s => s.ativa) || seasons?.[0] || null;
  if (!activeSeason) {
    return {
      season: null, nextMatch: null, lastMatch: null,
      recentResults: [], upcomingMatches: [],
      stats: { jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsMarcados: 0, golsSofridos: 0 },
      artilheiro: null, assistente: null,
    };
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
  const sortedCompleted = completed.sort((a, b) => b.data.localeCompare(a.data));
  const lastMatch = sortedCompleted[0] || null;
  const recentResults = sortedCompleted.slice(0, 3);
  const upcomingMatches = upcoming.slice(0, 4);

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

  return {
    season: activeSeason, nextMatch, lastMatch, recentResults, upcomingMatches,
    stats,
    artilheiro: artilheiroArr[0] || null,
    assistente: assistenteArr[0] || null,
  };
}

export function useTeamDashboard() {
  const [data, setData] = useState<TeamDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      setData(await loadTeamDashboardData());
    } catch {
      setError('Não foi possível carregar o dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return { data, loading, error, reload: load };
}

export function TeamDashboard({ data, loading, error, reload, linkPrefix }: {
  data: TeamDashboardData | null;
  loading: boolean;
  error: string;
  reload: () => void;
  linkPrefix: string;
}) {
  const { navigate } = useRouter();

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  if (!data) return null;

  const saldo = data.stats.golsMarcados - data.stats.golsSofridos;
  const aproveitamento = data.stats.jogos ? Math.round((data.stats.vitorias * 100) / data.stats.jogos) : 0;

  return (
    <div className="relative space-y-8">
      {/* Watermark crest */}
      <div className="crest-watermark" style={{ width: 380, height: 380 }}>
        <Crest size={380} />
      </div>

      {/* 1. Next match hero */}
      <NextMatchHero match={data.nextMatch} linkPrefix={linkPrefix} navigate={navigate} />

      {/* 2. Sponsor strip */}
      <SponsorStrip />

      {/* 3. Campanha da temporada */}
      <section className="animate-slide-up">
        <SectionHeader icon={<TrendingUp size={20} />} title="Campanha da Temporada" subtitle={data.season?.nome} />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <CampaignCard label="Jogos" value={data.stats.jogos} />
          <CampaignCard label="Vitórias" value={data.stats.vitorias} accent="green" />
          <CampaignCard label="Empates" value={data.stats.empates} accent="yellow" />
          <CampaignCard label="Derrotas" value={data.stats.derrotas} accent="red" />
          <CampaignCard label="Gols Marcados" value={data.stats.golsMarcados} icon={<Goal size={16} />} />
          <CampaignCard label="Gols Sofridos" value={data.stats.golsSofridos} />
          <CampaignCard label="Saldo de Gols" value={saldo > 0 ? `+${saldo}` : saldo} accent={saldo >= 0 ? 'green' : 'red'} />
          <CampaignCard label="Aproveitamento" value={`${aproveitamento}%`} accent={aproveitamento >= 50 ? 'green' : undefined} />
        </div>
      </section>

      {/* 4. Hall da Fama */}
      <section className="animate-slide-up">
        <SectionHeader icon={<Trophy size={20} />} title="Hall da Fama" />
        <HallOfFame />
      </section>

      {/* 5. Últimos resultados */}
      <section className="animate-slide-up">
        <SectionHeader icon={<Shield size={20} />} title="Últimos Resultados" />
        {data.recentResults.length > 0 ? (
          <div className="grid sm:grid-cols-3 gap-4">
            {data.recentResults.map(m => {
              const win = (m.gols_alif ?? 0) > (m.gols_adversario ?? 0);
              const draw = (m.gols_alif ?? 0) === (m.gols_adversario ?? 0);
              return (
                <button
                  key={m.id}
                  onClick={() => navigate(`${linkPrefix}/jogos/${m.id}`)}
                  className="card card-hover p-5 text-left animate-scale-in"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className={`badge ${win ? 'bg-green-500/15 text-green-400' : draw ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>
                      {win ? 'Vitória' : draw ? 'Empate' : 'Derrota'}
                    </span>
                    <span className="text-neutral-500 text-xs">{formatDate(m.data)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Crest size={32} />
                      <span className="text-neutral-400 text-xs">AL-IF</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-neutral-800/80">
                      <span className="text-2xl font-bold text-white tabular-nums">{m.gols_alif ?? 0}</span>
                      <span className="text-neutral-600 text-xs">x</span>
                      <span className="text-2xl font-bold text-white tabular-nums">{m.gols_adversario ?? 0}</span>
                    </div>
                    <span className="text-neutral-300 text-xs font-medium truncate max-w-[80px] text-right">{m.adversario}</span>
                  </div>
                  {m.competicao && <p className="text-red-400/70 text-[10px] mt-2 font-medium">{m.competicao}</p>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="card p-6"><EmptyState title="Sem jogos realizados" description="Nenhum jogo foi finalizado ainda." /></div>
        )}
      </section>

      {/* 6. Próximos jogos */}
      {data.upcomingMatches.length > 0 && (
        <section className="animate-slide-up">
          <SectionHeader icon={<Calendar size={20} />} title="Próximos Jogos" />
          <div className="grid sm:grid-cols-2 gap-4">
            {data.upcomingMatches.map(m => (
              <button
                key={m.id}
                onClick={() => navigate(`${linkPrefix}/jogos/${m.id}`)}
                className="card card-hover p-5 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Crest size={40} />
                    <div>
                      <p className="text-xs text-neutral-500">AL-IF FC vs</p>
                      <p className="text-white font-bold">{m.adversario}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-sm">{formatDate(m.data)}</p>
                    {m.horario && <p className="text-neutral-400 text-xs">{m.horario.slice(0,5)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-neutral-800/60">
                  {m.local && <span className="text-neutral-500 text-xs flex items-center gap-1"><MapPin size={12} /> {m.local}</span>}
                  {m.competicao && <span className="text-red-400/70 text-xs font-medium ml-auto">{m.competicao}</span>}
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* 7. Estatísticas do clube */}
      <section className="animate-slide-up">
        <SectionHeader icon={<Flame size={20} />} title="Estatísticas do Clube" />
        <div className="grid md:grid-cols-2 gap-4">
          <PlayerHighlightCard
            title="Artilheiro"
            icon={<Goal size={18} />}
            player={data.artilheiro}
            value={data.artilheiro?.gols ?? 0}
            valueLabel="gols"
          />
          <PlayerHighlightCard
            title="Líder de Assistências"
            icon={<TrendingUp size={18} />}
            player={data.assistente}
            value={data.assistente?.assistencias ?? 0}
            valueLabel="assistências"
          />
        </div>
      </section>
    </div>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <span className="text-red-500">{icon}</span>
        <h2 className="text-lg md:text-xl font-bold text-white">{title}</h2>
        {subtitle && <span className="text-neutral-500 text-sm font-normal hidden sm:inline">· {subtitle}</span>}
      </div>
    </div>
  );
}

function NextMatchHero({ match, linkPrefix, navigate }: { match: Match | null; linkPrefix: string; navigate: (p: string) => void }) {
  if (!match) {
    return (
      <div className="card diagonal-accent p-8 text-center animate-slide-up">
        <Calendar size={48} className="text-neutral-700 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white">Sem jogos agendados</h2>
        <p className="text-neutral-500 text-sm mt-1">Não há próximos jogos no momento.</p>
      </div>
    );
  }

  return (
    <button
      onClick={() => navigate(`${linkPrefix}/jogos/${match.id}`)}
      className="block w-full text-left animate-slide-up group"
    >
      <div className="relative overflow-hidden rounded-2xl border border-red-900/30 bg-gradient-to-br from-neutral-900 via-neutral-900 to-red-950/25 p-6 md:p-8 transition-all duration-300 group-hover:border-red-800/50 group-hover:shadow-xl group-hover:shadow-red-950/20">
        <div className="absolute right-0 top-0 w-48 h-48 opacity-5 group-hover:opacity-[0.08] transition-opacity duration-500">
          <Crest size={192} className="absolute -right-8 -top-8" />
        </div>
        <div className="relative flex flex-col md:flex-row items-center gap-6">
          <div className="flex items-center gap-2 text-red-500">
            <Flame size={18} />
            <span className="text-xs font-bold uppercase tracking-wider">Próximo Jogo</span>
          </div>
          <div className="flex items-center gap-4 md:gap-8 flex-1">
            <div className="flex items-center gap-3">
              <Crest size={56} className="shadow-lg" />
              <div>
                <p className="text-neutral-500 text-xs">AL-IF FC</p>
                <p className="text-white font-bold text-sm">Time da Casa</p>
              </div>
            </div>
            <div className="text-neutral-700 text-2xl font-bold">VS</div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-600 font-bold text-lg shrink-0">
                {match.adversario?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div>
                <p className="text-neutral-500 text-xs">Visitante</p>
                <p className="text-white font-bold text-sm truncate max-w-[120px]">{match.adversario}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6 md:border-l md:border-neutral-800 md:pl-8">
            <div className="text-center">
              <p className="text-neutral-500 text-[10px] uppercase tracking-wide">Data</p>
              <p className="text-white font-bold text-sm">{formatDate(match.data)}</p>
              {match.horario && <p className="text-red-400 text-sm font-medium">{match.horario.slice(0,5)}</p>}
            </div>
            {match.local && (
              <div className="text-center hidden sm:block">
                <p className="text-neutral-500 text-[10px] uppercase tracking-wide">Local</p>
                <p className="text-white font-medium text-xs flex items-center gap-1">
                  <MapPin size={12} /> {match.local}
                </p>
              </div>
            )}
            <ChevronRight size={24} className="text-neutral-600 group-hover:text-red-500 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
        {match.competicao && (
          <div className="relative mt-4 pt-4 border-t border-neutral-800/50">
            <span className="badge bg-red-600/15 text-red-400 border border-red-800/30">
              <Trophy size={12} /> {match.competicao}
            </span>
          </div>
        )}
      </div>
    </button>
  );
}

function CampaignCard({
  label, value, accent, icon,
}: { label: string; value: string | number; accent?: 'green' | 'red' | 'yellow'; icon?: React.ReactNode }) {
  const colors = {
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
  };
  return (
    <div className="card p-4 md:p-5 hover:border-neutral-700 transition-colors animate-scale-in">
      <div className="flex items-center gap-1.5 text-neutral-500 text-xs uppercase tracking-wide font-medium">
        {icon} {label}
      </div>
      <p className={`text-3xl md:text-4xl font-bold tabular-nums mt-2 ${accent ? colors[accent] : 'text-white'}`}>{value}</p>
    </div>
  );
}

function PlayerHighlightCard({
  title, icon, player, value, valueLabel,
}: {
  title: string;
  icon: React.ReactNode;
  player: { nome: string; apelido: string | null; foto_url: string | null } | null;
  value: number;
  valueLabel: string;
}) {
  return (
    <div className="card p-5 diagonal-accent">
      <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wide mb-4 flex items-center gap-2">
        {icon} {title}
      </h3>
      {player ? (
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-neutral-800 overflow-hidden border-2 border-red-600/40 shrink-0">
            {player.foto_url ? (
              <img src={player.foto_url} alt={player.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold text-xl">
                {(player.apelido || player.nome).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-lg truncate">{player.apelido || player.nome}</p>
            <p className="text-neutral-500 text-xs truncate">{player.nome}</p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-red-500 tabular-nums">{value}</p>
            <p className="text-neutral-600 text-xs">{valueLabel}</p>
          </div>
        </div>
      ) : (
        <EmptyState title="Sem dados" description="Nenhum registro ainda." />
      )}
    </div>
  );
}
