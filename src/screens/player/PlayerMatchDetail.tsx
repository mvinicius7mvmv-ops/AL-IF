import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { supabase, Match, MatchEvent, Guest, MatchAttendance, Profile } from '@/lib/supabase';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Crest } from '@/components/Crest';
import { StatusBadge, EventIcon, eventTypeLabel } from '@/components/Badges';
import { AttendanceControl } from '@/screens/player/PlayerDashboard';
import { formatDate, cn } from '@/lib/utils';
import { ArrowLeft, Calendar, Clock, MapPin, Trophy, Shirt, Star } from 'lucide-react';

export function PlayerMatchDetail({ matchId }: { matchId: string }) {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<(MatchEvent & { profiles?: { nome: string; apelido: string | null } | null; guests?: { nome: string } | null })[]>([]);
  const [myAttendance, setMyAttendance] = useState<string | undefined>();
  const [attendance, setAttendance] = useState<
  {
    id: string;
    player_id: string;
    resposta: string;
    profiles?: {
      nome: string;
      apelido: string | null;
      foto_url?: string | null;
    } | null;
  }[]
>([]);
  const [momPlayer, setMomPlayer] = useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (!m) { setError('Jogo não encontrado.'); setLoading(false); return; }
      setMatch(m as Match);

      let momProfile: Profile | null = null;
      if ((m as Match).man_of_the_match_player_id) {
        const { data: mp } = await supabase.from('profiles').select('*').eq('id', (m as Match).man_of_the_match_player_id).maybeSingle();
        momProfile = mp as Profile | null;
      }
      setMomPlayer(momProfile);

      const [evRes, attRes] = await Promise.all([
  supabase.from('match_events')
    .select('*, profiles(nome, apelido), guests(nome)')
    .eq('match_id', matchId)
    .order('minuto', { ascending: true, nullsFirst: true }),

  supabase
    .from('match_attendance')
    .select('id, player_id, resposta, profiles(nome, apelido, foto_url)')
    .eq('match_id', matchId),
]);

setEvents(evRes.data || []);

const attendanceData = (attRes.data || []) as any[];

setMyAttendance(
  attendanceData.find(
    player => player.player_id === profile?.id
  )?.resposta
);

setAttendance(attendanceData);
      
    } catch {
      setError('Não foi possível carregar o jogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [matchId, profile]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!match) return null;

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/jogador/jogos')} className="btn-ghost -ml-2">
        <ArrowLeft size={18} /> Voltar
      </button>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <StatusBadge status={match.status} />
          {match.tipo && <span className="text-xs text-neutral-500">{match.tipo}</span>}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <Crest size={56} />
            <p className="text-white font-bold text-sm text-center truncate w-full">AL-IF FC</p>
          </div>
          <div className="px-3 py-2 rounded-xl bg-neutral-800 shrink-0">
            {match.status === 'completed' ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white tabular-nums">{match.gols_alif ?? 0}</span>
                <span className="text-neutral-600 text-sm">x</span>
                <span className="text-3xl font-bold text-white tabular-nums">{match.gols_adversario ?? 0}</span>
              </div>
            ) : match.status === 'cancelled' ? (
              <span className="text-neutral-500 text-sm font-medium px-2">CANCELADO</span>
            ) : (
              <span className="text-neutral-400 text-sm font-medium px-2">VS</span>
            )}
          </div>
          <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
            <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
              {match.logo_url ? (
                <img src={match.logo_url} alt={match.adversario} className="w-full h-full object-contain p-1" />
              ) : (
                <Shirt size={24} className="text-neutral-600" />
              )}
            </div>
            <p className="text-white font-bold text-sm text-center truncate w-full">{match.adversario}</p>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-neutral-800 grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center gap-2 text-neutral-300">
            <Calendar size={14} className="text-red-500" /> {formatDate(match.data)}
          </div>
          {match.horario && (
            <div className="flex items-center gap-2 text-neutral-300">
              <Clock size={14} className="text-red-500" /> {match.horario.slice(0,5)}
            </div>
          )}
          {match.local && (
            <div className="flex items-center gap-2 text-neutral-300 col-span-2">
              <MapPin size={14} className="text-red-500" /> {match.local}
            </div>
          )}
        </div>

        {(match.competicao || match.segunda_competicao) && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {match.competicao && <span className="badge bg-red-600/15 text-red-400 border border-red-800/40"><Trophy size={12} /> {match.competicao}</span>}
            {match.segunda_competicao && <span className="badge bg-neutral-800 text-neutral-300 border border-neutral-700"><Trophy size={12} /> {match.segunda_competicao}</span>}
          </div>
        )}
      </div>

      {match.status === 'upcoming' && profile && (
        <AttendanceControl matchId={match.id} current={myAttendance as any} onChange={load} />
      )}
      <div className="card p-5">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2 className="text-white font-semibold">Lista de presença</h2>
      <p className="text-neutral-500 text-sm">
        Acompanhe quem confirmou para o jogo
      </p>
    </div>
  </div>

  <div className="space-y-5">

    {/* CONFIRMADOS */}
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-green-400 font-semibold text-sm">
          Confirmados
        </h3>
        <span className="text-neutral-500 text-sm">
          {attendanceByStatus.vou.length}
        </span>
      </div>

      {attendanceByStatus.vou.length > 0 ? (
        <div className="space-y-2">
          {attendanceByStatus.vou.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-neutral-900"
            >
              <div className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center overflow-hidden">
                {player.profiles?.foto_url ? (
                  <img
                    src={player.profiles.foto_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-neutral-500 text-xs">
                    {player.profiles?.nome?.charAt(0)}
                  </span>
                )}
              </div>

              <span className="text-white text-sm">
                {player.profiles?.apelido || player.profiles?.nome}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-neutral-600 text-sm">
          Ninguém confirmou ainda.
        </p>
      )}
    </div>

    {/* TALVEZ */}
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-yellow-400 font-semibold text-sm">
          Talvez
        </h3>
        <span className="text-neutral-500 text-sm">
          {attendanceByStatus.talvez.length}
        </span>
      </div>

      {attendanceByStatus.talvez.length > 0 ? (
        <div className="space-y-2">
          {attendanceByStatus.talvez.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-neutral-900"
            >
              <span className="text-white text-sm">
                {player.profiles?.apelido || player.profiles?.nome}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-neutral-600 text-sm">
          Ninguém marcou "talvez".
        </p>
      )}
    </div>

    {/* NÃO VÃO */}
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-red-400 font-semibold text-sm">
          Não vão
        </h3>
        <span className="text-neutral-500 text-sm">
          {attendanceByStatus.nao_vou.length}
        </span>
      </div>

      {attendanceByStatus.nao_vou.length > 0 ? (
        <div className="space-y-2">
          {attendanceByStatus.nao_vou.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-neutral-900"
            >
              <span className="text-white text-sm">
                {player.profiles?.apelido || player.profiles?.nome}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-neutral-600 text-sm">
          Ninguém marcou "não vou".
        </p>
      )}
    </div>

  </div>
</div>

      {/* Man of the Match */}
      {match.status === 'completed' && momPlayer && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Star size={18} className="text-yellow-400" /> Craque da Partida</h2>
          <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-yellow-500/10 to-transparent border border-yellow-500/20">
            <div className="w-16 h-16 rounded-full bg-neutral-800 overflow-hidden shrink-0 border-2 border-yellow-400/50">
              {momPlayer.foto_url ? (
                <img src={momPlayer.foto_url} alt={momPlayer.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-neutral-600">{(momPlayer.apelido || momPlayer.nome).charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-lg truncate">{momPlayer.apelido || momPlayer.nome}</p>
              {momPlayer.posicao && <p className="text-neutral-500 text-sm">{momPlayer.posicao}</p>}
            </div>
            <Star size={32} className="text-yellow-400 shrink-0" fill="currentColor" />
          </div>
        </div>
      )}

      <div className="card p-5">
        <h2 className="text-base font-bold text-white mb-4">Eventos do Jogo</h2>
        {events.length === 0 ? (
          <EmptyState title="Sem eventos registrados" />
        ) : (
          <div className="space-y-2">
            {events.map(ev => {
              const name = ev.profiles?.apelido || ev.profiles?.nome || ev.guests?.nome || '—';
              const isGuest = !ev.player_id && ev.guest_id;
              return (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50">
                  <div className="text-neutral-500 text-sm font-mono w-10 text-center shrink-0">
                    {ev.minuto != null ? `${ev.minuto}'` : '-'}
                  </div>
                  <EventIcon tipo={ev.tipo} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{name}</p>
                    {isGuest && <p className="text-neutral-500 text-xs">Convidado</p>}
                  </div>
                  <span className={cn(
                    'text-xs font-medium shrink-0',
                    ev.tipo === 'gol' && 'text-green-400',
                    ev.tipo === 'assistencia' && 'text-blue-400',
                    ev.tipo === 'cartao_amarelo' && 'text-yellow-400',
                    ev.tipo === 'cartao_vermelho' && 'text-red-400',
                  )}>
                    {eventTypeLabel(ev.tipo)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
