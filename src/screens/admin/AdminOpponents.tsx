import { useEffect, useState, useRef } from 'react';
import { supabase, Opponent } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Plus, Edit2, Trash2, Loader2, Eye, EyeOff, Shield, MapPin, Search } from 'lucide-react';

export function AdminOpponents() {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Opponent | null>(null);
  const [form, setForm] = useState({ name: '', city: '', state: '', notes: '', active: true });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Opponent | null>(null);
  const [deleteUsed, setDeleteUsed] = useState(false);
  const [checkingDelete, setCheckingDelete] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await supabase.from('opponents').select('*').order('name', { ascending: true });
      setOpponents((data || []) as Opponent[]);
    } catch {
      setError('Não foi possível carregar os adversários.');
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditing(null);
    setForm({ name: '', city: '', state: '', notes: '', active: true });
    setLogoUrl(null);
    setModalOpen(true);
  }

  function openEdit(o: Opponent) {
    setEditing(o);
    setForm({ name: o.name, city: o.city || '', state: o.state || '', notes: o.notes || '', active: o.active });
    setLogoUrl(o.logo_url);
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
      const path = `opponents/${Date.now()}.${ext}`;
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
    if (!form.name.trim()) { showToast('Nome é obrigatório', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        logo_url: logoUrl,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        notes: form.notes.trim() || null,
        active: form.active,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('opponents').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('Adversário atualizado!', 'success');
      } else {
        const { error } = await supabase.from('opponents').insert(payload);
        if (error) throw error;
        showToast('Adversário adicionado!', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(o: Opponent) {
    try {
      const { error } = await supabase.from('opponents').update({ active: !o.active, updated_at: new Date().toISOString() }).eq('id', o.id);
      if (error) throw error;
      showToast(o.active ? 'Adversário desativado' : 'Adversário ativado', 'success');
      load();
    } catch {
      showToast('Erro', 'error');
    }
  }

  async function checkAndDelete(o: Opponent) {
    setCheckingDelete(true);
    try {
      const { count } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('opponent_id', o.id);
      if (count && count > 0) {
        setDeleteUsed(true);
      } else {
        setDeleteUsed(false);
      }
      setDeleteTarget(o);
    } catch {
      showToast('Erro ao verificar', 'error');
    } finally {
      setCheckingDelete(false);
    }
  }

  async function del() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('opponents').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Adversário excluído', 'success');
      load();
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  }

  const filtered = opponents.filter(o => {
    if (filterActive === 'active' && !o.active) return false;
    if (filterActive === 'inactive' && o.active) return false;
    if (search && !o.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Adversários</h1>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Novo Adversário</button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input className="input pl-10" placeholder="Buscar adversário..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          {(['all', 'active', 'inactive'] as const).map(f => (
            <button key={f} onClick={() => setFilterActive(f)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filterActive === f ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white'}`}>
              {f === 'all' ? 'Todos' : f === 'active' ? 'Ativos' : 'Inativos'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Shield size={48} />} title="Nenhum adversário" description="Adicione adversários para reutilizar ao criar jogos." action={<button onClick={openNew} className="btn-primary"><Plus size={16} /> Adicionar</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(o => (
            <div key={o.id} className="card p-4 flex items-center gap-3">
              <button onClick={() => navigate(`/adversario/${o.id}`)} className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center shrink-0">
                {o.logo_url ? <img src={o.logo_url} alt={o.name} className="w-full h-full object-contain p-1" /> : <Shield size={20} className="text-neutral-600" />}
              </button>
              <div className="flex-1 min-w-0">
                <button onClick={() => navigate(`/adversario/${o.id}`)} className="text-white font-semibold text-sm truncate block hover:text-red-400 transition-colors">{o.name}</button>
                {(o.city || o.state) && <p className="text-neutral-500 text-xs flex items-center gap-1"><MapPin size={10} /> {[o.city, o.state].filter(Boolean).join(' - ')}</p>}
                <span className={`badge mt-1 ${o.active ? 'border-green-500/30 text-green-400' : 'border-neutral-700 text-neutral-500'}`}>{o.active ? 'Ativo' : 'Inativo'}</span>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => toggleActive(o)} className="btn-ghost p-1.5" title={o.active ? 'Desativar' : 'Ativar'}>{o.active ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                <button onClick={() => openEdit(o)} className="btn-ghost p-1.5"><Edit2 size={16} /></button>
                <button onClick={() => checkAndDelete(o)} className="btn-ghost p-1.5 text-red-400" disabled={checkingDelete}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleLogo(f); e.target.value = ''; }} />

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? 'Editar Adversário' : 'Novo Adversário'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button onClick={save} className="btn-primary flex-1" disabled={saving}>{saving && <Loader2 size={14} className="animate-spin" />} Salvar</button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-neutral-800 border border-neutral-700 overflow-hidden flex items-center justify-center shrink-0">
                {logoUrl ? <img src={logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <Shield size={24} className="text-neutral-600" />}
              </div>
              <div className="flex-1">
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm">
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Enviar Logo
                </button>
                <p className="text-neutral-600 text-xs mt-1">PNG, JPG, JPEG, WEBP ou SVG</p>
              </div>
            </div>
          </div>
          <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do adversário" /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Cidade</label><input className="input" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div><label className="label">Estado</label><input className="input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="MS, SP, RJ..." /></div>
          </div>
          <div><label className="label">Observações</label><textarea className="input min-h-[60px] resize-y" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
          <div className="flex items-center gap-3">
            <label className="label mb-0">Ativo</label>
            <button onClick={() => setForm(f => ({ ...f, active: !f.active }))} className={`relative w-11 h-6 rounded-full transition-colors ${form.active ? 'bg-red-600' : 'bg-neutral-700'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${form.active ? 'translate-x-5' : ''}`} />
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget && !deleteUsed}
        title="Excluir adversário"
        message={`Excluir "${deleteTarget?.name}" permanentemente?`}
        confirmLabel="Excluir"
        danger
        onConfirm={del}
        onClose={() => setDeleteTarget(null)}
      />

      <Modal
        open={!!deleteTarget && deleteUsed}
        onClose={() => setDeleteTarget(null)}
        title="Não é possível excluir"
        footer={<button onClick={() => setDeleteTarget(null)} className="btn-primary w-full">Entendi</button>}
      >
        <p className="text-neutral-400 text-sm">
          "{deleteTarget?.name}" já foi usado em jogos e não pode ser excluído.
          Você pode desativá-lo para que não apareça mais ao criar novos jogos.
        </p>
        {deleteTarget && (
          <button
            onClick={() => { toggleActive(deleteTarget); setDeleteTarget(null); }}
            className="btn-secondary text-sm w-full mt-3"
          >
            Desativar "{deleteTarget.name}"
          </button>
        )}
      </Modal>
    </div>
  );
}
