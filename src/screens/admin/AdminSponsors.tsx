import { useEffect, useState, useRef } from 'react';
import { supabase, Sponsor } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Plus, Edit2, Trash2, Loader2, GripVertical, Eye, EyeOff, Handshake, Globe, Instagram, ArrowUp, ArrowDown } from 'lucide-react';

export function AdminSponsors() {
  const { showToast } = useToast();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Sponsor | null>(null);
  const [form, setForm] = useState({ name: '', website_url: '', instagram_url: '', description: '', display_order: 0, active: true });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Sponsor | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.from('sponsors').select('*').order('display_order', { ascending: true });
      setSponsors((data || []) as Sponsor[]);
    } catch {
      setError('Não foi possível carregar os patrocinadores.');
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', website_url: '', instagram_url: '', description: '', display_order: sponsors.length, active: true });
    setLogoUrl(null);
    setModalOpen(true);
  }

  function openEdit(s: Sponsor) {
    setEditing(s);
    setForm({ name: s.name, website_url: s.website_url || '', instagram_url: s.instagram_url || '', description: s.description || '', display_order: s.display_order, active: s.active });
    setLogoUrl(s.logo_url);
    setModalOpen(true);
  }

  async function handleLogo(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext || '')) {
        showToast('Formato não suportado. Use PNG, JPG, JPEG, WEBP ou SVG.', 'error');
        return;
      }
      const path = `sponsors/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('fotos').upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('fotos').getPublicUrl(path);
      setLogoUrl(urlData.publicUrl);
      showToast('Logo enviado!', 'success');
    } catch {
      showToast('Erro ao enviar logo.', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      showToast('Nome é obrigatório', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        logo_url: logoUrl,
        website_url: form.website_url.trim() || null,
        instagram_url: form.instagram_url.trim() || null,
        description: form.description.trim() || null,
        display_order: form.display_order,
        active: form.active,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('sponsors').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('Patrocinador atualizado!', 'success');
      } else {
        const { error } = await supabase.from('sponsors').insert(payload);
        if (error) throw error;
        showToast('Patrocinador adicionado!', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function del(s: Sponsor) {
    try {
      const { error } = await supabase.from('sponsors').delete().eq('id', s.id);
      if (error) throw error;
      showToast('Patrocinador removido', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao remover', 'error');
    }
  }

  async function toggleActive(s: Sponsor) {
    try {
      const { error } = await supabase.from('sponsors').update({ active: !s.active, updated_at: new Date().toISOString() }).eq('id', s.id);
      if (error) throw error;
      showToast(s.active ? 'Patrocinador desativado' : 'Patrocinador ativado', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro', 'error');
    }
  }

  async function moveOrder(s: Sponsor, direction: 'up' | 'down') {
    const idx = sponsors.findIndex(x => x.id === s.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sponsors.length) return;
    const other = sponsors[swapIdx];
    try {
      await supabase.from('sponsors').update({ display_order: other.display_order, updated_at: new Date().toISOString() }).eq('id', s.id);
      await supabase.from('sponsors').update({ display_order: s.display_order, updated_at: new Date().toISOString() }).eq('id', other.id);
      load();
    } catch {
      showToast('Erro ao reordenar', 'error');
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Patrocinadores</h1>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Novo Patrocinador</button>
      </div>

      {sponsors.length === 0 ? (
        <EmptyState
          icon={<Handshake size={40} />}
          title="Nenhum patrocinador"
          description="Adicione patrocinadores para exibi-los publicamente."
          action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Adicionar</button>}
        />
      ) : (
        <div className="space-y-3">
          {sponsors.map((s, i) => (
            <div key={s.id} className="card p-4 flex items-center gap-4">
              <div className="flex flex-col gap-0.5">
                <button onClick={() => moveOrder(s, 'up')} disabled={i === 0} className="text-neutral-600 hover:text-white disabled:opacity-30"><ArrowUp size={14} /></button>
                <button onClick={() => moveOrder(s, 'down')} disabled={i === sponsors.length - 1} className="text-neutral-600 hover:text-white disabled:opacity-30"><ArrowDown size={14} /></button>
              </div>
              <div className="w-12 h-12 flex items-center justify-center shrink-0">
                {s.logo_url ? (
                  <img src={s.logo_url} alt={s.name} className="max-w-full max-h-full object-contain" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-600 font-bold">{s.name.charAt(0).toUpperCase()}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{s.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`badge ${s.active ? 'border-green-500/30 text-green-400' : 'border-neutral-700 text-neutral-500'}`}>
                    {s.active ? 'Ativo' : 'Inativo'}
                  </span>
                  {s.website_url && <Globe size={12} className="text-neutral-600" />}
                  {s.instagram_url && <Instagram size={12} className="text-neutral-600" />}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => toggleActive(s)} className="btn-ghost" title={s.active ? 'Desativar' : 'Ativar'}>
                  {s.active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button onClick={() => openEdit(s)} className="btn-ghost"><Edit2 size={16} /></button>
                <button onClick={() => setDeleteTarget(s)} className="btn-ghost text-red-400"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={e => {
        const f = e.target.files?.[0];
        if (f) handleLogo(f);
        e.target.value = '';
      }} />

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Patrocinador' : 'Novo Patrocinador'}
        size="md"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button onClick={save} className="btn-primary flex-1" disabled={saving}>
              {saving && <Loader2 size={14} className="animate-spin" />} Salvar
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Logo upload */}
          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center shrink-0">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                ) : (
                  <Handshake size={24} className="text-neutral-600" />
                )}
              </div>
              <div className="flex-1">
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enviar Logo
                </button>
                <p className="text-neutral-600 text-xs mt-1">PNG, JPG, JPEG, WEBP ou SVG</p>
              </div>
            </div>
          </div>

          <div>
            <label className="label">Nome *</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do patrocinador" />
          </div>

          <div>
            <label className="label">Website</label>
            <input className="input" value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://..." />
          </div>

          <div>
            <label className="label">Instagram</label>
            <input className="input" value={form.instagram_url} onChange={e => setForm(f => ({ ...f, instagram_url: e.target.value }))} placeholder="https://instagram.com/..." />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea className="input min-h-[60px] resize-y" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição (opcional)" />
          </div>

          <div className="flex items-center gap-3">
            <label className="label mb-0">Ativo</label>
            <button
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-red-600' : 'bg-neutral-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Remover Patrocinador"
        message={`Tem certeza que deseja remover "${deleteTarget?.name}"?`}
        confirmLabel="Remover"
        danger
        onConfirm={() => deleteTarget && del(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
