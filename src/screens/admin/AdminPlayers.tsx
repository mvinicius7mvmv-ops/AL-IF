import { useEffect, useState, useRef } from 'react';
import { supabase, Profile } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { normalizePhone, formatPhone, POSITIONS, cn } from '@/lib/utils';
import { Plus, Users, Search, Edit2, Trash2, Camera, Loader2, Copy, Check, Power, KeyRound } from 'lucide-react';

const empty = {
  nome: '', apelido: '', numero: '', posicao: '', telefone: '',
  data_entrada: '', data_nascimento: '', observacoes: '', status: 'active' as 'active' | 'inactive',
};

export function AdminPlayers() {
  const { showToast } = useToast();
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [saving, setSaving] = useState(false);
  const [generatedCreds, setGeneratedCreds] = useState<{ telefone: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null);
  const [resetTarget, setResetTarget] = useState<Profile | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetCreds, setResetCreds] = useState<{ nome: string; password: string; telefone: string } | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await supabase
        .from('profiles')
        .select('*')
        .order('nome', { ascending: true });
      if (e) throw e;
      setPlayers(data || []);
    } catch {
      setError('Não foi possível carregar os jogadores.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Open "new" modal via query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('novo') === '1') openNew();
  }, []);

  function openNew() {
    setEditing(null);
    setForm({ ...empty });
    setPhotoFile(null);
    setPhotoPreview(null);
    setGeneratedCreds(null);
    setModalOpen(true);
  }

  function openEdit(p: Profile) {
    setEditing(p);
    setForm({
      nome: p.nome, apelido: p.apelido || '', numero: p.numero != null ? String(p.numero) : '',
      posicao: p.posicao || '', telefone: p.telefone || '',
      data_entrada: p.data_entrada || '', data_nascimento: p.data_nascimento || '',
      observacoes: p.observacoes || '', status: p.status,
    });
    setPhotoFile(null);
    setPhotoPreview(p.foto_url);
    setGeneratedCreds(null);
    setModalOpen(true);
  }

  function handlePhoto(file: File) {
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = e => setPhotoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadPhoto(playerId: string): Promise<string | null> {
    if (!photoFile) return photoPreview;
    const ext = photoFile.name.split('.').pop();
    const path = `profiles/${playerId}/foto.${ext}`;
    const { error } = await supabase.storage.from('fotos').upload(path, photoFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from('fotos').getPublicUrl(path);
    return data.publicUrl;
  }

  async function handleSave() {
    if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
    const normalized = form.telefone ? normalizePhone(form.telefone) : '';
    if (form.telefone && normalized.length < 10) { showToast('Telefone inválido', 'error'); return; }

    setSaving(true);
    try {
      if (editing) {
        const fotoUrl = await uploadPhoto(editing.id);
        const { error } = await supabase.from('profiles').update({
          nome: form.nome.trim(),
          apelido: form.apelido.trim() || null,
          numero: form.numero ? Number(form.numero) : null,
          posicao: form.posicao || null,
          telefone: form.telefone || null,
          telefone_normalizado: normalized || null,
          data_entrada: form.data_entrada || null,
          data_nascimento: form.data_nascimento || null,
          observacoes: form.observacoes || null,
          status: form.status,
          foto_url: fotoUrl,
          updated_at: new Date().toISOString(),
        }).eq('id', editing.id);
        if (error) throw error;
        showToast('Jogador atualizado!', 'success');
      } else {
        // Use edge function to create player (requires service role for auth.admin.createUser)
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-player`;
        const sessionRes = await supabase.auth.getSession();
        const resp = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${sessionRes.data.session?.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            nome: form.nome.trim(),
            apelido: form.apelido.trim() || null,
            numero: form.numero ? Number(form.numero) : null,
            posicao: form.posicao || null,
            telefone: form.telefone || null,
            telefone_normalizado: normalized || null,
            data_entrada: form.data_entrada || null,
            data_nascimento: form.data_nascimento || null,
            observacoes: form.observacoes || null,
          }),
        });
        const result = await resp.json();
        if (!resp.ok) {
          throw new Error(result.error || 'Erro ao criar jogador');
        }

        // Upload photo if provided
        if (photoFile && result.profile?.id) {
          const url = await uploadPhoto(result.profile.id);
          if (url) {
            await supabase.from('profiles').update({ foto_url: url }).eq('id', result.profile.id);
          }
        }

        setGeneratedCreds({ telefone: result.credentials.telefone, password: result.credentials.password });
        showToast('Jogador criado!', 'success');
      }
      await load();
      if (!editing) {
        // keep modal open to show credentials
      } else {
        setModalOpen(false);
      }
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar jogador', 'error');
    } finally {
      setSaving(false);
    }
  }

    function copyResetCreds() {
    if (!resetCreds) return;

    const text = `AL-IF FC - Acesso ao sistema
Jogador: ${resetCreds.nome}
Telefone: ${resetCreds.telefone}
Nova senha temporária: ${resetCreds.password}
Link: ${window.location.origin}/entrar`;

    navigator.clipboard.writeText(text);

    setResetCopied(true);

    setTimeout(() => {
      setResetCopied(false);
    }, 2000);
  }
  
    async function handleResetPassword() {
    if (!resetTarget) return;

    setResettingPassword(true);

    try {
      const apiUrl =
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-player`;

      const sessionRes =
        await supabase.auth.getSession();

      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization':
            `Bearer ${sessionRes.data.session?.access_token}`,
          'apikey':
            import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'reset_password',
          user_id: resetTarget.user_id,
        }),
      });

      const result = await resp.json();

      if (!resp.ok) {
        throw new Error(
          result.error ||
          'Erro ao redefinir senha'
        );
      }

      setResetTarget(null);

      setResetCreds({
        nome:
          result.player?.nome ||
          resetTarget.nome,

        password:
          result.credentials.password,

        telefone:
          resetTarget.telefone ||
          resetTarget.telefone_normalizado ||
          '',
      });

      showToast(
        'Senha redefinida com sucesso!',
        'success'
      );

    } catch (e: any) {
      showToast(
        e.message ||
        'Erro ao redefinir senha',
        'error'
      );
    } finally {
      setResettingPassword(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-player`;
      const sessionRes = await supabase.auth.getSession();
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionRes.data.session?.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ profileId: deleteTarget.id, userId: deleteTarget.user_id }),
      });
      if (!resp.ok) {
        const r = await resp.json();
        throw new Error(r.error || 'Erro ao excluir');
      }
      showToast('Jogador excluído', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao excluir jogador', 'error');
    }
  }

  function copyCreds() {
    if (!generatedCreds) return;
    const text = `AL-IF FC - Acesso ao sistema\nTelefone: ${generatedCreds.telefone}\nSenha inicial: ${generatedCreds.password}\nLink: ${window.location.origin}/entrar`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const filtered = players.filter(p =>
    p.nome.toLowerCase().includes(search.toLowerCase()) ||
    p.apelido?.toLowerCase().includes(search.toLowerCase()) ||
    p.telefone?.includes(search),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Jogadores</h1>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Novo Jogador
        </button>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input
          className="input pl-10"
          placeholder="Buscar por nome, apelido ou telefone..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users size={48} />} title="Nenhum jogador" description="Clique em 'Novo Jogador' para começar." />
      ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(p => (
            <div
              key={p.id}
              className={cn(
                'card p-4',
                p.status === 'inactive' && 'opacity-60'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-neutral-800 overflow-hidden shrink-0">
                  {p.foto_url ? (
                    <img
                      src={p.foto_url}
                      alt={p.nome}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold">
                      {(p.apelido || p.nome).charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">
                    {p.apelido || p.nome}
                  </p>

                  <p className="text-neutral-500 text-xs truncate">
                    {p.nome}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {p.numero != null && (
                      <span className="badge bg-red-600/15 text-red-400 border border-red-800/40">
                        #{p.numero}
                      </span>
                    )}

                    {p.posicao && (
                      <span className="text-neutral-500 text-xs">
                        {p.posicao}
                      </span>
                    )}

                    {p.status === 'inactive' && (
                      <span className="badge bg-neutral-800 text-neutral-400">
                        Inativo
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex gap-1.5 mt-3 pt-3 border-t border-neutral-800">
                <button
                  onClick={() => openEdit(p)}
                  className="btn-ghost flex-1 text-xs"
                >
                  <Edit2 size={14} />
                  Editar
                </button>

                <button
                  onClick={() => setResetTarget(p)}
                  className="btn-ghost text-xs"
                  title="Redefinir senha"
                >
                  <KeyRound size={14} />
                </button>

                <button
                  onClick={() => handleToggleStatus(p)}
                  className="btn-ghost text-xs"
                  title={p.status === 'active' ? 'Desativar' : 'Ativar'}
                >
                  <Power size={14} />
                </button>

                <button
                  onClick={() => setDeleteTarget(p)}
                  className="btn-ghost text-xs text-red-400 hover:bg-red-900/20"
                  title="Excluir jogador"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
                

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? 'Editar Jogador' : 'Novo Jogador'}
        size="lg"
        footer={
          !generatedCreds ? (
            <div className="flex gap-3">
              <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>
                Cancelar
              </button>
              <button onClick={handleSave} className="btn-primary flex-1" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                {editing ? 'Salvar alterações' : 'Criar jogador'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3">
              <button onClick={() => { setModalOpen(false); setGeneratedCreds(null); }} className="btn-secondary flex-1">
                Fechar
              </button>
              <button onClick={copyCreds} className="btn-primary flex-1">
                {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copiado!' : 'Copiar credenciais'}
              </button>
            </div>
          )
        }
      >
        {generatedCreds ? (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/50">
              <p className="text-green-400 font-semibold text-sm mb-2">Jogador criado com sucesso!</p>
              <p className="text-neutral-300 text-sm">Envie as credenciais abaixo ao jogador via WhatsApp para o primeiro acesso.</p>
            </div>
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-neutral-800">
                <p className="text-neutral-500 text-xs">Telefone (login)</p>
                <p className="text-white text-sm font-mono">{generatedCreds.telefone}</p>
              </div>
              <div className="p-3 rounded-lg bg-neutral-800">
                <p className="text-neutral-500 text-xs">Senha inicial</p>
                <p className="text-white text-sm font-mono">{generatedCreds.password}</p>
              </div>
              <div className="p-3 rounded-lg bg-neutral-800">
                <p className="text-neutral-500 text-xs">Link de acesso</p>
                <p className="text-white text-sm font-mono">{window.location.origin}/entrar</p>
              </div>
            </div>
            <p className="text-neutral-500 text-xs">A senha inicial são os últimos 4 dígitos do telefone. O jogador será obrigado a trocar a senha no primeiro acesso.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Photo */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-neutral-800 overflow-hidden border-2 border-neutral-700">
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-neutral-600">
                      <Users size={28} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg"
                >
                  <Camera size={14} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value = ''; }} />
              </div>
              <p className="text-neutral-500 text-xs">Foto do jogador</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Nome completo *</label>
                <input className="input" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label">Apelido</label>
                <input className="input" value={form.apelido} onChange={e => setForm(f => ({ ...f, apelido: e.target.value }))} />
              </div>
              <div>
                <label className="label">Número</label>
                <input className="input" type="number" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <label className="label">Posição</label>
                <select className="input" value={form.posicao} onChange={e => setForm(f => ({ ...f, posicao: e.target.value }))}>
                  <option value="">Selecione</option>
                  {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Telefone *</label>
                <input className="input" placeholder="(67) 99999-9999" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Status</label>
                <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
              <div>
                <label className="label">Data de nascimento</label>
                <input className="input" type="date" value={form.data_nascimento} onChange={e => setForm(f => ({ ...f, data_nascimento: e.target.value }))} />
              </div>
              <div>
                <label className="label">Data de entrada</label>
                <input className="input" type="date" value={form.data_entrada} onChange={e => setForm(f => ({ ...f, data_entrada: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="label">Observações (interno)</label>
              <textarea className="input min-h-[80px]" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
            </div>
          </div>
        )}
      </Modal>
      <ConfirmModal
  open={!!resetTarget}
  title="Redefinir senha"
  message={`Tem certeza que deseja redefinir a senha de ${resetTarget?.nome}? Uma nova senha temporária será criada e o jogador deverá definir uma nova senha no próximo acesso.`}
  confirmLabel={resettingPassword ? 'Redefinindo...' : 'Redefinir senha'}
  onConfirm={handleResetPassword}
  onClose={() => {
    if (!resettingPassword) setResetTarget(null);
  }}
/>
      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir jogador"
        message={`Tem certeza que deseja excluir ${deleteTarget?.nome}? Esta ação removerá o jogador e sua conta de acesso. Não pode ser desfeito.`}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
      <Modal
  open={!!resetCreds}
  onClose={() => {
    if (!resettingPassword) {
      setResetCreds(null);
      setResetCopied(false);
    }
  }}
  title="Senha redefinida"
  size="md"
  footer={
    <div className="flex gap-3">
      <button
        onClick={() => {
          setResetCreds(null);
          setResetCopied(false);
        }}
        className="btn-secondary flex-1"
      >
        Fechar
      </button>

      <button
        onClick={copyResetCreds}
        className="btn-primary flex-1"
      >
        {resetCopied ? <Check size={16} /> : <Copy size={16} />}
        {resetCopied ? 'Copiado!' : 'Copiar acesso'}
      </button>
    </div>
  }
>
  {resetCreds && (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-green-900/20 border border-green-800/50">
        <p className="text-green-400 font-semibold text-sm">
          Senha redefinida com sucesso!
        </p>
        <p className="text-neutral-400 text-xs mt-1">
          Envie os dados abaixo ao jogador.
        </p>
      </div>

      <div className="space-y-2">
        <div className="p-3 rounded-lg bg-neutral-800">
          <p className="text-neutral-500 text-xs">Jogador</p>
          <p className="text-white text-sm font-semibold">
            {resetCreds.nome}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-neutral-800">
          <p className="text-neutral-500 text-xs">Telefone</p>
          <p className="text-white text-sm font-mono">
            {resetCreds.telefone}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-neutral-800 border border-red-600/30">
          <p className="text-neutral-500 text-xs">
            Nova senha temporária
          </p>
          <p className="text-red-400 text-xl font-bold font-mono tracking-widest">
            {resetCreds.password}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-neutral-800">
          <p className="text-neutral-500 text-xs">Link de acesso</p>
          <p className="text-white text-sm font-mono break-all">
            {window.location.origin}/entrar
          </p>
        </div>
      </div>

      <p className="text-neutral-500 text-xs">
        Esta é uma senha temporária. No próximo acesso, o jogador será
        obrigado a cadastrar uma nova senha.
      </p>
    </div>
  )}
</Modal>
    </div>
  );
}
