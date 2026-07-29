import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { normalizePhone } from '@/lib/utils';
import { Crest } from '@/components/Crest';
import { Loader2, Lock, Phone, Mail, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export function LoginScreen() {
  const { navigate } = useRouter();
  const { refreshProfile } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<'choose' | 'player' | 'admin'>('choose');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handlePlayerLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const normalized = normalizePhone(phone);
    if (normalized.length < 10) {
      setError('Telefone inválido');
      return;
    }
    setLoading(true);
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('auth_email')
        .eq('telefone_normalizado', normalized)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile || !profile.auth_email) {
        setError('Telefone não encontrado. Contate o administrador.');
        setLoading(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profile.auth_email,
        password,
      });
      if (signInError) {
        setError('Senha incorreta.');
        setLoading(false);
        return;
      }
      await refreshProfile();
      const params = new URLSearchParams(window.location.search);
      const matchId = params.get('match');
      navigate(matchId ? `/jogador/jogos/${matchId}` : '/jogador');
      showToast('Login realizado com sucesso!', 'success');
    } catch {
      setError('Erro ao fazer login. Tente novamente.');
      setLoading(false);
    }
  }

  async function handleAdminLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setError('E-mail ou senha incorretos.');
      setLoading(false);
      return;
    }
    await refreshProfile();
    navigate('/admin');
    showToast('Bem-vindo, Admin!', 'success');
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col">
      <div className="absolute top-4 left-4">
        <button onClick={() => navigate('/')} className="btn-ghost">
          <ArrowLeft size={18} /> Voltar ao site
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <Crest size={80} className="mb-4 shadow-2xl" />
            <h1 className="text-2xl font-bold text-white tracking-tight">AL-IF FC</h1>
            <p className="text-neutral-500 text-sm mt-1">Sistema de Gestão</p>
          </div>

          {mode === 'choose' && (
            <div className="space-y-3 animate-fade-in">
              <button
                onClick={() => setMode('player')}
                className="w-full p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-red-600 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-red-600/20 flex items-center justify-center">
                    <Phone size={22} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Jogador</p>
                    <p className="text-neutral-500 text-sm">Entrar com telefone e senha</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => setMode('admin')}
                className="w-full p-5 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-red-600 transition-all text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-neutral-700 flex items-center justify-center">
                    <Mail size={22} className="text-neutral-300" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Admin / Diretoria</p>
                    <p className="text-neutral-500 text-sm">Entrar com e-mail e senha</p>
                  </div>
                </div>
              </button>
            </div>
          )}

          {mode === 'player' && (
            <form onSubmit={handlePlayerLogin} className="space-y-4 animate-fade-in">
              <div>
                <label className="label">Telefone</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    className="input pl-10"
                    placeholder="(67) 99999-9999"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    inputMode="tel"
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading && <Loader2 size={18} className="animate-spin" />}
                Entrar
              </button>
              <button type="button" onClick={() => setMode('choose')} className="btn-ghost w-full">
                Voltar
              </button>
            </form>
          )}

          {mode === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4 animate-fade-in">
              <div>
                <label className="label">E-mail</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="admin@alif-fc.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <div>
                <label className="label">Senha</label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" className="btn-primary w-full" disabled={loading}>
                {loading && <Loader2 size={18} className="animate-spin" />}
                Entrar
              </button>
              <button type="button" onClick={() => setMode('choose')} className="btn-ghost w-full">
                Voltar
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
