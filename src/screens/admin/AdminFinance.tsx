import { useEffect, useState } from 'react';
import { supabase, FinanceEntry, Profile } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { formatDate, cn } from '@/lib/utils';
import { Plus, Edit2, Trash2, Loader2, TrendingUp, TrendingDown, Wallet, Calendar } from 'lucide-react';

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
  const [feeSummary, setFeeSummary] = useState<{ expected: number; collected: number; pending: number; pct: number } | null>(null);
  const [feeMonthly, setFeeMonthly] = useState<{ label: string; collected: number; expected: number }[]>([]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [eRes, pRes, feeRes] = await Promise.all([
        supabase.from('finance_entries').select('*').order('data', { ascending: false }),
        supabase.from('profiles').select('*').eq('status', 'active').order('nome'),
        supabase.from('monthly_fees').select('valor, status, isento, competencia'),
      ]);
      setEntries(eRes.data || []);
      setPlayers(pRes.data || []);
      const allFees = (feeRes.data || []) as any[];
      const now = new Date();
      const currentComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const currentFees = allFees.filter(f => f.competencia?.startsWith(currentComp));
      const expected = currentFees.filter(f => !f.isento).reduce((s, f) => s + Number(f.valor), 0);
      const collected = currentFees.filter(f => f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0);
      const pending = expected - collected;
      const pct = expected > 0 ? Math.round((collected / expected) * 100) : 0;
      setFeeSummary({ expected, collected, pending, pct });
      // Monthly evolution (last 6 months)
      const monthly: { label: string; collected: number; expected: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const comp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('pt-BR', { month: 'short' });
        const monthFees = allFees.filter(f => f.competencia?.startsWith(comp));
        monthly.push({
          label,
          collected: monthFees.filter(f => f.status === 'pago').reduce((s, f) => s + Number(f.valor), 0),
          expected: monthFees.filter(f => !f.isento).reduce((s, f) => s + Number(f.valor), 0),
        });
      }
      setFeeMonthly(monthly);
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

      {/* Monthly Fees Dashboard */}
      {feeSummary && (
        <div className="card p-5">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2"><Wallet size={16} className="text-red-400" /> Mensalidades - Mês Atual</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div><p className="stat-label">Esperado</p><p className="text-lg font-bold text-white tabular-nums mt-1">R$ {feeSummary.expected.toFixed(2)}</p></div>
            <div><p className="stat-label">Arrecadado</p><p className="text-lg font-bold text-green-400 tabular-nums mt-1">R$ {feeSummary.collected.toFixed(2)}</p></div>
            <div><p className="stat-label">Pendente</p><p className="text-lg font-bold text-yellow-400 tabular-nums mt-1">R$ {feeSummary.pending.toFixed(2)}</p></div>
            <div><p className="stat-label">Aproveit.</p><p className="text-lg font-bold text-red-400 tabular-nums mt-1">{feeSummary.pct}%</p></div>
          </div>
          {feeMonthly.length > 0 && (
            <div>
              <p className="stat-label mb-3">Evolução mensal (6 meses)</p>
              <div className="flex items-end gap-2 h-24">
                {feeMonthly.map((m, i) => {
                  const maxVal = Math.max(...feeMonthly.map(x => Math.max(x.collected, x.expected)), 1);
                  const colH = (m.collected / maxVal) * 100;
                  const expH = (m.expected / maxVal) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div className="relative w-full flex-1 flex items-end justify-center">
                        <div className="absolute bottom-0 w-full bg-neutral-700/40 rounded-t" style={{ height: `${expH}%` }} />
                        <div className="relative w-3/4 bg-green-500 rounded-t transition-all" style={{ height: `${colH}%` }} />
                      </div>
                      <p className="text-neutral-600 text-[10px] capitalize">{m.label}</p>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-2 justify-center">
                <span className="text-xs text-neutral-500 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-green-500" /> Arrecadado</span>
                <span className="text-xs text-neutral-500 flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-neutral-700" /> Esperado</span>
              </div>
            </div>
          )}
        </div>
      )}

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
