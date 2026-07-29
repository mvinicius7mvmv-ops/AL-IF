import { useEffect, useState } from 'react';
import { supabase, FinanceEntry, Profile } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { formatDate, cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

const CATEGORIES = ['Mensalidades', 'Patrocínio', 'Doação', 'Bingo', 'Evento', 'Uniforme', 'Transporte', 'Alimentação', 'Arbitragem', 'Campo', 'Outro'];

export function AdminFinance() {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<FinanceEntry[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'receita' | 'despesa'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FinanceEntry | null>(null);
  const [form, setForm] = useState({ tipo: 'receita' as FinanceEntry['tipo'], categoria: '', descricao: '', valor: '', data: '', observacao: '', related_player_id: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FinanceEntry | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [eRes, pRes] = await Promise.all([
        supabase.from('finance_entries').select('*').order('data', { ascending: false }),
        supabase.from('profiles').select('*').eq('status', 'active').order('nome'),
      ]);
      setEntries(eRes.data || []);
      setPlayers(pRes.data || []);
    } catch {
      setError('Não foi possível carregar o financeiro.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew(tipo: 'receita' | 'despesa') {
    setEditing(null);
    setForm({ tipo, categoria: '', descricao: '', valor: '', data: new Date().toISOString().slice(0, 10), observacao: '', related_player_id: '' });
    setModalOpen(true);
  }
  function openEdit(e: FinanceEntry) {
    setEditing(e);
    setForm({ tipo: e.tipo, categoria: e.categoria || '', descricao: e.descricao, valor: String(e.valor), data: e.data, observacao: e.observacao || '', related_player_id: e.related_player_id || '' });
    setModalOpen(true);
  }

  async function save() {
    if (!form.descricao.trim()) { showToast('Descrição é obrigatória', 'error'); return; }
    if (!form.valor || Number(form.valor) <= 0) { showToast('Valor inválido', 'error'); return; }
    if (!form.data) { showToast('Data é obrigatória', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        categoria: form.categoria || null,
        descricao: form.descricao.trim(),
        valor: Number(form.valor),
        data: form.data,
        observacao: form.observacao || null,
        related_player_id: form.related_player_id || null,
      };
      if (editing) {
        const { error } = await supabase.from('finance_entries').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('Lançamento atualizado', 'success');
      } else {
        const { error } = await supabase.from('finance_entries').insert(payload);
        if (error) throw error;
        showToast('Lançamento criado', 'success');
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
      const { error } = await supabase.from('finance_entries').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Lançamento excluído', 'success');
      load();
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  }

  const filtered = entries.filter(e => filter === 'all' || e.tipo === filter);
  const receitas = entries.filter(e => e.tipo === 'receita').reduce((s, e) => s + Number(e.valor), 0);
  const despesas = entries.filter(e => e.tipo === 'despesa').reduce((s, e) => s + Number(e.valor), 0);
  const saldo = receitas - despesas;

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-white">Financeiro</h1>

      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="stat-label">Receitas</p>
          <p className="text-xl font-bold text-green-400 tabular-nums mt-1">R$ {receitas.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Despesas</p>
          <p className="text-xl font-bold text-red-400 tabular-nums mt-1">R$ {despesas.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Saldo</p>
          <p className={`text-xl font-bold tabular-nums mt-1 ${saldo >= 0 ? 'text-green-400' : 'text-red-400'}`}>R$ {saldo.toFixed(2)}</p>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => openNew('receita')} className="btn-primary text-sm"><Plus size={14} /> Receita</button>
        <button onClick={() => openNew('despesa')} className="btn-secondary text-sm"><Plus size={14} /> Despesa</button>
        <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg ml-auto">
          {(['all','receita','despesa'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', filter === f ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white')}>{f === 'all' ? 'Tudo' : f === 'receita' ? 'Receitas' : 'Despesas'}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Wallet size={48} />} title="Sem lançamentos" description="Adicione receitas e despesas para acompanhar o saldo." />
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className="card p-3 flex items-center gap-3">
              <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', e.tipo === 'receita' ? 'bg-green-500/20' : 'bg-red-500/20')}>
                {e.tipo === 'receita' ? <TrendingUp size={18} className="text-green-400" /> : <TrendingDown size={18} className="text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{e.descricao}</p>
                <p className="text-neutral-500 text-xs">{e.categoria || 'Sem categoria'} · {formatDate(e.data)}</p>
              </div>
              <p className={cn('font-bold tabular-nums text-sm shrink-0', e.tipo === 'receita' ? 'text-green-400' : 'text-red-400')}>
                {e.tipo === 'receita' ? '+' : '-'} R$ {Number(e.valor).toFixed(2)}
              </p>
              <button onClick={() => openEdit(e)} className="text-neutral-500 hover:text-white"><Edit2 size={14} /></button>
              <button onClick={() => setDeleteTarget(e)} className="text-neutral-500 hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? 'Editar Lançamento' : `Nova ${form.tipo === 'receita' ? 'Receita' : 'Despesa'}`}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button onClick={save} className="btn-primary flex-1" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" />} Salvar</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setForm(f => ({ ...f, tipo: 'receita' }))} className={cn('px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors', form.tipo === 'receita' ? 'bg-green-600 text-white border-green-600' : 'bg-neutral-800 text-neutral-400 border-neutral-700')}>Receita</button>
              <button onClick={() => setForm(f => ({ ...f, tipo: 'despesa' }))} className={cn('px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors', form.tipo === 'despesa' ? 'bg-red-600 text-white border-red-600' : 'bg-neutral-800 text-neutral-400 border-neutral-700')}>Despesa</button>
            </div>
          </div>
          <div><label className="label">Descrição *</label><input className="input" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} /></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                <option value="">Selecione</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Valor *</label><input className="input" type="number" step="0.01" placeholder="0.00" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} /></div>
          </div>
          <div><label className="label">Data *</label><input className="input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} /></div>
          <div>
            <label className="label">Jogador relacionado (opcional)</label>
            <select className="input" value={form.related_player_id} onChange={e => setForm(f => ({ ...f, related_player_id: e.target.value }))}>
              <option value="">Nenhum</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.apelido || p.nome}</option>)}
            </select>
          </div>
          <div><label className="label">Observação</label><textarea className="input min-h-[60px]" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir lançamento"
        message="Excluir este lançamento financeiro?"
        confirmLabel="Excluir"
        danger
        onConfirm={del}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
