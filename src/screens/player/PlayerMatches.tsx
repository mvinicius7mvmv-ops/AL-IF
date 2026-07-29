import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { supabase, Match, MatchAttendance, Season } from '@/lib/supabase';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { MatchCard } from '@/screens/public/PublicMatches';
import { AttendanceControl } from '@/screens/player/PlayerDashboard';
import { cn } from '@/lib/utils';
import { Calendar } from 'lucide-react';

type Tab = 'upcoming' | 'completed' | 'cancelled';

export function PlayerMatches() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [attendance, setAttendance] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<Tab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    if (!profile) return;
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0];
      if (!active) { setMatches([]); setLoading(false); return; }

      const [mRes, aRes] = await Promise.all([
        supabase.from('matches').select('*').eq('season_id', active.id).order('data', { ascending: false }),
        supabase.from('match_attendance').select('match_id, resposta').eq('player_id', profile.id),
      ]);
      setMatches(mRes.data || []);
      const map: Record<string, string> = {};
      (aRes.data || []).forEach((a: any) => { map[a.match_id] = a.resposta; });
      setAttendance(map);
    } catch {
      setError('Não foi possível carregar os jogos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [profile]);

  const filtered = matches.filter(m => m.status === tab);
  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Próximos', count: matches.filter(m => m.status === 'upcoming').length },
    { key: 'completed', label: 'Realizados', count: matches.filter(m => m.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelados', count: matches.filter(m => m.status === 'cancelled').length },
  ];

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Jogos</h1>

      <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 min-w-fit px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              tab === t.key ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
            )}
          >
            {t.label} <span className="opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Calendar size={48} />} title="Nenhum jogo" />
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="space-y-2">
              <MatchCard match={m} onClick={() => navigate(`/jogador/jogos/${m.id}`)} />
              {m.status === 'upcoming' && (
                <AttendanceControl
                  matchId={m.id}
                  current={attendance[m.id] as any}
                  onChange={load}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
