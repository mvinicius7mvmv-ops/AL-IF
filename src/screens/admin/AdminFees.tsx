import { useEffect, useState } from 'react';
import { supabase, MonthlyFee, Profile } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { formatDate, cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Loader2, Wallet, CheckCircle, Clock, AlertTriangle, Search } from 'lucide-react';

export function AdminFees() {
  const { showToast } = useToast();
  const [fees, setFees] = useState<(MonthlyFee & { profiles?: { nome: string; apelido: string | null } })[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pago' | 'pendente' | 'atrasado'>('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MonthlyFee | null>(null);
  const [form, setForm] = useState({ player_id: '', competencia: '', valor: '', vencimento: '', status: 'pendente' as MonthlyFee['status'], pago_em: '', observacao: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MonthlyFee | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [fRes, pRes] = await Promise.all([
        supabase.from('monthly_fees').select('*, profiles(nome, apelido)').order('competencia', { ascending: false }),
        supabase.from('profiles').select('*').eq('status', 'active').order('nome'),
      ]);
      setFees(fRes.data || []);
      setPlayers(pRes.data || []);
    } catch {
      setError('Não foi possível carregar as mensalidades.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    const now = new Date();
    setForm({
      player_id: '', competencia: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      valor: '', vencimento: '', status: 'pendente', pago_em: '', observacao: '',
    });
    setModalOpen(true);
  }
  function openEdit(f: MonthlyFee) {
    setEditing(f);
    setForm({
      player_id: f.player_id, competencia: f.competencia, valor: String(f.valor),
      vencimento: f.vencimento || '', status: f.status, pago_em: f.pago_em || '', observacao: f.observacao || '',
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.player_id) { showToast('Selecione um jogador', 'error'); return; }
    if (!form.competencia) { showToast('Competência é obrigatória', 'error'); return; }
    if (!form.valor || Number(form.valor) <= 0) { showToast('Valor inválido', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        player_id: form.player_id,
        competencia: form.competencia,
        valor: Number(form.valor),
        vencimento: form.vencimento || null,
        status: form.status,
        pago_em: form.status === 'pago' ? (form.pago_em || new Date().toISOString().slice(0, 10)) : null,
        observacao: form.observacao || null,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('monthly_fees').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('Mensalidade atualizada', 'success');
      } else {
        const { error } = await supabase.from('monthly_fees').insert(payload);
        if (error) throw error;
        showToast('Mensalidade criada', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function del() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('monthly_fees').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Mensalidade excluída', 'success');
      load();
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  }

  async function markPaid(fee: MonthlyFee) {
    const { error } = await supabase.from('monthly_fees').update({
      status: 'pago', pago_em: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString(),
    }).eq('id', fee.id);
    if (error) { showToast('Erro', 'error'); return; }
    showToast('Marcado como pago', 'success');
    load();
  }

  const filtered = fees.filter(f => {
    if (filter !== 'all' && f.status !== filter) return false;
    if (search) {
      const name = f.profiles?.apelido || f.profiles?.nome || '';
      if (!name.toLowerCase().includes(search.toLowerCase()) && !f.competencia.includes(search)) return false;
    }
    return true;
  });

  const totalPago = fees.filter(f => f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0);
  const totalPendente = fees.filter(f => f.status !== 'pago').reduce((s, f) => s + Number(f.valor), 0);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Mensalidades</h1>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Nova Mensalidade</button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="stat-label">Total Pago</p><p className="text-2xl font-bold text-green-400 tabular-nums mt-1">R$ {totalPago.toFixed(2)}</p></div>
        <div className="card p-4"><p className="stat-label">Pendente</p><p className="text-2xl font-bold text-yellow-400 tabular-nums mt-1">R$ {totalPendente.toFixed(2)}</p></div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(['all','pago','pendente','atrasado'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', filter === f ? 'bg-red-600 text-white' : 'bg-neutral-900 text-neutral-400 hover:bg-neutral-800')}>
            {f === 'all' ? 'Todas' : f === 'pago' ? 'Pagas' : f === 'pendente' ? 'Pendentes' : 'Atrasadas'}
          </button>
        ))}
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
        <input className="input pl-10" placeholder="Buscar por jogador ou competência..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="Nenhuma mensalidade" />
      ) : (
        <div className="space-y-2">
          {filtered.map(fee => (
            <div key={fee.id} className="card p-3 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', fee.status === 'pago' ? 'bg-green-500/20' : fee.status === 'atrasado' ? 'bg-red-500/20' : 'bg-yellow-500/20')}>
                {fee.status === 'pago' ? <CheckCircle size={18} className="text-green-400" /> : fee.status === 'atrasado' ? <AlertTriangle size={18} className="text-red-400" /> : <Clock size={18} className="text-yellow-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{fee.profiles?.apelido || fee.profiles?.nome || '—'}</p>
                <p className="text-neutral-500 text-xs">{fee.competencia}{fee.vencimento ? ` · Venc: ${formatDate(fee.vencimento)}` : ''}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-bold tabular-nums text-sm">R$ {Number(fee.valor).toFixed(2)}</p>
                {fee.status !== 'pago' && (
                  <button onClick={() => markPaid(fee)} className="text-green-400 text-xs hover:text-green-300">Marcar pago</button>
                )}
              </div>
              <button onClick={() => openEdit(fee)} className="text-neutral-500 hover:text-white"><Edit2 size={14} /></button>
              <button onClick={() => setDeleteTarget(fee)} className="text-neutral-500 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? 'Editar Mensalidade' : 'Nova Mensalidade'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button onClick={save} className="btn-primary flex-1" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" />} Salvar</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Jogador *</label>
            <select className="input" value={form.player_id} onChange={e => setForm(f => ({ ...f, player_id: e.target.value }))}>
              <option value="">Selecione</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.apelido || p.nome}</option>)}
            </select>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Competência *</label><input className="input" type="month" value={form.competencia} onChange={e => setForm(f => ({ ...f, competencia: e.target.value }))} /></div>
            <div><label className="label">Valor *</label><input className="input" type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Vencimento</label><input className="input" type="date" value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value }))} /></div>
            <div>
              <label className="label">Status</label>
              <select className="input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as any }))}>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="atrasado">Atrasado</option>
              </select>
            </div>
          </div>
          {form.status === 'pago' && (
            <div><label className="label">Data de pagamento</label><input className="input" type="date" value={form.pago_em} onChange={e => setForm(f => ({ ...f, pago_em: e.target.value }))} /></div>
          )}
          <div><label className="label">Observação</label><input className="input" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir mensalidade"
        message="Excluir esta mensalidade?"
        confirmLabel="Excluir"
        danger
        onConfirm={del}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
