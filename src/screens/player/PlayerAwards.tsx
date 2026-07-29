import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Match, Season, MatchEvent } from '@/lib/supabase';
import { Loading, EmptyState } from '@/components/States';
import { formatDate } from '@/lib/utils';
import { Star, Goal, TrendingUp, Shirt, Calendar, Trophy, Medal, Award } from 'lucide-react';

interface MomAward {
  match: Match;
  opponent: string;
  competition: string;
  score: string;
  date: string;
}

interface Achievement {
  icon: React.ReactNode;
  title: string;
  description: string;
  unlocked: boolean;
  progress?: { current: number; target: number };
}

export function PlayerAwards() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [momAwards, setMomAwards] = useState<MomAward[]>([]);
  const [momCount, setMomCount] = useState(0);
  const [seasonStats, setSeasonStats] = useState<{ season: Season; stats: { jogos: number; gols: number; assistencias: number; craque: number; cartoes: number } }[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);

  useEffect(() => { if (profile) load(); }, [profile]);

  async function load() {
    if (!profile) return;
    setLoading(true);
    try {
      // Fetch all completed matches where this player is MoM
      const { data: momMatches } = await supabase
        .from('matches')
        .select('*')
        .eq('man_of_the_match_player_id', profile.id)
        .eq('status', 'completed')
        .order('data', { ascending: false });

      const momList: MomAward[] = (momMatches || []).map((m: any) => ({
        match: m,
        opponent: m.adversario,
        competition: m.competicao || m.tipo || '',
        score: `${m.gols_alif ?? 0} x ${m.gols_adversario ?? 0}`,
        date: m.data,
      }));
      setMomAwards(momList);
      setMomCount(momList.length);

      // Fetch all seasons
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });

      // Fetch all events for this player
      const { data: events } = await supabase
        .from('match_events')
        .select('tipo, match_id, matches!inner(season_id, status)')
        .eq('player_id', profile.id)
        .eq('matches.status', 'completed');

      // Fetch manual adjustments
      const { data: adjs } = await supabase
        .from('manual_stat_adjustments')
        .select('*')
        .eq('player_id', profile.id);

      // Fetch attendance
      const { data: attendance } = await supabase
        .from('match_attendance')
        .select('match_id, matches!inner(season_id, status)')
        .eq('player_id', profile.id)
        .eq('resposta', 'vou')
        .eq('matches.status', 'completed');

      // Fetch all completed matches for MoM per season
      const { data: allMomMatches } = await supabase
        .from('matches')
        .select('id, season_id, man_of_the_match_player_id, status')
        .eq('status', 'completed')
        .eq('man_of_the_match_player_id', profile.id);

      const seasonList: { season: Season; stats: { jogos: number; gols: number; assistencias: number; craque: number; cartoes: number } }[] = [];

      (seasons || []).forEach((season: any) => {
        const seasonEvents = (events || []).filter((e: any) => e.matches?.season_id === season.id);
        const seasonAdjs = (adjs || []).filter((a: any) => a.season_id === season.id);
        const seasonAtt = (attendance || []).filter((a: any) => a.matches?.season_id === season.id);
        const seasonMom = (allMomMatches || []).filter((m: any) => m.season_id === season.id);

        const gols = seasonEvents.filter((e: any) => e.tipo === 'gol').length
          + seasonAdjs.filter((a: any) => a.tipo === 'gols').reduce((s: number, a: any) => s + a.valor, 0);
        const assistencias = seasonEvents.filter((e: any) => e.tipo === 'assistencia').length
          + seasonAdjs.filter((a: any) => a.tipo === 'assistencias').reduce((s: number, a: any) => s + a.valor, 0);
        const jogos = new Set(seasonEvents.map((e: any) => e.match_id)).size
          + seasonAdjs.filter((a: any) => a.tipo === 'jogos').reduce((s: number, a: any) => s + a.valor, 0);
        const cartoes = seasonEvents.filter((e: any) => e.tipo === 'cartao_amarelo' || e.tipo === 'cartao_vermelho').length
          + seasonAdjs.filter((a: any) => a.tipo === 'cartoes_amarelos' || a.tipo === 'cartoes_vermelhos').reduce((s: number, a: any) => s + a.valor, 0);
        const craque = seasonMom.length;

        if (jogos > 0 || gols > 0 || assistencias > 0 || craque > 0 || cartoes > 0) {
          seasonList.push({ season, stats: { jogos, gols, assistencias, craque, cartoes } });
        }
      });

      setSeasonStats(seasonList);

      // Compute achievements
      const totalJogos = seasonList.reduce((s, x) => s + x.stats.jogos, 0);
      const totalGols = seasonList.reduce((s, x) => s + x.stats.gols, 0);
      const totalAssists = seasonList.reduce((s, x) => s + x.stats.assistencias, 0);

      // Check for hat-trick (3+ goals in a single match)
      const matchGoals = new Map<string, number>();
      (events || []).forEach((e: any) => {
        if (e.tipo === 'gol') matchGoals.set(e.match_id, (matchGoals.get(e.match_id) || 0) + 1);
      });
      const hasHatTrick = Array.from(matchGoals.values()).some(v => v >= 3);

      // Check for 100% presence (all matches attended)
      const { data: allCompletedMatches } = await supabase
        .from('matches')
        .select('id, status')
        .eq('status', 'completed');
      const totalCompletedMatches = allCompletedMatches?.length || 0;
      const totalAttended = (attendance || []).length;
      const perfectPresence = totalCompletedMatches > 0 && totalAttended === totalCompletedMatches;

      // Check season leader (top scorer in any season)
      let isTopScorer = false;
      for (const sl of seasonList) {
        const { data: seasonEvents } = await supabase
          .from('match_events')
          .select('player_id, matches!inner(season_id)')
          .eq('matches.season_id', sl.season.id)
          .eq('tipo', 'gol');
        const goalMap = new Map<string, number>();
        (seasonEvents || []).forEach((e: any) => goalMap.set(e.player_id, (goalMap.get(e.player_id) || 0) + 1));
        const maxGoals = Math.max(...Array.from(goalMap.values()), 0);
        if (maxGoals > 0 && (goalMap.get(profile.id) || 0) === maxGoals) isTopScorer = true;
      }

      const achs: Achievement[] = [
        { icon: <Star className="text-yellow-400" size={24} />, title: 'Craque da Partida', description: 'Eleito o craque de uma partida', unlocked: momCount > 0 },
        { icon: <Goal className="text-green-400" size={24} />, title: 'Hat-trick', description: '3 ou mais gols em uma partida', unlocked: hasHatTrick },
        { icon: <TrendingUp className="text-blue-400" size={24} />, title: 'Garçom', description: '10 ou mais assistências no total', unlocked: totalAssists >= 10, progress: totalAssists < 10 ? { current: totalAssists, target: 10 } : undefined },
        { icon: <Shirt className="text-red-400" size={24} />, title: '50 Jogos', description: '50 partidas disputadas', unlocked: totalJogos >= 50, progress: totalJogos < 50 ? { current: totalJogos, target: 50 } : undefined },
        { icon: <Calendar className="text-purple-400" size={24} />, title: '100% Presença', description: 'Esteve em todos os jogos', unlocked: perfectPresence },
        { icon: <Trophy className="text-yellow-400" size={24} />, title: 'Artilheiro da Temporada', description: 'Maior artilheiro em uma temporada', unlocked: isTopScorer },
        { icon: <TrendingUp className="text-blue-400" size={24} />, title: 'Líder de Assistências', description: 'Maior assistente em uma temporada', unlocked: false },
        { icon: <Medal className="text-yellow-400" size={24} />, title: 'Campeão', description: 'Vencedor de uma competição', unlocked: false },
      ];
      setAchievements(achs);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (!profile) return <Loading />;
  if (loading) return <Loading />;

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">Premiações</h1>

      {/* Summary */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center">
            <Star size={24} className="text-yellow-400" fill="currentColor" />
          </div>
          <div>
            <p className="text-neutral-400 text-sm">Craque da Partida</p>
            <p className="text-white text-3xl font-bold tabular-nums">{momCount}</p>
            <p className="text-neutral-600 text-xs">{momCount === 1 ? 'vez' : 'vezes'}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      {momAwards.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Star size={16} className="text-yellow-400" /> Histórico de Prêmios</h2>
          <div className="space-y-3">
            {momAwards.map((a, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50">
                <Star size={20} className="text-yellow-400 shrink-0" fill="currentColor" />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">AL-IF FC {a.score} {a.opponent}</p>
                  <p className="text-neutral-500 text-xs">{a.competition}</p>
                </div>
                <p className="text-neutral-500 text-xs shrink-0">{formatDate(a.date)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season History */}
      {seasonStats.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Trophy size={16} className="text-yellow-400" /> Histórico por Temporada</h2>
          <div className="space-y-4">
            {seasonStats.map(({ season, stats }) => (
              <div key={season.id} className="p-4 rounded-lg bg-neutral-800/50">
                <p className="text-white font-semibold text-sm mb-3">Temporada {season.ano}</p>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                  <SeasonStat label="Jogos" value={stats.jogos} />
                  <SeasonStat label="Gols" value={stats.gols} />
                  <SeasonStat label="Assistências" value={stats.assistencias} />
                  <SeasonStat label="Craque" value={stats.craque} />
                  <SeasonStat label="Cartões" value={stats.cartoes} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Award size={16} className="text-yellow-400" /> Conquistas</h2>
        {achievements.filter(a => a.unlocked).length === 0 ? (
          <EmptyState icon={<Award size={32} />} title="Nenhuma conquista desbloqueada" description="Continue jogando para desbloquear conquistas!" />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {achievements.map((a, i) => (
              <div
                key={i}
                className={`p-4 rounded-xl border text-center transition-all ${a.unlocked ? 'bg-neutral-800/50 border-neutral-800' : 'bg-neutral-900 border-neutral-800/50 opacity-50'}`}
              >
                <div className="flex justify-center mb-2">{a.icon}</div>
                <p className="text-white text-xs font-bold">{a.title}</p>
                <p className="text-neutral-500 text-xs mt-1">{a.description}</p>
                {a.progress && (
                  <div className="mt-2">
                    <div className="h-1.5 rounded-full bg-neutral-700 overflow-hidden">
                      <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, (a.progress.current / a.progress.target) * 100)}%` }} />
                    </div>
                    <p className="text-neutral-600 text-xs mt-1 tabular-nums">{a.progress.current}/{a.progress.target}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {momAwards.length === 0 && seasonStats.length === 0 && (
        <EmptyState icon={<Trophy size={40} />} title="Nenhuma premiação ainda" description="Suas premiações aparecerão aqui conforme você for eleito Craque da Partida." />
      )}
    </div>
  );
}

function SeasonStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
      <p className="text-neutral-600 text-xs">{label}</p>
    </div>
  );
}
