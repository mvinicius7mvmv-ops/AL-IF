import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, MonthlyFee, Profile } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { formatDate, cn } from '@/lib/utils';
import {
  Plus, Edit2, Trash2, Loader2, Wallet, CheckCircle, Clock, AlertTriangle,
  Search, Calendar, Sparkles, X, Ban, StickyNote,
} from 'lucide-react';

interface FeeWithProfile extends MonthlyFee {
  profiles?: { nome: string; apelido: string | null };
}

export function AdminFees() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [fees, setFees] = useState<FeeWithProfile[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [filterPlayer, setFilterPlayer] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pago' | 'pendente' | 'atrasado' | 'isento'>('all');
  const [generating, setGenerating] = useState(false);
  const [editTarget, setEditTarget] = useState<FeeWithProfile | null>(null);
  const [editForm, setEditForm] = useState({ valor: '', vencimento: '', observacao: '', isento: false });
  const [savingEdit, setSavingEdit] = useState(false);
  const [noteTarget, setNoteTarget] = useState<FeeWithProfile | null>(null);
  const [noteText, setNoteText] = useState('');

  const competencia = `${year}-${String(month).padStart(2, '0')}`;
  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  useEffect(() => { load(); }, [year, month]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [fRes, pRes] = await Promise.all([
        supabase.from('monthly_fees').select('*, profiles(nome, apelido)').ilike('competencia', `${competencia}%`).order('competencia'),
        supabase.from('profiles').select('*').order('nome'),
      ]);
      setFees(fRes.data || []);
      setPlayers(pRes.data || []);
    } catch {
      setError('Não foi possível carregar as mensalidades.');
    } finally {
      setLoading(false);
    }
  }

  async function generateMonth() {
    setGenerating(true);
    try {
      const activePlayers = players.filter(p => p.status === 'active');
      if (activePlayers.length === 0) {
        showToast('Nenhum jogador ativo', 'error');
        return;
      }

      const existing = new Map(fees.map(f => [f.player_id, f]));
      const toCreate = activePlayers.filter(p => !existing.has(p.id));

      if (toCreate.length === 0) {
        showToast('Todos os jogadores já possuem mensalidade neste mês', 'info');
        return;
      }

      const vencimento = new Date(year, month, 5).toISOString().slice(0, 10);
      const defaultValor = existing.size > 0 ? fees[0].valor : 50;

      const records = toCreate.map(p => ({
        player_id: p.id,
        competencia,
        valor: defaultValor,
        vencimento,
        status: 'pendente' as const,
      }));

      const { error: insertErr } = await supabase.from('monthly_fees').insert(records);
      if (insertErr) throw insertErr;

      showToast(`${toCreate.length} mensalidade(s) gerada(s)`, 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao gerar mensalidades', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function togglePaid(fee: FeeWithProfile) {
    try {
      if (fee.status === 'pago') {
        const { error } = await supabase.from('monthly_fees').update({
          status: 'pendente', pago_em: null, confirmado_por: null, updated_at: new Date().toISOString(),
        }).eq('id', fee.id);
        if (error) throw error;
        showToast('Pagamento desfeito', 'success');
      } else {
        const { error } = await supabase.from('monthly_fees').update({
          status: 'pago', pago_em: new Date().toISOString().slice(0, 10),
          confirmado_por: user?.id || null, updated_at: new Date().toISOString(),
        }).eq('id', fee.id);
        if (error) throw error;
        showToast('Pagamento confirmado', 'success');
      }
      load();
    } catch {
      showToast('Erro', 'error');
    }
  }

  async function toggleExempt(fee: FeeWithProfile) {
    try {
      const { error } = await supabase.from('monthly_fees').update({
        isento: !fee.isento, updated_at: new Date().toISOString(),
      }).eq('id', fee.id);
      if (error) throw error;
      showToast(fee.isento ? 'Isenção removida' : 'Jogador isento', 'success');
      load();
    } catch {
      showToast('Erro', 'error');
    }
  }

  function openEdit(fee: FeeWithProfile) {
    setEditTarget(fee);
    setEditForm({ valor: String(fee.valor), vencimento: fee.vencimento || '', observacao: fee.observacao || '', isento: fee.isento });
  }

  async function saveEdit() {
    if (!editTarget) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase.from('monthly_fees').update({
        valor: Number(editForm.valor), vencimento: editForm.vencimento || null,
        observacao: editForm.observacao || null, isento: editForm.isento,
        updated_at: new Date().toISOString(),
      }).eq('id', editTarget.id);
      if (error) throw error;
      showToast('Mensalidade atualizada', 'success');
      setEditTarget(null);
      load();
    } catch {
      showToast('Erro ao salvar', 'error');
    } finally {
      setSavingEdit(false);
    }
  }

  async function saveNote() {
    if (!noteTarget) return;
    try {
      const { error } = await supabase.from('monthly_fees').update({
        observacao: noteText || null, updated_at: new Date().toISOString(),
      }).eq('id', noteTarget.id);
      if (error) throw error;
      showToast('Observação salva', 'success');
      setNoteTarget(null);
      load();
    } catch {
      showToast('Erro', 'error');
    }
  }

  async function deleteFee(fee: FeeWithProfile) {
    try {
      const { error } = await supabase.from('monthly_fees').delete().eq('id', fee.id);
      if (error) throw error;
      showToast('Mensalidade excluída', 'success');
      load();
    } catch {
      showToast('Erro', 'error');
    }
  }

  // Build full grid: all active players + any fee for this month (covers inactive players who had fees)
  const playerMap = new Map(players.map(p => [p.id, p]));
  const feeMap = new Map(fees.map(f => [f.player_id, f]));
  const allPlayerIds = new Set([...feeMap.keys(), ...players.filter(p => p.status === 'active').map(p => p.id)]);

  const gridRows: { player: Profile; fee: FeeWithProfile | null }[] = Array.from(allPlayerIds)
    .map(id => ({ player: playerMap.get(id)!, fee: feeMap.get(id) || null }))
    .filter(r => r.player)
    .filter(r => {
      if (filterPlayer && r.player.id !== filterPlayer) return false;
      if (filterStatus === 'all') return true;
      if (filterStatus === 'isento') return r.fee?.isento;
      if (!r.fee) return filterStatus === 'pendente';
      if (r.fee.isento) return false;
      return r.fee.status === filterStatus;
    })
    .sort((a, b) => (a.player.apelido || a.player.nome).localeCompare(b.player.apelido || b.player.nome));

  const totalExpected = gridRows.reduce((s, r) => s + (r.fee && !r.fee.isento ? Number(r.fee.valor) : 0), 0);
  const totalReceived = gridRows.reduce((s, r) => s + (r.fee?.status === 'pago' ? Number(r.fee.valor) : 0), 0);
  const totalPending = gridRows.reduce((s, r) => s + (r.fee && r.fee.status !== 'pago' && !r.fee.isento ? Number(r.fee.valor) : 0), 0);
  const totalExempt = gridRows.filter(r => r.fee?.isento).length;
  const paidCount = gridRows.filter(r => r.fee?.status === 'pago').length;
  const pendingCount = gridRows.filter(r => r.fee && r.fee.status !== 'pago' && !r.fee.isento).length;
  const totalCount = gridRows.length;
  const payPct = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
  const isOverdue = (fee: FeeWithProfile) => {
    if (!fee || fee.status === 'pago' || fee.isento) return false;
    if (!fee.vencimento) return false;
    return new Date(fee.vencimento) < new Date() && new Date(fee.vencimento).getMonth() + 1 <= month;
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const years = [new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1];
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Mensalidades</h1>
        <button onClick={generateMonth} disabled={generating} className="btn-primary">
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Gerar Mês
        </button>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <select className="input w-24" value={year} onChange={e => setYear(Number(e.target.value))}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="input w-32" value={month} onChange={e => setMonth(Number(e.target.value))}>
          {months.map(m => <option key={m} value={m}>{new Date(year, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long' })}</option>)}
        </select>
        <span className="text-neutral-500 text-sm capitalize">{monthLabel}</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="stat-label">Jogadores</p>
          <p className="text-2xl font-bold text-white tabular-nums mt-1">{totalCount}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Pagos</p>
          <p className="text-2xl font-bold text-green-400 tabular-nums mt-1">{paidCount}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Pendentes</p>
          <p className="text-2xl font-bold text-yellow-400 tabular-nums mt-1">{pendingCount}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Isentos</p>
          <p className="text-2xl font-bold text-neutral-400 tabular-nums mt-1">{totalExempt}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Esperado</p>
          <p className="text-xl font-bold text-white tabular-nums mt-1">R$ {totalExpected.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Recebido</p>
          <p className="text-xl font-bold text-green-400 tabular-nums mt-1">R$ {totalReceived.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Pendente</p>
          <p className="text-xl font-bold text-yellow-400 tabular-nums mt-1">R$ {totalPending.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="stat-label">Aproveit.</p>
          <p className="text-xl font-bold text-red-400 tabular-nums mt-1">{payPct}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap items-center">
        <select className="input w-auto" value={filterPlayer} onChange={e => setFilterPlayer(e.target.value)}>
          <option value="">Todos os jogadores</option>
          {players.map(p => <option key={p.id} value={p.id}>{p.apelido || p.nome}</option>)}
        </select>
        <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg">
          {(['all', 'pago', 'pendente', 'atrasado', 'isento'] as const).map(f => (
            <button key={f} onClick={() => setFilterStatus(f)} className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors', filterStatus === f ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white')}>
              {f === 'all' ? 'Todos' : f === 'pago' ? 'Pagos' : f === 'pendente' ? 'Pendentes' : f === 'atrasado' ? 'Atrasados' : 'Isentos'}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {gridRows.length === 0 ? (
        <EmptyState
          icon={<Wallet size={48} />}
          title="Sem mensalidades"
          description="Clique em 'Gerar Mês' para criar mensalidades para todos os jogadores ativos."
          action={<button onClick={generateMonth} disabled={generating} className="btn-primary"><Sparkles size={16} /> Gerar Mês</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          {/* Desktop table header */}
          <div className="hidden sm:grid grid-cols-[40px_1fr_100px_100px_1fr_100px] gap-3 px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 text-xs font-semibold text-neutral-500 uppercase tracking-wide">
            <div></div>
            <div>Jogador</div>
            <div className="text-right">Valor</div>
            <div>Vencimento</div>
            <div>Status</div>
            <div className="text-right">Ações</div>
          </div>
          <div className="divide-y divide-neutral-800/50">
            {gridRows.map(({ player, fee }) => {
              const overdue = isOverdue(fee);
              return (
                <div key={player.id} className="grid sm:grid-cols-[40px_1fr_100px_100px_1fr_100px] gap-3 px-4 py-3 items-center hover:bg-neutral-900/50 transition-colors">
                  {/* Checkbox */}
                  <button
                    onClick={() => fee && togglePaid(fee)}
                    disabled={!fee || fee.isento}
                    className={cn(
                      'w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0',
                      !fee ? 'bg-neutral-800/50 cursor-not-allowed opacity-30' :
                      fee.isento ? 'bg-neutral-800/50 cursor-not-allowed' :
                      fee.status === 'pago' ? 'bg-green-600 hover:bg-green-700' :
                      'bg-neutral-800 hover:bg-neutral-700 border border-neutral-700',
                    )}
                  >
                    {fee && fee.status === 'pago' && <CheckCircle size={16} className="text-white" />}
                  </button>

                  {/* Player name */}
                  <div className="min-w-0">
                    <p className="text-white text-sm font-medium truncate">{player.apelido || player.nome}</p>
                    {fee?.pago_em && <p className="text-green-400 text-xs">Pago em {formatDate(fee.pago_em)}</p>}
                    {fee?.observacao && <p className="text-neutral-500 text-xs truncate italic">"{fee.observacao}"</p>}
                  </div>

                  {/* Value */}
                  <div className="text-right">
                    {fee ? (
                      <span className={cn('text-sm font-bold tabular-nums', fee.isento ? 'text-neutral-600' : 'text-white')}>
                        {fee.isento ? 'Isento' : `R$ ${Number(fee.valor).toFixed(2)}`}
                      </span>
                    ) : (
                      <span className="text-neutral-600 text-xs">—</span>
                    )}
                  </div>

                  {/* Due date */}
                  <div className="text-neutral-500 text-xs">
                    {fee?.vencimento ? formatDate(fee.vencimento) : '—'}
                  </div>

                  {/* Status badge */}
                  <div>
                    {!fee ? (
                      <span className="badge border-neutral-700 text-neutral-600">Não gerada</span>
                    ) : fee.isento ? (
                      <span className="badge border-neutral-700 text-neutral-500">Isento</span>
                    ) : fee.status === 'pago' ? (
                      <span className="badge border-green-800/40 text-green-400">Pago</span>
                    ) : overdue ? (
                      <span className="badge border-red-800/40 text-red-400">Atrasado</span>
                    ) : (
                      <span className="badge border-yellow-800/40 text-yellow-400">Pendente</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    {fee && (
                      <>
                        <button onClick={() => { setNoteTarget(fee); setNoteText(fee.observacao || ''); }} className="btn-ghost p-1.5 text-neutral-500" title="Observação"><StickyNote size={14} /></button>
                        <button onClick={() => toggleExempt(fee)} className="btn-ghost p-1.5 text-neutral-500" title="Isentar"><Ban size={14} /></button>
                        <button onClick={() => openEdit(fee)} className="btn-ghost p-1.5 text-neutral-500" title="Editar"><Edit2 size={14} /></button>
                        <button onClick={() => deleteFee(fee)} className="btn-ghost p-1.5 text-neutral-500 hover:text-red-400" title="Excluir"><Trash2 size={14} /></button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={!!editTarget}
        onClose={() => { if (!savingEdit) setEditTarget(null); }}
        title="Editar Mensalidade"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setEditTarget(null)} className="btn-secondary flex-1" disabled={savingEdit}>Cancelar</button>
            <button onClick={saveEdit} className="btn-primary flex-1" disabled={savingEdit}>{savingEdit && <Loader2 size={14} className="animate-spin" />} Salvar</button>
          </div>
        }
      >
        {editTarget && (
          <div className="space-y-3">
            <p className="text-white font-medium">{editTarget.profiles?.apelido || editTarget.profiles?.nome}</p>
            <div><label className="label">Valor</label><input className="input" type="number" step="0.01" value={editForm.valor} onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} /></div>
            <div><label className="label">Vencimento</label><input className="input" type="date" value={editForm.vencimento} onChange={e => setEditForm(f => ({ ...f, vencimento: e.target.value }))} /></div>
            <div><label className="label">Observação</label><input className="input" value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} /></div>
            <div className="flex items-center gap-3">
              <label className="label mb-0">Isento</label>
              <button onClick={() => setEditForm(f => ({ ...f, isento: !f.isento }))} className={`relative w-11 h-6 rounded-full transition-colors ${editForm.isento ? 'bg-red-600' : 'bg-neutral-700'}`}>
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${editForm.isento ? 'translate-x-5' : ''}`} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Note Modal */}
      <Modal
        open={!!noteTarget}
        onClose={() => setNoteTarget(null)}
        title="Observação"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setNoteTarget(null)} className="btn-secondary flex-1">Cancelar</button>
            <button onClick={saveNote} className="btn-primary flex-1">Salvar</button>
          </div>
        }
      >
        <textarea className="input min-h-[80px]" placeholder="Adicione uma observação..." value={noteText} onChange={e => setNoteText(e.target.value)} autoFocus />
      </Modal>
    </div>
  );
}
