import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from '@/contexts/RouterContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Crest } from '@/components/Crest';
import { Loader2, Lock, Eye, EyeOff, CheckCircle } from 'lucide-react';

export function ChangePasswordScreen() {
  const { user, signOut } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password: newPassword });
      if (updErr) throw updErr;

      if (user) {
        await supabase.from('profiles').update({
          must_change_password: false,
          temp_password: null,
          updated_at: new Date().toISOString(),
        }).eq('user_id', user.id);
      }

      showToast('Senha alterada com sucesso!', 'success');
      navigate('/');
    } catch {
      setError('Erro ao alterar senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Crest size={72} className="mb-4" />
          <h1 className="text-xl font-bold text-white">Primeiro Acesso</h1>
          <p className="text-neutral-500 text-sm mt-1 text-center">
            Por segurança, defina sua nova senha para continuar.
          </p>
        </div>

        <div className="card p-5 mb-4 flex items-start gap-3">
          <CheckCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-neutral-400 text-sm">
            Esta é a sua primeira vez no sistema. Cadastre uma senha definitiva antes de acessar as funcionalidades.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nova senha</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type={show ? 'text' : 'password'}
                className="input pl-10 pr-10"
                placeholder="Mínimo 6 caracteres"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>
          <div>
            <label className="label">Confirmar nova senha</label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
              <input
                type={show ? 'text' : 'password'}
                className="input pl-10"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading && <Loader2 size={18} className="animate-spin" />}
            Definir senha e continuar
          </button>
          <button
            type="button"
            onClick={() => signOut()}
            className="btn-ghost w-full"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
