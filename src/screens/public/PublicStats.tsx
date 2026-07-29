import { useEffect, useState } from 'react';
import { supabase, Season, Profile, MatchEvent, ManualStatAdjustment } from '@/lib/supabase';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { cn } from '@/lib/utils';
import { Trophy, Goal, TrendingUp, Shirt, Square, Calendar, Star } from 'lucide-react';

interface PlayerStats {
  player: Profile;
  gols: number;
  assistencias: number;
  jogos: number;
  cartoesAmarelos: number;
  cartoesVermelhos: number;
  presenca: number;
  craque: number;
}

type StatTab = 'gols' | 'assistencias' | 'jogos' | 'cartoes_amarelos' | 'cartoes_vermelhos' | 'presenca' | 'craque';

export function PublicStats() {
  const [season, setSeason] = useState<Season | null>(null);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [collective, setCollective] = useState({ jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsMarcados: 0, golsSofridos: 0 });
  const [tab, setTab] = useState<StatTab>('gols');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      setSeason(active);
      if (!active) {
        setLoading(false);
        return;
      }

      const [matchesRes, eventsRes, adjsRes, attendanceRes, playersRes, momRes] = await Promise.all([
        supabase.from('matches').select('*').eq('season_id', active.id),
        supabase.from('match_events').select('tipo, player_id, match_id, matches!inner(season_id)').eq('matches.season_id', active.id).not('player_id', 'is', null),
        supabase.from('manual_stat_adjustments').select('*').eq('season_id', active.id),
        supabase.from('match_attendance').select('player_id, match_id, matches!inner(season_id)').eq('matches.season_id', active.id).eq('resposta', 'vou'),
        supabase.from('profiles').select('*').eq('status', 'active'),
        supabase.from('matches').select('man_of_the_match_player_id').eq('season_id', active.id).eq('status', 'completed').not('man_of_the_match_player_id', 'is', null),
      ]);

      const matches = (matchesRes.data || []).filter((m: any) => m.status === 'completed');
      const events = (eventsRes.data || []) as unknown as MatchEvent[];
      const adjs = (adjsRes.data || []) as unknown as ManualStatAdjustment[];
      const attendance = (attendanceRes.data || []) as any[];
      const profiles = (playersRes.data || []) as Profile[];
      const momAwards = momRes.data || [];

      setCollective({
        jogos: matches.length,
        vitorias: matches.filter((m: any) => (m.gols_alif ?? 0) > (m.gols_adversario ?? 0)).length,
        empates: matches.filter((m: any) => (m.gols_alif ?? 0) === (m.gols_adversario ?? 0)).length,
        derrotas: matches.filter((m: any) => (m.gols_alif ?? 0) < (m.gols_adversario ?? 0)).length,
        golsMarcados: matches.reduce((s: number, m: any) => s + (m.gols_alif ?? 0), 0),
        golsSofridos: matches.reduce((s: number, m: any) => s + (m.gols_adversario ?? 0), 0),
      });

      const map = new Map<string, PlayerStats>();
      profiles.forEach(p => {
        map.set(p.id, {
          player: p,
          gols: 0, assistencias: 0, jogos: 0,
          cartoesAmarelos: 0, cartoesVermelhos: 0, presenca: 0,
          craque: 0,
        });
      });

      events.forEach(ev => {
        const s = map.get(ev.player_id!);
        if (!s) return;
        if (ev.tipo === 'gol') s.gols++;
        else if (ev.tipo === 'assistencia') s.assistencias++;
        else if (ev.tipo === 'cartao_amarelo') s.cartoesAmarelos++;
        else if (ev.tipo === 'cartao_vermelho') s.cartoesVermelhos++;
      });

      // jogos = number of completed matches the player has an event or attendance in
      const matchesPlayedByPlayer = new Map<string, Set<string>>();
      events.forEach(ev => {
        if (!ev.player_id || !ev.match_id) return;
        if (!matchesPlayedByPlayer.has(ev.player_id)) matchesPlayedByPlayer.set(ev.player_id, new Set());
        matchesPlayedByPlayer.get(ev.player_id)!.add(ev.match_id);
      });
      attendance.forEach(a => {
        if (!matchesPlayedByPlayer.has(a.player_id)) matchesPlayedByPlayer.set(a.player_id, new Set());
        matchesPlayedByPlayer.get(a.player_id)!.add(a.match_id);
      });
      matchesPlayedByPlayer.forEach((set, pid) => {
        const s = map.get(pid);
        if (s) s.jogos = set.size;
      });

      attendance.forEach(a => {
        const s = map.get(a.player_id);
        if (s) s.presenca++;
      });

      adjs.forEach(adj => {
        const s = map.get(adj.player_id);
        if (!s) return;
        if (adj.tipo === 'gols') s.gols += adj.valor;
        else if (adj.tipo === 'assistencias') s.assistencias += adj.valor;
        else if (adj.tipo === 'jogos') s.jogos += adj.valor;
        else if (adj.tipo === 'cartoes_amarelos') s.cartoesAmarelos += adj.valor;
        else if (adj.tipo === 'cartoes_vermelhos') s.cartoesVermelhos += adj.valor;
        else if (adj.tipo === 'presenca') s.presenca += adj.valor;
      });

      momAwards.forEach((m: any) => {
        const s = map.get(m.man_of_the_match_player_id);
        if (s) s.craque++;
      });

      setPlayers([...map.values()]);
    } catch {
      setError('Não foi possível carregar as estatísticas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs: { key: StatTab; label: string; icon: React.ReactNode; getValue: (s: PlayerStats) => number }[] = [
    { key: 'gols', label: 'Artilharia', icon: <Goal size={14} />, getValue: s => s.gols },
    { key: 'assistencias', label: 'Assistências', icon: <TrendingUp size={14} />, getValue: s => s.assistencias },
    { key: 'jogos', label: 'Jogos', icon: <Shirt size={14} />, getValue: s => s.jogos },
    { key: 'presenca', label: 'Presença', icon: <Calendar size={14} />, getValue: s => s.presenca },
    { key: 'craque', label: 'Craque da Partida', icon: <Star size={14} />, getValue: s => s.craque },
    { key: 'cartoes_amarelos', label: 'Cartões Amarelos', icon: <Square size={14} className="text-yellow-400" />, getValue: s => s.cartoesAmarelos },
    { key: 'cartoes_vermelhos', label: 'Cartões Vermelhos', icon: <Square size={14} className="text-red-400" />, getValue: s => s.cartoesVermelhos },
  ];

  const currentTab = tabs.find(t => t.key === tab)!;
  const ranked = players
    .filter(s => currentTab.getValue(s) > 0)
    .sort((a, b) => currentTab.getValue(b) - currentTab.getValue(a))
    .slice(0, 15);

  const saldo = collective.golsMarcados - collective.golsSofridos;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Estatísticas</h1>
        {season && <p className="text-neutral-500 text-sm mt-1">{season.nome}</p>}
      </div>

      {/* Coletivas */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <Trophy size={18} className="text-red-500" /> Estatísticas Coletivas
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          <StatBox label="Jogos" value={collective.jogos} />
          <StatBox label="Vitórias" value={collective.vitorias} accent="green" />
          <StatBox label="Empates" value={collective.empates} accent="yellow" />
          <StatBox label="Derrotas" value={collective.derrotas} accent="red" />
          <StatBox label="Gols Pro" value={collective.golsMarcados} />
          <StatBox label="Saldo" value={saldo > 0 ? `+${saldo}` : saldo} accent={saldo >= 0 ? 'green' : 'red'} />
        </div>
      </div>

      {/* Rankings */}
      <div>
        <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
          <TrendingUp size={18} className="text-red-500" /> Rankings Individuais
        </h2>

        <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-x-auto no-scrollbar mb-4">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                tab === t.key ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
              )}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {ranked.length === 0 ? (
          <EmptyState
            icon={currentTab.icon}
            title="Sem dados"
            description="Nenhum registro nesta categoria ainda."
          />
        ) : (
          <div className="card divide-y divide-neutral-800">
            {ranked.map((s, i) => (
              <div key={s.player.id} className="flex items-center gap-3 p-3">
                <div className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                  i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-neutral-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-400',
                )}>
                  {i + 1}
                </div>
                <div className="w-9 h-9 rounded-full bg-neutral-800 overflow-hidden shrink-0">
                  {s.player.foto_url ? (
                    <img src={s.player.foto_url} alt={s.player.nome} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold">
                      {(s.player.apelido || s.player.nome).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{s.player.apelido || s.player.nome}</p>
                  {s.player.posicao && <p className="text-neutral-500 text-xs">{s.player.posicao}</p>}
                </div>
                <p className="text-xl font-bold text-red-500 tabular-nums">{currentTab.getValue(s)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, accent }: { label: string; value: string | number; accent?: 'green' | 'red' | 'yellow' }) {
  const colors = { green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400' };
  return (
    <div className="card p-3 text-center">
      <p className={`text-2xl font-bold tabular-nums ${accent ? colors[accent] : 'text-white'}`}>{value}</p>
      <p className="text-[10px] text-neutral-500 uppercase tracking-wide font-medium mt-0.5">{label}</p>
    </div>
  );
}
