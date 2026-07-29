import { useEffect, useState } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Users } from 'lucide-react';

export function PublicSquad() {
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'active')
        .order('numero', { ascending: true, nullsFirst: false });
      if (e) throw e;
      setPlayers(data || []);
    } catch {
      setError('Não foi possível carregar o elenco.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Elenco</h1>
        <p className="text-neutral-500 text-sm mt-1">{players.length} atletas</p>
      </div>

      {players.length === 0 ? (
        <EmptyState
          icon={<Users size={48} />}
          title="Elenco vazio"
          description="Nenhum jogador cadastrado ainda."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {players.map(p => (
            <div key={p.id} className="card p-4 text-center group hover:border-red-600/50 transition-colors">
              <div className="w-20 h-20 mx-auto rounded-full bg-neutral-800 overflow-hidden border-2 border-neutral-700 group-hover:border-red-600/50 transition-colors">
                {p.foto_url ? (
                  <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-neutral-600">
                    {(p.apelido || p.nome).charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              {p.numero != null && (
                <div className="mt-2 inline-flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-xs font-bold">
                  {p.numero}
                </div>
              )}
              <p className="text-white font-semibold text-sm mt-2 truncate">{p.apelido || p.nome}</p>
              {p.apelido && <p className="text-neutral-500 text-xs truncate">{p.nome}</p>}
              {p.posicao && <p className="text-neutral-400 text-xs mt-1">{p.posicao}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
