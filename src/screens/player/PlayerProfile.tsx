import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Loading } from '@/components/States';
import { formatDate, POSITIONS } from '@/lib/utils';
import { Camera, Loader2, User } from 'lucide-react';

export function PlayerProfile() {
  const { profile, refreshProfile } = useAuth();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!profile) return <Loading />;

  async function handlePhoto(file: File) {
    if (!profile) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `profiles/${profile.id}/foto.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('fotos')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(path);
      const fotoUrl = urlData.publicUrl;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({ foto_url: fotoUrl, updated_at: new Date().toISOString() })
        .eq('id', profile.id);
      if (updErr) throw updErr;
      await refreshProfile();
      showToast('Foto atualizada!', 'success');
    } catch (e: any) {
      showToast('Erro ao enviar foto. Tente novamente.', 'error');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-2xl font-bold text-white">Meu Perfil</h1>

      <div className="card p-5">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-neutral-800 overflow-hidden border-2 border-red-600/50">
              {profile.foto_url ? (
                <img src={profile.foto_url} alt={profile.nome} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-neutral-600">
                  {(profile.apelido || profile.nome).charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) handlePhoto(f);
                e.target.value = '';
              }}
            />
          </div>
          <p className="text-neutral-500 text-xs text-center">Clique na câmera para alterar sua foto</p>
        </div>
      </div>

      <div className="card divide-y divide-neutral-800">
        <Field label="Nome completo" value={profile.nome} />
        <Field label="Apelido" value={profile.apelido || '-'} />
        <Field label="Número" value={profile.numero != null ? String(profile.numero) : '-'} />
        <Field label="Posição" value={profile.posicao || '-'} />
        <Field label="Telefone" value={profile.telefone || '-'} />
        <Field label="Data de nascimento" value={profile.data_nascimento ? formatDate(profile.data_nascimento) : '-'} />
        <Field label="Data de entrada" value={profile.data_entrada ? formatDate(profile.data_entrada) : '-'} />
        <Field label="Status" value={profile.status === 'active' ? 'Ativo' : 'Inativo'} />
      </div>

      <div className="card p-4">
        <p className="text-xs text-neutral-500 mb-1">Observações</p>
        <p className="text-neutral-300 text-sm">{profile.observacoes || 'Nenhuma observação.'}</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <span className="text-neutral-500 text-sm">{label}</span>
      <span className="text-white text-sm font-medium text-right truncate">{value}</span>
    </div>
  );
}
