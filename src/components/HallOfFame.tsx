import { useEffect, useState } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { Loading } from '@/components/States';
import { Star, Goal, TrendingUp, Shirt, Calendar } from 'lucide-react';

interface HallOfFameEntry {
  player: Profile;
  value: number;
}

export function HallOfFame() {
  const [loading, setLoading] = useState(true);
  const [craqueTemp, setCraqueTemp] = useState<HallOfFameEntry | null>(null);
  const [artilheiro, setArtilheiro] = useState<HallOfFameEntry | null>(null);
  const [assistente, setAssistente] = useState<HallOfFameEntry | null>(null);
  const [maisJogos, setMaisJogos] = useState<HallOfFameEntry | null>(null);
  const [melhorPresenca, setMelhorPresenca] = useState<HallOfFameEntry | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      if (!active) { setLoading(false); return; }

      const [momRes, eventsRes, adjsRes, attRes, playersRes] = await Promise.all([
        supabase.from('matches').select('man_of_the_match_player_id').eq('season_id', active.id).eq('status', 'completed').not('man_of_the_match_player_id', 'is', null),
        supabase.from('match_events').select('tipo, player_id, matches!inner(season_id)').eq('matches.season_id', active.id).not('player_id', 'is', null),
        supabase.from('manual_stat_adjustments').select('tipo, valor, player_id').eq('season_id', active.id),
        supabase.from('match_attendance').select('player_id, matches!inner(season_id)').eq('matches.season_id', active.id).eq('resposta', 'vou'),
        supabase.from('profiles').select('*').eq('status', 'active'),
      ]);

      const profiles = (playersRes.data || []) as Profile[];
      const profMap = new Map(profiles.map(p => [p.id, p]));
      const events = eventsRes.data || [];
      const adjs = adjsRes.data || [];
      const attendance = attRes.data || [];
      const momAwards = momRes.data || [];

      const momCount = new Map<string, number>();
      momAwards.forEach((m: any) => {
        const id = m.man_of_the_match_player_id;
        momCount.set(id, (momCount.get(id) || 0) + 1);
      });

      const goals = new Map<string, number>();
      const assists = new Map<string, number>();
      const matchSet = new Map<string, Set<string>>();
      const presence = new Map<string, number>();

      events.forEach((e: any) => {
        const id = e.player_id;
        if (e.tipo === 'gol') goals.set(id, (goals.get(id) || 0) + 1);
        else if (e.tipo === 'assistencia') assists.set(id, (assists.get(id) || 0) + 1);
        if (!matchSet.has(id)) matchSet.set(id, new Set());
        matchSet.get(id)!.add(e.match_id);
      });

      adjs.forEach((a: any) => {
        const id = a.player_id;
        if (a.tipo === 'gols') goals.set(id, (goals.get(id) || 0) + a.valor);
        else if (a.tipo === 'assistencias') assists.set(id, (assists.get(id) || 0) + a.valor);
        else if (a.tipo === 'jogos') {
          if (!matchSet.has(id)) matchSet.set(id, new Set());
          for (let i = 0; i < a.valor; i++) matchSet.get(id)!.add(`adj-${id}-${i}`);
        }
        else if (a.tipo === 'presenca') presence.set(id, (presence.get(id) || 0) + a.valor);
      });

      attendance.forEach((a: any) => {
        presence.set(a.player_id, (presence.get(a.player_id) || 0) + 1);
      });

      const jogosCount = new Map<string, number>();
      matchSet.forEach((set, id) => jogosCount.set(id, set.size));

      function top(entries: Map<string, number>): HallOfFameEntry | null {
        let best: HallOfFameEntry | null = null;
        entries.forEach((v, id) => {
          const p = profMap.get(id);
          if (p && v > 0 && (!best || v > best.value)) best = { player: p, value: v };
        });
        return best;
      }

      setCraqueTemp(top(momCount));
      setArtilheiro(top(goals));
      setAssistente(top(assists));

      const jogosEntries = new Map<string, number>();
      jogosCount.forEach((v, id) => jogosEntries.set(id, v));
      setMaisJogos(top(jogosEntries));
      setMelhorPresenca(top(presence));
    } catch {
      // silently fail — Hall of Fame is non-critical
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <Loading />;

  const cards: { icon: React.ReactNode; title: string; entry: HallOfFameEntry | null; unit: string }[] = [
    { icon: <Star size={16} className="text-yellow-400" />, title: 'Craque da Temporada', entry: craqueTemp, unit: 'prêmios' },
    { icon: <Goal size={16} className="text-green-400" />, title: 'Artilheiro', entry: artilheiro, unit: 'gols' },
    { icon: <TrendingUp size={16} className="text-blue-400" />, title: 'Líder de Assistências', entry: assistente, unit: 'assistências' },
    { icon: <Shirt size={16} className="text-red-400" />, title: 'Mais Partidas', entry: maisJogos, unit: 'jogos' },
    { icon: <Calendar size={16} className="text-purple-400" />, title: 'Melhor Presença', entry: melhorPresenca, unit: 'presenças' },
  ];

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-4 flex items-center gap-2">
        <Star size={16} className="text-yellow-400" /> Hall da Fama
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {cards.map((c, i) => (
          <HallCard key={i} icon={c.icon} title={c.title} entry={c.entry} unit={c.unit} />
        ))}
      </div>
    </div>
  );
}

function HallCard({ icon, title, entry, unit }: { icon: React.ReactNode; title: string; entry: HallOfFameEntry | null; unit: string }) {
  return (
    <div className="p-4 rounded-xl bg-neutral-800/50 border border-neutral-800 text-center">
      <div className="flex items-center justify-center gap-1.5 mb-3">
        {icon}
        <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">{title}</p>
      </div>
      {entry ? (
        <>
          <div className="w-16 h-16 rounded-full bg-neutral-800 overflow-hidden border-2 border-yellow-400/30 mx-auto mb-2">
            {entry.player.foto_url ? (
              <img src={entry.player.foto_url} alt={entry.player.nome} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold text-xl">
                {(entry.player.apelido || entry.player.nome).charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <p className="text-white font-bold text-sm truncate">{entry.player.apelido || entry.player.nome}</p>
          <p className="text-red-500 font-bold text-lg tabular-nums mt-1">{entry.value}</p>
          <p className="text-neutral-600 text-xs">{unit}</p>
        </>
      ) : (
        <p className="text-neutral-600 text-sm py-4">Sem dados</p>
      )}
    </div>
  );
}
