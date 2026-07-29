import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { Crest } from '@/components/Crest';
import { cn } from '@/lib/utils';
import { LogOut, Menu, X, Trophy, Wallet, User as UserIcon, LayoutDashboard, Calendar, Users, BarChart3 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

const playerNav = [
  { label: 'Dashboard', path: '/jogador', icon: LayoutDashboard },
  { label: 'Jogos', path: '/jogador/jogos', icon: Calendar },
  { label: 'Elenco', path: '/jogador/elenco', icon: Users },
  { label: 'Estatísticas', path: '/jogador/estatisticas', icon: BarChart3 },
  { label: 'Mensalidades', path: '/jogador/mensalidades', icon: Wallet },
  { label: 'Meu Perfil', path: '/jogador/perfil', icon: UserIcon },
  { label: 'Premiações', path: '/jogador/premiacoes', icon: Trophy },
];

export function PlayerLayout({ children }: { children: React.ReactNode }) {
  const { path, navigate } = useRouter();
  const { profile, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  const go = (p: string) => {
    navigate(p);
    setOpen(false);
  };

  const isActive = (p: string) => path === p || (p !== '/jogador' && path.startsWith(p));
  const isExactActive = (p: string) => path === p;

  const SidebarContent = () => (
    <>
      <button onClick={() => go('/jogador')} className="flex items-center gap-2.5 px-3 py-2 mb-4 w-full">
        <Crest size={36} />
        <div className="text-left">
          <p className="font-bold text-white leading-none tracking-tight text-sm">AL-IF FC</p>
          <p className="text-[10px] text-neutral-500 leading-none mt-0.5">Área do Jogador</p>
        </div>
      </button>
      <nav className="space-y-0.5 flex-1">
        {playerNav.map(item => {
          const Icon = item.icon;
          const active = item.path === '/jogador' ? isExactActive(item.path) : isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => go(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
              )}
            >
              <Icon size={18} /> {item.label}
            </button>
          );
        })}
      </nav>
      <div className="pt-4 border-t border-neutral-800 mt-4">
        <ThemeToggle className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors mb-2" />
        <div className="px-3 py-2 mb-2">
          <p className="text-white text-sm font-medium truncate">{profile?.apelido || profile?.nome}</p>
          <p className="text-neutral-500 text-xs truncate">{profile?.posicao || 'Jogador'}</p>
        </div>
        <button
          onClick={() => { signOut(); navigate('/'); }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
        >
          <LogOut size={18} /> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-neutral-950 flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-neutral-800 bg-neutral-900 p-3 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-neutral-900 border-r border-neutral-800 p-3 flex flex-col animate-slide-in">
            <button onClick={() => setOpen(false)} className="absolute top-3 right-3 text-neutral-400 hover:text-white">
              <X size={20} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 bg-neutral-950/90 backdrop-blur-md border-b border-neutral-800 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setOpen(true)} className="text-neutral-300 p-2 -ml-2">
            <Menu size={22} />
          </button>
          <button onClick={() => go('/jogador')} className="flex items-center gap-2">
            <Crest size={28} />
            <span className="font-bold text-white text-sm">AL-IF FC</span>
          </button>
          <ThemeToggle />
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden sticky bottom-0 z-30 bg-neutral-950 border-t border-neutral-800 grid grid-cols-5">
          {playerNav.slice(0, 5).map(item => {
            const Icon = item.icon;
            const active = item.path === '/jogador' ? isExactActive(item.path) : isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                className={cn(
                  'flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium transition-colors',
                  active ? 'text-red-500' : 'text-neutral-500',
                )}
              >
                <Icon size={20} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
