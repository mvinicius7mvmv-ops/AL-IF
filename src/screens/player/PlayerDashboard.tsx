import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase, Match, Season } from '@/lib/supabase';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { MatchCard } from '@/screens/public/PublicMatches';
import { TeamDashboard, useTeamDashboard } from '@/components/TeamDashboard';
import { cn } from '@/lib/utils';
import { Calendar, Wallet, TrendingUp, Goal, Shirt, ArrowRight, Star, Square } from 'lucide-react';

export function PlayerDashboard() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const team = useTeamDashboard();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextMatches, setNextMatches] = useState<Match[]>([]);
  const [myAttendance, setMyAttendance] = useState<Record<string, string>>({});
  const [myStats, setMyStats] = useState({
    gols: 0, assistencias: 0, jogos: 0, presenca: 0,
    cartoesAmarelos: 0, cartoesVermelhos: 0, craque: 0,
  });
  const [pendingFees, setPendingFees] = useState(0);
  const [season, setSeason] = useState<Season | null>(null);

  async function loadPersonal() {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0];
      if (!active) { setLoading(false); return; }
      setSeason(active);

      const [matchesRes, attRes, eventsRes, feesRes, momRes] = await Promise.all([
        supabase.from('matches').select('*').eq('season_id', active.id).order('data', { ascending: true }),
        supabase.from('match_attendance').select('match_id, resposta').eq('player_id', profile.id),
        supabase.from('match_events').select('tipo, match_id, matches!inner(season_id)').eq('matches.season_id', active.id).eq('player_id', profile.id),
        supabase.from('monthly_fees').select('status').eq('player_id', profile.id).in('status', ['pendente', 'atrasado']),
        supabase.from('matches').select('man_of_the_match_player_id').eq('season_id', active.id).eq('status', 'completed').eq('man_of_the_match_player_id', profile.id),
      ]);

      const matches = (matchesRes.data || []) as Match[];
      const upcoming = matches.filter(m => m.status === 'upcoming');
      setNextMatches(upcoming);

      const attMap: Record<string, string> = {};
      (attRes.data || []).forEach((a: any) => { attMap[a.match_id] = a.resposta; });
      setMyAttendance(attMap);

      const events = eventsRes.data || [];
      const matchIds = new Set<string>();
      events.forEach((e: any) => matchIds.add(e.match_id));

      const craqueCount = (momRes.data || []).length;

      setMyStats({
        gols: events.filter((e: any) => e.tipo === 'gol').length,
        assistencias: events.filter((e: any) => e.tipo === 'assistencia').length,
        jogos: matchIds.size,
        presenca: (attRes.data || []).filter((a: any) => a.resposta === 'vou').length,
        cartoesAmarelos: events.filter((e: any) => e.tipo === 'cartao_amarelo').length,
        cartoesVermelhos: events.filter((e: any) => e.tipo === 'cartao_vermelho').length,
        craque: craqueCount,
      });

      setPendingFees((feesRes.data || []).length);
    } catch {
      setError('Não foi possível carregar seus dados.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadPersonal(); }, [profile]);

  if (team.loading || loading) return <Loading />;
  if (team.error) return <ErrorState message={team.error} onRetry={team.reload} />;
  if (error) return <ErrorState message={error} onRetry={loadPersonal} />;

  const personalCards = [
    { label: 'Gols', value: myStats.gols, icon: <Goal size={18} />, color: 'text-green-400' },
    { label: 'Assistências', value: myStats.assistencias, icon: <TrendingUp size={18} />, color: 'text-blue-400' },
    { label: 'Jogos', value: myStats.jogos, icon: <Shirt size={18} />, color: 'text-white' },
    { label: 'Presenças', value: myStats.presenca, icon: <Calendar size={18} />, color: 'text-white' },
    { label: 'Cartões Amarelos', value: myStats.cartoesAmarelos, icon: <Square size={18} className="text-yellow-400" />, color: 'text-yellow-400' },
    { label: 'Cartões Vermelhos', value: myStats.cartoesVermelhos, icon: <Square size={18} className="text-red-400" />, color: 'text-red-400' },
    { label: 'Craque da Partida', value: myStats.craque, icon: <Star size={18} />, color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-neutral-800 overflow-hidden border-2 border-red-600/50 shrink-0">
          {profile?.foto_url ? (
            <img src={profile.foto_url} alt={profile.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-neutral-600">
              {(profile?.apelido || profile?.nome || '?').charAt(0).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Olá, {profile?.apelido || profile?.nome?.split(' ')[0]}!</h1>
          <p className="text-neutral-500 text-sm">Bem-vindo à área do jogador</p>
        </div>
      </div>

      {/* Pending fees alert */}
      {pendingFees > 0 && (
        <button onClick={() => navigate('/jogador/mensalidades')} className="w-full text-left">
          <div className="card p-4 border-yellow-800/50 bg-yellow-900/10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center shrink-0">
              <Wallet size={20} className="text-yellow-400" />
            </div>
            <div className="flex-1">
              <p className="text-white font-semibold text-sm">Mensalidades pendentes</p>
              <p className="text-neutral-400 text-xs">Você tem {pendingFees} mensalidade(s) em aberto</p>
            </div>
            <ArrowRight size={18} className="text-neutral-500" />
          </div>
        </button>
      )}

      {/* Team Dashboard (club info, campaign, hall of fame, sponsors, etc.) */}
      <TeamDashboard data={team.data} loading={team.loading} error={team.error} reload={team.reload} linkPrefix="/jogador" />

      {/* Personal statistics */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-red-500" /> Minhas Estatísticas
          {season && <span className="text-neutral-500 text-sm font-normal">· {season.nome}</span>}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {personalCards.map(c => (
            <div key={c.label} className="card p-4">
              <div className="flex items-center gap-2 text-neutral-500 text-xs uppercase tracking-wide font-medium">
                {c.icon}
              </div>
              <p className={cn('text-2xl font-bold tabular-nums mt-1', c.color)}>{c.value}</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming matches with attendance */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar size={18} className="text-red-500" /> Próximos Jogos
          </h2>
          <button onClick={() => navigate('/jogador/jogos')} className="text-red-500 text-xs font-medium hover:text-red-400">
            Ver todos
          </button>
        </div>
        {nextMatches.length === 0 ? (
          <EmptyState icon={<Calendar size={40} />} title="Sem jogos agendados" />
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {nextMatches.slice(0, 4).map(m => (
              <div key={m.id} className="space-y-2">
                <MatchCard match={m} onClick={() => navigate(`/jogador/jogos/${m.id}`)} />
                <AttendanceControl
                  matchId={m.id}
                  current={myAttendance[m.id] as any}
                  onChange={loadPersonal}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AttendanceControl({
  matchId, current, onChange,
}: {
  matchId: string;
  current: 'vou' | 'nao_vou' | 'talvez' | undefined;
  onChange: () => void;
}) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);

  async function setResposta(resposta: 'vou' | 'nao_vou' | 'talvez') {
    if (!profile) return;
    setLoading(true);
    try {
      const existing = await supabase
        .from('match_attendance')
        .select('id')
        .eq('match_id', matchId)
        .eq('player_id', profile.id)
        .maybeSingle();

      if (existing.data) {
        const { error } = await supabase
          .from('match_attendance')
          .update({ resposta, updated_at: new Date().toISOString() })
          .eq('id', existing.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('match_attendance')
          .insert({ match_id: matchId, player_id: profile.id, resposta });
        if (error) throw error;
      }
      showToast('Presença confirmada!', 'success');
      onChange();
    } catch (e: any) {
      showToast(e.message || 'Erro ao confirmar presença', 'error');
    } finally {
      setLoading(false);
    }
  }

  const options: { value: 'vou' | 'nao_vou' | 'talvez'; label: string; cls: string }[] = [
    { value: 'vou', label: 'Vou', cls: 'bg-green-600 text-white' },
    { value: 'talvez', label: 'Talvez', cls: 'bg-yellow-600 text-white' },
    { value: 'nao_vou', label: 'Não vou', cls: 'bg-red-600 text-white' },
  ];

  return (
    <div className="card p-2">
      <p className="text-[10px] text-neutral-500 uppercase tracking-wide font-medium px-2 py-1">Confirmar presença</p>
      <div className="grid grid-cols-3 gap-1.5">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => setResposta(o.value)}
            disabled={loading}
            className={cn(
              'px-2 py-2 rounded-md text-xs font-semibold transition-all',
              current === o.value ? o.cls : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
