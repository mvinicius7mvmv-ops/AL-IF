import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, type Match, type MatchEvent, type Season } from '@/lib/supabase';
import { renderCard, shareCard, downloadCard } from '@/lib/matchCardRenderer';
import { cn } from '@/lib/utils';
import { Calendar, Download, Share2, Image as ImageIcon, ChevronDown, Check } from 'lucide-react';

type EventRow = MatchEvent & {
  profiles?: { nome: string; apelido: string | null } | null;
  guests?: { nome: string } | null;
};

export function AdminMatchCards() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [seasonId, setSeasonId] = useState<string>('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [shareStatus, setShareStatus] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectedMatchRef = useRef<Match | null>(null);
  selectedMatchRef.current = match;

  useEffect(() => {
    async function init() {
      try {
        const { data } = await supabase
          .from('seasons')
          .select('*')
          .order('ano', { ascending: false });
        const s = (data || []) as Season[];
        setSeasons(s);
        const active = s.find(x => x.ativa) || s[0];
        if (active) setSeasonId(active.id);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  useEffect(() => {
    if (!seasonId) { setMatches([]); return; }
    async function load() {
      const { data } = await supabase
        .from('matches')
        .select('*')
        .eq('season_id', seasonId)
        .order('data', { ascending: false });
      setMatches((data || []) as Match[]);
      setSelectedMatchId('');
      setMatch(null);
      setEvents([]);
    }
    load();
  }, [seasonId]);

  useEffect(() => {
    if (!selectedMatchId) { setMatch(null); setEvents([]); return; }
    async function load() {
      const [matchRes, eventsRes] = await Promise.all([
        supabase.from('matches').select('*').eq('id', selectedMatchId).maybeSingle(),
        supabase
          .from('match_events')
          .select('*, profiles(nome, apelido), guests(nome)')
          .eq('match_id', selectedMatchId)
          .order('minuto', { ascending: true, nullsFirst: true }),
      ]);
      setMatch((matchRes.data as Match) || null);
      setEvents((eventsRes.data as EventRow[]) || []);
    }
    load();
  }, [selectedMatchId]);

  const drawCard = useCallback(async () => {
    const m = selectedMatchRef.current;
    const canvas = canvasRef.current;
    if (!m || !canvas) return;
    setRendering(true);
    try {
      await renderCard(canvas, { match: m, events }, '/assets/images/al-if-crest-transparent.png');
    } finally {
      setRendering(false);
    }
  }, [events]);

  useEffect(() => {
    if (match) drawCard();
  }, [match, events, drawCard]);

  const upcoming = matches.filter(m => m.status === 'upcoming');
  const completed = matches.filter(m => m.status === 'completed');

  const filename = match
    ? `alif-fc-${match.status === 'completed' ? 'resultado' : 'proximo-jogo'}-${match.data}.png`
    : 'alif-fc-card.png';

  async function handleShare() {
    if (!canvasRef.current || !match) return;
    setShareStatus('Compartilhando...');
    try {
      const result = await shareCard(canvasRef.current, filename);
      if (result === 'shared') setShareStatus('Compartilhado!');
      else if (result === 'downloaded') setShareStatus('Download iniciado!');
      else setShareStatus('Copiado!');
    } catch {
      setShareStatus('Erro ao compartilhar');
    }
    setTimeout(() => setShareStatus(''), 3000);
  }

  async function handleDownload() {
    if (!canvasRef.current || !match) return;
    await downloadCard(canvasRef.current, filename);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-neutral-500 flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          Carregando...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ImageIcon size={24} className="text-red-500" />
          Cards de Partidas
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          Gere cards para compartilhamento em redes sociais
        </p>
      </div>

      <div className="card p-4 md:p-5 space-y-4">
        <div>
          <label className="label">Temporada</label>
          <select
            className="input"
            value={seasonId}
            onChange={e => setSeasonId(e.target.value)}
          >
            {seasons.map(s => (
              <option key={s.id} value={s.id}>{s.nome} ({s.ano})</option>
            ))}
          </select>
        </div>

        {matches.length > 0 && (
          <div className="grid md:grid-cols-2 gap-4">
            <MatchSelector
              title="Próximos Jogos"
              matches={upcoming}
              selectedId={selectedMatchId}
              onSelect={setSelectedMatchId}
            />
            <MatchSelector
              title="Jogos Realizados"
              matches={completed}
              selectedId={selectedMatchId}
              onSelect={setSelectedMatchId}
            />
          </div>
        )}

        {matches.length === 0 && (
          <p className="text-neutral-500 text-sm text-center py-8">
            Nenhuma partida encontrada nesta temporada.
          </p>
        )}
      </div>

      {match && (
        <div className="card p-4 md:p-6">
          <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
            <div className="flex justify-center">
              <div className="relative">
                <canvas
                  ref={canvasRef}
                  className="w-full max-w-[450px] h-auto rounded-2xl border border-neutral-800 shadow-2xl shadow-black/40"
                  style={{ aspectRatio: '4 / 5' }}
                />
                {rendering && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/60 rounded-2xl">
                    <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-center lg:text-left">
                <p className="text-xs text-neutral-500 uppercase tracking-wide font-semibold mb-1">
                  Prévia do Card
                </p>
                <p className="text-white font-bold">
                  {match.status === 'completed' ? 'Jogo Realizado' : 'Próximo Jogo'}
                </p>
                <p className="text-neutral-400 text-sm">
                  {match.adversario} — {new Date(match.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={handleShare}
                  disabled={rendering}
                  className="btn-primary w-full"
                >
                  <Share2 size={18} />
                  {shareStatus || 'Compartilhar'}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={rendering}
                  className="btn-secondary w-full"
                >
                  <Download size={18} />
                  Baixar imagem
                </button>
              </div>

              <div className="pt-2 text-center lg:text-left">
                <p className="text-xs text-neutral-600">
                  Formato 1080×1350 px (4:5)
                </p>
                <p className="text-xs text-neutral-600">
                  Otimizado para Instagram, WhatsApp e Facebook
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchSelector({
  title,
  matches,
  selectedId,
  onSelect,
}: {
  title: string;
  matches: Match[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-neutral-800/50 rounded-xl border border-neutral-700/50 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-semibold text-white flex items-center gap-2">
          <Calendar size={16} className="text-red-500" />
          {title}
          <span className="text-neutral-500 text-xs">({matches.length})</span>
        </span>
        <ChevronDown
          size={18}
          className={cn('text-neutral-400 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && (
        <div className="max-h-64 overflow-y-auto scrollbar-thin">
          {matches.length === 0 ? (
            <p className="text-neutral-600 text-xs text-center py-6">
              Nenhum jogo nesta categoria
            </p>
          ) : (
            <div className="space-y-1 px-2 pb-2">
              {matches.map(m => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m.id)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors text-left',
                    selectedId === m.id
                      ? 'bg-red-600 text-white'
                      : 'text-neutral-300 hover:bg-neutral-700/50',
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    {selectedId === m.id && <Check size={14} className="shrink-0" />}
                    <span className="truncate">{m.adversario}</span>
                  </span>
                  <span className="text-xs opacity-70 shrink-0 ml-2">
                    {new Date(m.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    {m.status === 'completed' && ` ${m.gols_alif ?? 0}×${m.gols_adversario ?? 0}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
