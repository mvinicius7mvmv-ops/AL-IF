import { useState } from 'react';
import { useRouter } from '@/contexts/RouterContext';
import { useAuth } from '@/contexts/AuthContext';
import { Crest } from '@/components/Crest';
import { cn } from '@/lib/utils';
import { Menu, X, LogIn, LogOut, User } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const publicNav = [
  { label: 'Dashboard', path: '/' },
  { label: 'Jogos', path: '/jogos' },
  { label: 'Elenco', path: '/elenco' },
  { label: 'Estatísticas', path: '/estatisticas' },
  { label: 'Patrocinadores', path: '/patrocinadores' },
];

export function PublicHeader() {
  const { path, navigate } = useRouter();
  const { user, profile, role, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const go = (p: string) => {
    navigate(p);
    setMenuOpen(false);
  };

  const isActive = (p: string) => path === p || (p !== '/' && path.startsWith(p));

  return (
    <header className="sticky top-0 z-40 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => go('/')} className="flex items-center gap-2.5 shrink-0">
            <Crest size={36} />
            <div className="text-left">
              <p className="font-bold text-white leading-none tracking-tight">AL-IF FC</p>
              <p className="text-[10px] text-neutral-500 leading-none mt-0.5">Futebol Amador</p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1">
            {publicNav.map(item => (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={cn(
                  'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.path)
                    ? 'text-white bg-neutral-800'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-900',
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <button
                  onClick={() => go(role === 'admin' ? '/admin' : '/jogador')}
                  className="btn-ghost"
                >
                  <User size={16} /> {profile?.apelido || profile?.nome?.split(' ')[0] || 'Minha conta'}
                </button>
                <button onClick={() => { signOut(); navigate('/'); }} className="btn-ghost">
                  <LogOut size={16} /> Sair
                </button>
              </>
            ) : (
              <button onClick={() => go('/entrar')} className="btn-primary">
                <LogIn size={16} /> Entrar
              </button>
            )}
          </div>

          <button
            className="md:hidden text-neutral-300 p-2 -mr-2"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-neutral-800 bg-neutral-950 animate-fade-in">
          <nav className="px-4 py-3 space-y-1">
            {publicNav.map(item => (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive(item.path) ? 'text-white bg-neutral-800' : 'text-neutral-400 hover:bg-neutral-900',
                )}
              >
                {item.label}
              </button>
            ))}
            <div className="pt-2 mt-2 border-t border-neutral-800 flex items-center gap-2">
              <ThemeToggle className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-900" />
              {user ? (
                <>
                  <button onClick={() => go(role === 'admin' ? '/admin' : '/jogador')} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-900 flex items-center gap-2">
                    <User size={16} /> Minha conta
                  </button>
                  <button onClick={() => { signOut(); go('/'); }} className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-300 hover:bg-neutral-900 flex items-center gap-2">
                    <LogOut size={16} /> Sair
                  </button>
                </>
              ) : (
                <button onClick={() => go('/entrar')} className="btn-primary w-full mt-1">
                  <LogIn size={16} /> Entrar
                </button>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      <PublicHeader />
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 md:py-8">
        {children}
      </main>
      <footer className="border-t border-neutral-900 py-6 px-4 text-center text-neutral-600 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-2">
          <Crest size={28} />
          <p>AL-IF FC &middot; Futebol Amador &middot; {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
