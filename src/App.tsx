import { useEffect } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RouterProvider, useRouter, matchRoute } from '@/contexts/RouterContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FullPageLoading } from '@/components/States';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { ChangePasswordScreen } from '@/screens/auth/ChangePasswordScreen';
import { PublicLayout } from '@/components/PublicLayout';
import { PublicDashboard } from '@/screens/public/PublicDashboard';
import { PublicMatches } from '@/screens/public/PublicMatches';
import { PublicSquad } from '@/screens/public/PublicSquad';
import { PublicStats } from '@/screens/public/PublicStats';
import { PublicMatchDetail } from '@/screens/public/PublicMatchDetail';
import { PublicSponsors } from '@/components/Sponsors';
import { PublicOpponentDetail } from '@/screens/public/PublicOpponentDetail';
import { PublicCompetitionDetail } from '@/screens/public/PublicCompetitionDetail';
import { PlayerProfileDetail } from '@/screens/public/PlayerProfileDetail';
import { PlayerLayout } from '@/screens/player/PlayerLayout';
import { PlayerDashboard } from '@/screens/player/PlayerDashboard';
import { PlayerMatches } from '@/screens/player/PlayerMatches';
import { PlayerFees } from '@/screens/player/PlayerFees';
import { PlayerProfile } from '@/screens/player/PlayerProfile';
import { PlayerStats } from '@/screens/player/PlayerStats';
import { PlayerAwards } from '@/screens/player/PlayerAwards';
import { PlayerMatchDetail } from '@/screens/player/PlayerMatchDetail';
import { PublicSquad as PlayerSquad } from '@/screens/public/PublicSquad';
import { AdminLayout } from '@/screens/admin/AdminLayout';
import { AdminDashboard } from '@/screens/admin/AdminDashboard';
import { AdminMatches } from '@/screens/admin/AdminMatches';
import { AdminPlayers } from '@/screens/admin/AdminPlayers';
import { AdminStats } from '@/screens/admin/AdminStats';
import { AdminFees } from '@/screens/admin/AdminFees';
import { AdminFinance } from '@/screens/admin/AdminFinance';
import { AdminSeasons } from '@/screens/admin/AdminSeasons';
import { AdminSponsors } from '@/screens/admin/AdminSponsors';
import { AdminOpponents } from '@/screens/admin/AdminOpponents';
import { AdminCompetitions } from '@/screens/admin/AdminCompetitions';
import { AdminMatchDetail } from '@/screens/admin/AdminMatchDetail';
import { AdminMatchCards } from '@/screens/admin/AdminMatchCards';

function Routes() {
  const { path, navigate } = useRouter();
  const { user, profile, role, loading } = useAuth();

  const basePath = path.split('?')[0];
  const searchParams = new URLSearchParams(path.split('?')[1] || '');
  const matchParam = searchParams.get('match');

  let redirectTo: string | null = null;
  if (!loading) {
    if (basePath === '/entrar' && user && profile) {
      if (matchParam && role !== 'admin') {
        redirectTo = `/jogador/jogos/${matchParam}`;
      } else {
        redirectTo = role === 'admin' ? '/admin' : '/jogador';
      }
    } else if (basePath.startsWith('/admin') && (!user || role !== 'admin')) {
      redirectTo = '/entrar';
    } else if ((basePath.startsWith('/jogador/') || basePath === '/jogador') && (!user || !profile)) {
      redirectTo = '/entrar';
    }
  }

  useEffect(() => {
    if (redirectTo) navigate(redirectTo);
  }, [redirectTo, navigate]);

  if (loading || redirectTo) return <FullPageLoading />;

  if (basePath === '/entrar') return <LoginScreen />;

  if (user && profile?.must_change_password) return <ChangePasswordScreen />;

  if (basePath.startsWith('/admin')) {
    return (
      <AdminLayout>
        <AdminRoutes path={basePath} />
      </AdminLayout>
    );
  }

  if (basePath.startsWith('/jogador/') || basePath === '/jogador') {
    return (
      <PlayerLayout>
        <PlayerRoutes path={basePath} />
      </PlayerLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicRoutes path={basePath} />
    </PublicLayout>
  );
}

function PublicRoutes({ path }: { path: string }) {
  const matchId = matchRoute(path, '/jogos/:id');
  const playerId = matchRoute(path, '/jogadores/:id');
  const opponentId = matchRoute(path, '/adversario/:id');
  const competitionId = matchRoute(path, '/competicao/:id');
  if (matchId) return <PublicMatchDetail matchId={matchId} />;
  if (playerId) return <PlayerProfileDetail playerId={playerId} />;
  if (opponentId) return <PublicOpponentDetail opponentId={opponentId} />;
  if (competitionId) return <PublicCompetitionDetail competitionId={competitionId} />;
  if (path === '/' || path === '') return <PublicDashboard />;
  if (path === '/jogos') return <PublicMatches />;
  if (path === '/elenco') return <PublicSquad />;
  if (path === '/estatisticas') return <PublicStats />;
  if (path === '/patrocinadores') return <PublicSponsors />;
  return <PublicDashboard />;
}

function PlayerRoutes({ path }: { path: string }) {
  const matchId = matchRoute(path, '/jogador/jogos/:id');
  const playerId = matchRoute(path, '/jogadores/:id');
  if (matchId) return <PlayerMatchDetail matchId={matchId} />;
  if (playerId) return <PlayerProfileDetail playerId={playerId} />;
  if (path === '/jogador') return <PlayerDashboard />;
  if (path === '/jogador/jogos') return <PlayerMatches />;
  if (path === '/jogador/elenco') return <PlayerSquad />;
  if (path === '/jogador/estatisticas') return <PlayerStats />;
  if (path === '/jogador/mensalidades') return <PlayerFees />;
  if (path === '/jogador/perfil') return <PlayerProfile />;
  if (path === '/jogador/premiacoes') return <PlayerAwards />;
  if (path === '/jogador/cards') return <AdminMatchCards />;
  return <PlayerDashboard />;
}

function AdminRoutes({ path }: { path: string }) {
  const matchId = matchRoute(path, '/admin/jogos/:id');
  const playerId = matchRoute(path, '/admin/jogadores/:id');
  if (matchId) return <AdminMatchDetail matchId={matchId} />;
  if (playerId) return <PlayerProfileDetail playerId={playerId} />;
  if (path === '/admin') return <AdminDashboard />;
  if (path === '/admin/jogos') return <AdminMatches />;
  if (path === '/admin/jogadores') return <AdminPlayers />;
  if (path === '/admin/estatisticas') return <AdminStats />;
  if (path === '/admin/mensalidades') return <AdminFees />;
  if (path === '/admin/financeiro') return <AdminFinance />;
  if (path === '/admin/temporadas') return <AdminSeasons />;
  if (path === '/admin/patrocinadores') return <AdminSponsors />;
  if (path === '/admin/adversarios') return <AdminOpponents />;
  if (path === '/admin/competicoes') return <AdminCompetitions />;
  if (path === '/admin/cards') return <AdminMatchCards />;
  return <AdminDashboard />;
}

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <AuthProvider>
          <ToastProvider>
            <ErrorBoundary>
              <Routes />
            </ErrorBoundary>
          </ToastProvider>
        </AuthProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}
