import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { supabase, Profile, Match, MatchEvent, Season } from '@/lib/supabase';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Crest } from '@/components/Crest';
import { StatusBadge } from '@/components/Badges';
import { formatDate, cn } from '@/lib/utils';
import { ArrowLeft, Goal, TrendingUp, Shirt, Calendar, Square, Star, Phone, Cake, UserPlus, FileText, Edit, Ban } from 'lucide-react';

interface PlayerMatchHistory {
  match: Match;
  gols: number;
  assistencias: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  isMom: boolean;
}

export function PlayerProfileDetail({ playerId }: { playerId: string }) {
  const { role } = useAuth();
  const { navigate } = useRouter();
  const [player, setPlayer] = useState<Profile | null>(null);
  const [season, setSeason] = useState<Season | null>(null);
  const [stats, setStats] = useState({
    gols: 0, assistencias: 0, jogos: 0, presenca: 0,
    cartoesAmarelos: 0, cartoesVermelhos: 0, craque: 0,
  });
  const [history, setHistory] = useState<PlayerMatchHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isAdmin = role === 'admin';

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: p, error: pe } = await supabase.from('profiles').select('*').eq('id', playerId).maybeSingle();
      if (pe) throw pe;
      if (!p) { setError('Jogador não encontrado.'); setLoading(false); return; }
      setPlayer(p as Profile);

      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      setSeason(active);
      if (!active) { setLoading(false); return; }

      const [eventsRes, attRes, adjsRes, momRes] = await Promise.all([
        supabase.from('match_events').select('tipo, match_id, matches!inner(season_id, id, adversario, data, competicao, status, gols_alif, gols_adversario)').eq('matches.season_id', active.id).eq('player_id', playerId),
        supabase.from('match_attendance').select('match_id, resposta, matches!inner(season_id)').eq('matches.season_id', active.id).eq('player_id', playerId),
        supabase.from('manual_stat_adjustments').select('*').eq('season_id', active.id).eq('player_id', playerId),
        supabase.from('matches').select('id').eq('season_id', active.id).eq('status', 'completed').eq('man_of_the_match_player_id', playerId),
      ]);

      const events = (eventsRes.data || []) as any[];
      const attendance = (attRes.data || []) as any[];
      const adjs = (adjsRes.data || []) as any[];
      const momAwards = momRes.data || [];

      const matchIds = new Set<string>();
      events.forEach(e => matchIds.add(e.match_id));
      attendance.forEach(a => matchIds.add(a.match_id));

      setStats({
        gols: events.filter(e => e.tipo === 'gol').length,
        assistencias: events.filter(e => e.tipo === 'assistencia').length,
        jogos: matchIds.size,
        presenca: attendance.filter(a => a.resposta === 'vou').length,
        cartoesAmarelos: events.filter(e => e.tipo === 'cartao_amarelo').length,
        cartoesVermelhos: events.filter(e => e.tipo === 'cartao_vermelho').length,
        craque: momAwards.length,
      });

      adjs.forEach(adj => {
        if (adj.tipo === 'gols') stats.gols += adj.valor;
        else if (adj.tipo === 'assistencias') stats.assistencias += adj.valor;
        else if (adj.tipo === 'jogos') stats.jogos += adj.valor;
        else if (adj.tipo === 'presenca') stats.presenca += adj.valor;
        else if (adj.tipo === 'cartoes_amarelos') stats.cartoesAmarelos += adj.valor;
        else if (adj.tipo === 'cartoes_vermelhos') stats.cartoesVermelhos += adj.valor;
      });

      const momMatchIds = new Set(momAwards.map((m: any) => m.id));
      const matchMap = new Map<string, PlayerMatchHistory>();
      events.forEach(ev => {
        const m = ev.matches;
        if (!m || m.status !== 'completed') return;
        if (!matchMap.has(m.id)) {
          matchMap.set(m.id, {
            match: m as Match,
            gols: 0, assistencias: 0, cartoesAmarelos: 0, cartoesVermelhos: 0,
            isMom: momMatchIds.has(m.id),
          });
        }
        const entry = matchMap.get(m.id)!;
        if (ev.tipo === 'gol') entry.gols++;
        else if (ev.tipo === 'assistencia') entry.assistencias++;
        else if (ev.tipo === 'cartao_amarelo') entry.cartoesAmarelos++;
        else if (ev.tipo === 'cartao_vermelho') entry.cartoesVermelhos++;
      });

      const sorted = [...matchMap.values()].sort((a, b) => b.match.data.localeCompare(a.match.data));
      setHistory(sorted);
    } catch {
      setError('Não foi possível carregar o perfil do jogador.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [playerId]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!player) return null;

  const statCards = [
    { label: 'Gols', value: stats.gols, icon: <Goal size={18} />, color: 'text-green-400' },
    { label: 'Assistências', value: stats.assistencias, icon: <TrendingUp size={18} />, color: 'text-blue-400' },
    { label: 'Jogos', value: stats.jogos, icon: <Shirt size={18} />, color: 'text-white' },
    { label: 'Presenças', value: stats.presenca, icon: <Calendar size={18} />, color: 'text-white' },
    { label: 'Cartões Amarelos', value: stats.cartoesAmarelos, icon: <Square size={18} className="text-yellow-400" />, color: 'text-yellow-400' },
    { label: 'Cartões Vermelhos', value: stats.cartoesVermelhos, icon: <Square size={18} className="text-red-400" />, color: 'text-red-400' },
    { label: 'Craque da Partida', value: stats.craque, icon: <Star size={18} />, color: 'text-yellow-400' },
  ];

  return (
    <div className="space-y-5">
      <button onClick={() => navigate('/elenco')} className="btn-ghost -ml-2">
        <ArrowLeft size={18} /> Voltar para o Elenco
      </button>

      {/* Profile header */}
      <div className="card p-5 md:p-6">
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <div className="w-28 h-28 rounded-full bg-neutral-800 overflow-hidden border-2 border-red-600/50 shrink-0">
            {player.foto_url ? (
              <img src={player.foto_url} alt={player.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-neutral-600">
                {(player.apelido || player.nome).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-white">{player.apelido || player.nome}</h1>
              {player.numero != null && (
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white text-sm font-bold">
                  {player.numero}
                </span>
              )}
            </div>
            <p className="text-neutral-400 text-sm mt-1">{player.nome}</p>
            {player.posicao && (
              <p className="text-neutral-500 text-sm mt-1">{player.posicao}</p>
            )}
            <div className="flex items-center justify-center sm:justify-start gap-2 mt-3">
              <span className={cn(
                'badge',
                player.status === 'active' ? 'bg-green-500/15 text-green-400 border border-green-800/40' : 'bg-red-500/15 text-red-400 border border-red-800/40',
              )}>
                {player.status === 'active' ? 'Ativo' : 'Inativo'}
              </span>
              {player.data_entrada && (
                <span className="text-neutral-500 text-xs">No clube desde {formatDate(player.data_entrada)}</span>
              )}
            </div>
          </div>

          {/* Admin-only actions */}
          {isAdmin && (
            <div className="flex flex-col gap-2 shrink-0">
              <button
                onClick={() => navigate(`/admin/jogadores`)}
                className="btn-primary text-xs px-3 py-2 flex items-center gap-1.5"
              >
                <Edit size={14} /> Editar
              </button>
              <button
                className="btn-ghost text-xs px-3 py-2 flex items-center gap-1.5 text-red-400"
              >
                <Ban size={14} /> Desativar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Admin-only private info */}
      {isAdmin && (
        <div className="card p-5 border-red-800/30">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide mb-4 flex items-center gap-2">
            <FileText size={16} /> Informações Privadas (Admin)
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <PrivateField icon={<Phone size={14} />} label="Telefone" value={player.telefone || '-'} />
            <PrivateField icon={<Cake size={14} />} label="Data de Nascimento" value={player.data_nascimento ? formatDate(player.data_nascimento) : '-'} />
            <PrivateField icon={<UserPlus size={14} />} label="Data de Entrada" value={player.data_entrada ? formatDate(player.data_entrada) : '-'} />
            <PrivateField icon={<FileText size={14} />} label="Status" value={player.status === 'active' ? 'Ativo' : 'Inativo'} />
          </div>
          {player.observacoes && (
            <div className="mt-3 p-3 rounded-lg bg-neutral-800/50">
              <p className="text-xs text-neutral-500 mb-1">Observações Internas</p>
              <p className="text-neutral-300 text-sm">{player.observacoes}</p>
            </div>
          )}
        </div>
      )}

      {/* Public stats */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-red-500" /> Estatísticas
          {season && <span className="text-neutral-500 text-sm font-normal">· {season.nome}</span>}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {statCards.map(c => (
            <div key={c.label} className="card p-4">
              <div className={cn('flex items-center gap-2', c.color)}>
                {c.icon}
              </div>
              <p className={cn('text-2xl font-bold tabular-nums mt-1', c.color)}>{c.value}</p>
              <p className="text-[10px] text-neutral-500 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Match history */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-red-500" /> Histórico de Jogos
        </h2>
        {history.length === 0 ? (
          <EmptyState icon={<Calendar size={40} />} title="Sem jogos registrados" description="O histórico aparecerá aqui quando o jogador participar de partidas." />
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.match.id} className="card p-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Crest size={32} className="shrink-0" />
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-white font-bold text-lg tabular-nums">{h.match.gols_alif ?? 0}</span>
                      <span className="text-neutral-600 text-xs">x</span>
                      <span className="text-white font-bold text-lg tabular-nums">{h.match.gols_adversario ?? 0}</span>
                    </div>
                    <p className="text-neutral-300 text-sm truncate">{h.match.adversario}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-neutral-500 text-xs">{formatDate(h.match.data)}</p>
                    {h.match.competicao && <p className="text-neutral-600 text-[10px]">{h.match.competicao}</p>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-2 border-t border-neutral-800">
                  {h.gols > 0 && (
                    <span className="badge bg-green-500/15 text-green-400 border border-green-800/40 text-xs">
                      <Goal size={12} /> {h.gols} {h.gols === 1 ? 'Gol' : 'Gols'}
                    </span>
                  )}
                  {h.assistencias > 0 && (
                    <span className="badge bg-blue-500/15 text-blue-400 border border-blue-800/40 text-xs">
                      <TrendingUp size={12} /> {h.assistencias} {h.assistencias === 1 ? 'Assistência' : 'Assistências'}
                    </span>
                  )}
                  {h.cartoesAmarelos > 0 && (
                    <span className="badge bg-yellow-500/15 text-yellow-400 border border-yellow-800/40 text-xs">
                      <Square size={12} /> {h.cartoesAmarelos} Amarelo{h.cartoesAmarelos > 1 ? 's' : ''}
                    </span>
                  )}
                  {h.cartoesVermelhos > 0 && (
                    <span className="badge bg-red-500/15 text-red-400 border border-red-800/40 text-xs">
                      <Square size={12} /> {h.cartoesVermelhos} Vermelho{h.cartoesVermelhos > 1 ? 's' : ''}
                    </span>
                  )}
                  {h.isMom && (
                    <span className="badge bg-yellow-500/20 text-yellow-300 border border-yellow-600/40 text-xs">
                      <Star size={12} fill="currentColor" /> Craque da Partida
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PrivateField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50">
      <span className="text-red-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-neutral-500 text-xs">{label}</p>
        <p className="text-white text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}
