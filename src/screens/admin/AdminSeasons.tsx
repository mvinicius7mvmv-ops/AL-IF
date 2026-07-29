import { useEffect, useState } from 'react';
import { supabase, Season } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Loader2, Settings, CheckCircle, Lock } from 'lucide-react';

export function AdminSeasons() {
  const { showToast } = useToast();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Season | null>(null);
  const [form, setForm] = useState({ nome: '', ano: String(new Date().getFullYear()) });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Season | null>(null);
  const [activateTarget, setActivateTarget] = useState<Season | null>(null);
  const [closeTarget, setCloseTarget] = useState<Season | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data, error: e } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      if (e) throw e;
      setSeasons(data || []);
    } catch {
      setError('Não foi possível carregar as temporadas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ nome: '', ano: String(new Date().getFullYear()) });
    setModalOpen(true);
  }
  function openEdit(s: Season) {
    setEditing(s);
    setForm({ nome: s.nome, ano: String(s.ano) });
    setModalOpen(true);
  }

  async function save() {
    if (!form.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
    if (!form.ano || Number(form.ano) < 2000) { showToast('Ano inválido', 'error'); return; }
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from('seasons').update({ nome: form.nome.trim(), ano: Number(form.ano) }).eq('id', editing.id);
        if (error) throw error;
        showToast('Temporada atualizada', 'success');
      } else {
        const { error } = await supabase.from('seasons').insert({ nome: form.nome.trim(), ano: Number(form.ano), ativa: false, encerrada: false });
        if (error) throw error;
        showToast('Temporada criada', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function activate() {
    if (!activateTarget) return;
    try {
      // Deactivate all others
      await supabase.from('seasons').update({ ativa: false }).neq('id', activateTarget.id);
      const { error } = await supabase.from('seasons').update({ ativa: true, encerrada: false }).eq('id', activateTarget.id);
      if (error) throw error;
      showToast('Temporada ativada', 'success');
      load();
    } catch {
      showToast('Erro ao ativar', 'error');
    }
  }

  async function closeSeason() {
    if (!closeTarget) return;
    try {
      const { error } = await supabase.from('seasons').update({ encerrada: true, ativa: false }).eq('id', closeTarget.id);
      if (error) throw error;
      showToast('Temporada encerrada', 'success');
      load();
    } catch {
      showToast('Erro ao encerrar', 'error');
    }
  }

  async function del() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('seasons').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Temporada excluída', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao excluir', 'error');
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Temporadas</h1>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nova Temporada</button>
      </div>

      {seasons.length === 0 ? (
        <EmptyState icon={<Settings size={48} />} title="Sem temporadas" description="Crie uma temporada para começar a cadastrar jogos." />
      ) : (
        <div className="space-y-2">
          {seasons.map(s => (
            <div key={s.id} className="card p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white font-bold text-base">{s.nome}</p>
                    <span className="text-neutral-500 text-sm">{s.ano}</span>
                    {s.ativa && <span className="badge bg-green-500/15 text-green-400 border border-green-800/40"><CheckCircle size={12} /> Ativa</span>}
                    {s.encerrada && <span className="badge bg-neutral-800 text-neutral-400 border border-neutral-700"><Lock size={12} /> Encerrada</span>}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {!s.ativa && !s.encerrada && (
                    <button onClick={() => setActivateTarget(s)} className="btn-secondary text-xs">Ativar</button>
                  )}
                  {s.ativa && !s.encerrada && (
                    <button onClick={() => setCloseTarget(s)} className="btn-secondary text-xs text-yellow-400 hover:bg-yellow-900/20">Encerrar</button>
                  )}
                  <button onClick={() => openEdit(s)} className="btn-ghost text-xs"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleteTarget(s)} className="btn-ghost text-xs text-red-400 hover:bg-red-900/20"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? 'Editar Temporada' : 'Nova Temporada'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button onClick={save} className="btn-primary flex-1" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" />} Salvar</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div><label className="label">Nome *</label><input className="input" placeholder="Ex.: Temporada 2026" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
          <div><label className="label">Ano *</label><input className="input" type="number" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmModal open={!!activateTarget} title="Ativar temporada" message={`Ativar "${activateTarget?.nome}"? A temporada ativa atual será desativada.`} confirmLabel="Ativar" onConfirm={activate} onClose={() => setActivateTarget(null)} />
      <ConfirmModal open={!!closeTarget} title="Encerrar temporada" message={`Encerrar "${closeTarget?.nome}"? As estatísticas serão preservadas mas a temporada não poderá mais ser modificada.`} confirmLabel="Encerrar" danger onConfirm={closeSeason} onClose={() => setCloseTarget(null)} />
      <ConfirmModal open={!!deleteTarget} title="Excluir temporada" message={`Excluir "${deleteTarget?.nome}"? Todos os jogos e estatísticas relacionados serão perdidos.`} confirmLabel="Excluir" danger onConfirm={del} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}
