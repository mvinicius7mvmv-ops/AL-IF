import { useEffect, useState } from 'react';
import { supabase, Match, MatchEvent, Guest, Profile } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Crest } from '@/components/Crest';
import { StatusBadge, EventIcon, eventTypeLabel } from '@/components/Badges';
import { formatDate, formatDateTime, cn } from '@/lib/utils';
import { ArrowLeft, Calendar, Clock, MapPin, Trophy, Shirt, Star } from 'lucide-react';

export function PublicMatchDetail({ matchId }: { matchId: string }) {
  const { navigate } = useRouter();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<(MatchEvent & { profiles?: { nome: string; apelido: string | null } | null; guests?: { nome: string } | null })[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [momPlayer, setMomPlayer] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: m, error: e1 } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (e1) throw e1;
      if (!m) { setError('Jogo não encontrado.'); setLoading(false); return; }
      setMatch(m as Match);

      let momProfile: Profile | null = null;
      if ((m as Match).man_of_the_match_player_id) {
        const { data: mp } = await supabase.from('profiles').select('*').eq('id', (m as Match).man_of_the_match_player_id).maybeSingle();
        momProfile = mp as Profile | null;
      }
      setMomPlayer(momProfile);

      const [evRes, gRes] = await Promise.all([
        supabase.from('match_events')
          .select('*, profiles(nome, apelido), guests(nome)')
          .eq('match_id', matchId)
          .order('minuto', { ascending: true, nullsFirst: true }),
        supabase.from('guests').select('*').eq('match_id', matchId).order('nome'),
      ]);
      setEvents(evRes.data || []);
      setGuests(gRes.data || []);
    } catch {
      setError('Não foi possível carregar o jogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [matchId]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!match) return null;

  const isCompleted = match.status === 'completed';
  const isCancelled = match.status === 'cancelled';

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/jogos')} className="btn-ghost -ml-2">
        <ArrowLeft size={18} /> Voltar para Jogos
      </button>

      {/* Match header */}
      <div className="card p-5 md:p-6">
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
            {isCompleted ? (
              <div className="flex items-center gap-2">
                <span className="text-3xl font-bold text-white tabular-nums">{match.gols_alif ?? 0}</span>
                <span className="text-neutral-600 text-sm">x</span>
                <span className="text-3xl font-bold text-white tabular-nums">{match.gols_adversario ?? 0}</span>
              </div>
            ) : isCancelled ? (
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

        {match.observacoes && (
          <div className="mt-3 p-3 rounded-lg bg-neutral-800/50 text-neutral-400 text-sm">
            {match.observacoes}
          </div>
        )}
      </div>

      {/* Events */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-white mb-4">Eventos do Jogo</h2>
        {events.length === 0 ? (
          <EmptyState title="Sem eventos registrados" description="Os eventos aparecerão aqui quando forem adicionados." />
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

      {/* Man of the Match */}
      {isCompleted && momPlayer && (
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

      {/* Guests (public - names only) */}
      {guests.length > 0 && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-4">Convidados</h2>
          <div className="flex flex-wrap gap-2">
            {guests.map(g => (
              <span key={g.id} className="badge bg-neutral-800 text-neutral-300 border border-neutral-700">
                {g.nome}{g.posicao ? ` · ${g.posicao}` : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
