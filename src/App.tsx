import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { RouterProvider, useRouter, matchRoute } from '@/contexts/RouterContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FullPageLoading } from '@/components/States';
import { LoginScreen } from '@/screens/auth/LoginScreen';
import { ChangePasswordScreen } from '@/screens/auth/ChangePasswordScreen';
import { PublicLayout } from '@/components/PublicLayout';
import { PublicDashboard } from '@/screens/public/PublicDashboard';
import { PublicMatches } from '@/screens/public/PublicMatches';
import { PublicSquad } from '@/screens/public/PublicSquad';
import { PublicStats } from '@/screens/public/PublicStats';
import { PublicMatchDetail } from '@/screens/public/PublicMatchDetail';
import { PublicSponsors } from '@/components/Sponsors';
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
import { AdminMatchDetail } from '@/screens/admin/AdminMatchDetail';

function Routes() {
  const { path, navigate } = useRouter();
  const { user, profile, role, loading } = useAuth();

  if (loading) return <FullPageLoading />;

  // Auth routes
  if (path === '/entrar') {
    if (user && profile) {
      navigate(role === 'admin' ? '/admin' : '/jogador');
      return <FullPageLoading />;
    }
    return <LoginScreen />;
  }

  // Force password change
  if (user && profile?.must_change_password) {
    return <ChangePasswordScreen />;
  }

  // Admin routes (protected)
  if (path.startsWith('/admin')) {
    if (!user || role !== 'admin') {
      navigate('/entrar');
      return <FullPageLoading />;
    }
    return (
      <AdminLayout>
        <AdminRoutes path={path} />
      </AdminLayout>
    );
  }

  // Player routes (protected)
  if (path.startsWith('/jogador')) {
    if (!user || !profile) {
      navigate('/entrar');
      return <FullPageLoading />;
    }
    return (
      <PlayerLayout>
        <PlayerRoutes path={path} />
      </PlayerLayout>
    );
  }

  // Public routes
  return (
    <PublicLayout>
      <PublicRoutes path={path} />
    </PublicLayout>
  );
}

function PublicRoutes({ path }: { path: string }) {
  const matchId = matchRoute(path, '/jogos/:id');
  if (matchId) return <PublicMatchDetail matchId={matchId} />;
  if (path === '/' || path === '') return <PublicDashboard />;
  if (path === '/jogos') return <PublicMatches />;
  if (path === '/elenco') return <PublicSquad />;
  if (path === '/estatisticas') return <PublicStats />;
  if (path === '/patrocinadores') return <PublicSponsors />;
  return <PublicDashboard />;
}

function PlayerRoutes({ path }: { path: string }) {
  const matchId = matchRoute(path, '/jogador/jogos/:id');
  if (matchId) return <PlayerMatchDetail matchId={matchId} />;
  if (path === '/jogador') return <PlayerDashboard />;
  if (path === '/jogador/jogos') return <PlayerMatches />;
  if (path === '/jogador/elenco') return <PlayerSquad />;
  if (path === '/jogador/estatisticas') return <PlayerStats />;
  if (path === '/jogador/mensalidades') return <PlayerFees />;
  if (path === '/jogador/perfil') return <PlayerProfile />;
  if (path === '/jogador/premiacoes') return <PlayerAwards />;
  return <PlayerDashboard />;
}

function AdminRoutes({ path }: { path: string }) {
  const matchId = matchRoute(path, '/admin/jogos/:id');
  if (matchId) return <AdminMatchDetail matchId={matchId} />;
  if (path === '/admin') return <AdminDashboard />;
  if (path === '/admin/jogos') return <AdminMatches />;
  if (path === '/admin/jogadores') return <AdminPlayers />;
  if (path === '/admin/estatisticas') return <AdminStats />;
  if (path === '/admin/mensalidades') return <AdminFees />;
  if (path === '/admin/financeiro') return <AdminFinance />;
  if (path === '/admin/temporadas') return <AdminSeasons />;
  if (path === '/admin/patrocinadores') return <AdminSponsors />;
  return <AdminDashboard />;
}

export default function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes />
          </ToastProvider>
        </AuthProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}
