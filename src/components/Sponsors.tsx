import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase, Sponsor } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { Globe, Instagram, ArrowRight, ChevronLeft, ChevronRight, Handshake } from 'lucide-react';

const SLIDE_INTERVAL = 5000;

export function SponsorCarousel() {
  const { navigate } = useRouter();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
      setSponsors((data || []) as Sponsor[]);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  const next = useCallback(() => {
    setCurrent(c => (c + 1) % sponsors.length);
  }, [sponsors.length]);

  const prev = useCallback(() => {
    setCurrent(c => (c - 1 + sponsors.length) % sponsors.length);
  }, [sponsors.length]);

  useEffect(() => {
    if (sponsors.length <= 1 || paused) return;
    const timer = setInterval(next, SLIDE_INTERVAL);
    return () => clearInterval(timer);
  }, [sponsors.length, paused, next]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) prev();
      else next();
    }
    touchStartX.current = null;
  }

  if (loading || sponsors.length === 0) return null;

  const sponsor = sponsors[current];
  const link = sponsor.website_url || sponsor.instagram_url;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-neutral-800 bg-gradient-to-br from-neutral-900 via-neutral-900 to-red-950/20"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Slides */}
      <div className="relative min-h-[140px] sm:min-h-[160px] flex items-center justify-center px-6 py-6">
        {sponsors.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 flex items-center justify-center px-6 transition-all duration-700 ease-in-out ${
              i === current
                ? 'opacity-100 scale-100 translate-x-0'
                : i === (current - 1 + sponsors.length) % sponsors.length
                ? 'opacity-0 scale-95 -translate-x-full'
                : 'opacity-0 scale-95 translate-x-full'
            }`}
          >
            <SlideContent sponsor={s} />
          </div>
        ))}
      </div>

      {/* Arrows (desktop) */}
      {sponsors.length > 1 && (
        <>
          <button
            onClick={prev}
            className="hidden sm:flex absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-neutral-800/80 backdrop-blur border border-neutral-700 items-center justify-center text-neutral-300 hover:bg-red-600 hover:text-white hover:border-red-500 transition-all z-10"
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={next}
            className="hidden sm:flex absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-neutral-800/80 backdrop-blur border border-neutral-700 items-center justify-center text-neutral-300 hover:bg-red-600 hover:text-white hover:border-red-500 transition-all z-10"
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </>
      )}

      {/* Dots */}
      {sponsors.length > 1 && (
        <div className="flex items-center justify-center gap-2 pb-4">
          {sponsors.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-6 bg-red-500'
                  : 'w-2 bg-neutral-700 hover:bg-neutral-600'
              }`}
              aria-label={`Patrocinador ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* "Ver todos" link */}
      <button
        onClick={() => navigate('/patrocinadores')}
        className="absolute top-4 right-4 text-neutral-500 hover:text-red-400 text-xs font-medium flex items-center gap-1 transition-colors z-10"
      >
        Ver todos <ArrowRight size={11} />
      </button>
    </div>
  );
}

function SlideContent({ sponsor }: { sponsor: Sponsor }) {
  const link = sponsor.website_url || sponsor.instagram_url;
  const hasLink = !!link;

  const content = (
    <div className="flex flex-col items-center gap-3 text-center">
      <p className="text-neutral-500 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
        <Handshake size={12} /> Patrocinador Oficial
      </p>
      <div className="h-14 sm:h-16 flex items-center justify-center">
        {sponsor.logo_url ? (
          <img
            src={sponsor.logo_url}
            alt={sponsor.name}
            className="max-h-full max-w-[180px] object-contain"
          />
        ) : (
          <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center text-neutral-500 font-bold text-2xl">
            {sponsor.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-white font-bold text-base sm:text-lg">{sponsor.name}</p>
      {(sponsor.website_url || sponsor.instagram_url) && (
        <div className="flex items-center gap-2">
          {sponsor.website_url && (
            <span className="text-neutral-500 text-xs flex items-center gap-1">
              <Globe size={12} /> Website
            </span>
          )}
          {sponsor.instagram_url && (
            <span className="text-neutral-500 text-xs flex items-center gap-1">
              <Instagram size={12} /> Instagram
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (hasLink) {
    return (
      <a
        href={link!}
        target="_blank"
        rel="noopener noreferrer"
        className="block transition-transform hover:scale-[1.02]"
      >
        {content}
      </a>
    );
  }
  return content;
}

export function PublicSponsors() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase
        .from('sponsors')
        .select('*')
        .eq('active', true)
        .order('display_order', { ascending: true });
      setSponsors((data || []) as Sponsor[]);
    } catch {
      setError('Não foi possível carregar os patrocinadores.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="py-12 text-center text-neutral-500">Carregando...</div>;
  if (error) return <div className="py-12 text-center text-red-400">{error}</div>;
  if (sponsors.length === 0)
    return <div className="py-12 text-center text-neutral-500">Nenhum patrocinador cadastrado.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-white">Patrocinadores Oficiais</h1>
        <p className="text-neutral-500 text-sm mt-1">Apoio que faz o AL-IF FC acontecer</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sponsors.map(s => (
          <SponsorFullCard key={s.id} sponsor={s} />
        ))}
      </div>
    </div>
  );
}

function SponsorFullCard({ sponsor }: { sponsor: Sponsor }) {
  return (
    <div className="card p-6 flex flex-col items-center gap-4 card-hover">
      <div className="w-24 h-24 flex items-center justify-center">
        {sponsor.logo_url ? (
          <img src={sponsor.logo_url} alt={sponsor.name} className="max-w-full max-h-full object-contain" />
        ) : (
          <div className="w-24 h-24 rounded-xl bg-neutral-800 flex items-center justify-center text-neutral-600 font-bold text-3xl">
            {sponsor.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
      <p className="text-white font-bold text-lg">{sponsor.name}</p>
      {sponsor.description && (
        <p className="text-neutral-400 text-sm text-center">{sponsor.description}</p>
      )}
      <div className="flex gap-2">
        {sponsor.website_url && (
          <a
            href={sponsor.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            <Globe size={14} /> Website
          </a>
        )}
        {sponsor.instagram_url && (
          <a
            href={sponsor.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs"
          >
            <Instagram size={14} /> Instagram
          </a>
        )}
      </div>
    </div>
  );
}
