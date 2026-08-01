import { useEffect, useState } from 'react';
import { supabase, Match, Season } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Crest } from '@/components/Crest';
import { formatDate, cn } from '@/lib/utils';
import { Calendar, MapPin, Clock } from 'lucide-react';

type Tab = 'upcoming' | 'completed' | 'cancelled';

export function PublicMatches() {
  const { navigate } = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [tab, setTab] = useState<Tab>('upcoming');
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
        setMatches([]);
        setLoading(false);
        return;
      }
      const { data, error: e } = await supabase
        .from('matches')
        .select('*')
        .eq('season_id', active.id)
        .order('data', { ascending: false });
      if (e) throw e;
      setMatches(data || []);
    } catch {
      setError('Não foi possível carregar os jogos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = matches.filter(m => m.status === tab);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Próximos', count: matches.filter(m => m.status === 'upcoming').length },
    { key: 'completed', label: 'Realizados', count: matches.filter(m => m.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelados', count: matches.filter(m => m.status === 'cancelled').length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Jogos & Agenda</h1>
        {season && <p className="text-neutral-500 text-sm mt-1">{season.nome}</p>}
      </div>

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
        <EmptyState
          icon={<Calendar size={48} />}
          title={tab === 'upcoming' ? 'Nenhum jogo agendado' : tab === 'completed' ? 'Nenhum jogo realizado' : 'Nenhum jogo cancelado'}
          description="Volte mais tarde para atualizações."
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map(m => (
            <MatchCard key={m.id} match={m} onClick={() => navigate(`/jogos/${m.id}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function MatchCard({ match, onClick }: { match: Match; onClick: () => void }) {
  const isCompleted = match.status === 'completed';
  const isCancelled = match.status === 'cancelled';
  const oppLogo = match.logo_url;
  return (
    <button
      onClick={onClick}
      className={cn(
        'card p-4 text-left group relative overflow-hidden',
        !isCancelled && 'card-hover',
      )}
    >
      {isCancelled && (
        <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-lg">
          CANCELADO
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Crest size={40} className="shrink-0" />
          {oppLogo ? (
            <div className="w-10 h-10 rounded-full bg-neutral-800 overflow-hidden shrink-0 border border-neutral-700">
              <img src={oppLogo} alt={match.adversario} className="w-full h-full object-contain p-0.5" />
            </div>
          ) : null}
          <div className="min-w-0">
            <p className="text-[10px] text-neutral-500 uppercase tracking-wide">AL-IF FC vs</p>
            <p className="text-white font-bold truncate">{match.adversario}</p>
          </div>
        </div>
        {isCompleted && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-800 shrink-0">
            <span className="text-xl font-bold text-white tabular-nums">{match.gols_alif ?? 0}</span>
            <span className="text-neutral-600 text-xs">x</span>
            <span className="text-xl font-bold text-white tabular-nums">{match.gols_adversario ?? 0}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-400">
        <span className="flex items-center gap-1.5"><Calendar size={12} /> {formatDate(match.data)}</span>
        {match.horario && <span className="flex items-center gap-1.5"><Clock size={12} /> {match.horario.slice(0,5)}</span>}
        {match.local && <span className="flex items-center gap-1.5 truncate"><MapPin size={12} /> {match.local}</span>}
      </div>

      {match.competicao && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="badge bg-red-600/15 text-red-400 border border-red-800/40">{match.competicao}</span>
          {match.segunda_competicao && (
            <span className="badge bg-neutral-800 text-neutral-400 border border-neutral-700">{match.segunda_competicao}</span>
          )}
        </div>
      )}
    </button>
  );
}
