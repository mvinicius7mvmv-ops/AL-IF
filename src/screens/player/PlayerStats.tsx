import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, Season } from '@/lib/supabase';
import { Loading, ErrorState } from '@/components/States';
import { Goal, TrendingUp, Shirt, Calendar, Square } from 'lucide-react';

export function PlayerStats() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [season, setSeason] = useState<Season | null>(null);
  const [stats, setStats] = useState({
    gols: 0, assistencias: 0, jogos: 0, presenca: 0,
    cartoesAmarelos: 0, cartoesVermelhos: 0,
  });

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      setSeason(active);
      if (!active) { setLoading(false); return; }

      const [eventsRes, attRes, adjsRes] = await Promise.all([
        supabase.from('match_events').select('tipo, match_id, matches!inner(season_id)').eq('matches.season_id', active.id).eq('player_id', profile.id),
        supabase.from('match_attendance').select('match_id, resposta, matches!inner(season_id)').eq('matches.season_id', active.id).eq('player_id', profile.id),
        supabase.from('manual_stat_adjustments').select('*').eq('season_id', active.id).eq('player_id', profile.id),
      ]);

      const events = eventsRes.data || [];
      const attendance = attRes.data || [];
      const adjs = adjsRes.data || [];

      const matchIds = new Set<string>();
      events.forEach((e: any) => matchIds.add(e.match_id));
      attendance.forEach((a: any) => matchIds.add(a.match_id));

      const s = {
        gols: events.filter((e: any) => e.tipo === 'gol').length,
        assistencias: events.filter((e: any) => e.tipo === 'assistencia').length,
        jogos: matchIds.size,
        presenca: attendance.filter((a: any) => a.resposta === 'vou').length,
        cartoesAmarelos: events.filter((e: any) => e.tipo === 'cartao_amarelo').length,
        cartoesVermelhos: events.filter((e: any) => e.tipo === 'cartao_vermelho').length,
      };

      adjs.forEach((adj: any) => {
        if (adj.tipo === 'gols') s.gols += adj.valor;
        else if (adj.tipo === 'assistencias') s.assistencias += adj.valor;
        else if (adj.tipo === 'jogos') s.jogos += adj.valor;
        else if (adj.tipo === 'presenca') s.presenca += adj.valor;
        else if (adj.tipo === 'cartoes_amarelos') s.cartoesAmarelos += adj.valor;
        else if (adj.tipo === 'cartoes_vermelhos') s.cartoesVermelhos += adj.valor;
      });

      setStats(s);
    } catch {
      setError('Não foi possível carregar suas estatísticas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [profile]);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const cards = [
    { label: 'Gols', value: stats.gols, icon: <Goal size={20} />, color: 'text-green-400' },
    { label: 'Assistências', value: stats.assistencias, icon: <TrendingUp size={20} />, color: 'text-blue-400' },
    { label: 'Jogos', value: stats.jogos, icon: <Shirt size={20} />, color: 'text-white' },
    { label: 'Presenças', value: stats.presenca, icon: <Calendar size={20} />, color: 'text-white' },
    { label: 'Cartões Amarelos', value: stats.cartoesAmarelos, icon: <Square size={20} className="text-yellow-400" />, color: 'text-yellow-400' },
    { label: 'Cartões Vermelhos', value: stats.cartoesVermelhos, icon: <Square size={20} className="text-red-400" />, color: 'text-red-400' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Minhas Estatísticas</h1>
        {season && <p className="text-neutral-500 text-sm mt-1">{season.nome}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map(c => (
          <div key={c.label} className="card p-5">
            <div className={`w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center mb-3 ${c.color}`}>
              {c.icon}
            </div>
            <p className="text-3xl font-bold text-white tabular-nums">{c.value}</p>
            <p className="text-xs text-neutral-500 uppercase tracking-wide font-medium mt-1">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
