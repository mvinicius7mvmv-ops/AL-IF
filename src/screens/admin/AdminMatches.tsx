import { useEffect, useState } from 'react';
import { supabase, Match, Season } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { MatchCard } from '@/screens/public/PublicMatches';
import { MATCH_TYPES, cn } from '@/lib/utils';
import { Plus, Calendar, Trash2, Loader2, X } from 'lucide-react';

const empty = {
  adversario: '', logo_url: '', data: '', horario: '', local: '',
  competicao: '', segunda_competicao: '', tipo: 'Amistoso', observacoes: '',
};

export function AdminMatches() {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [matches, setMatches] = useState<Match[]>([]);
  const [season, setSeason] = useState<Season | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<'upcoming' | 'completed' | 'cancelled'>('upcoming');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Match | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [showSecondComp, setShowSecondComp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      setSeason(active);
      if (!active) { setMatches([]); setLoading(false); return; }
      const { data, error: e } = await supabase
        .from('matches')
        .select('*')
        .eq('season_id', active.id)
        .order('data', { ascending: false });
      if (e) throw e;
      setMatches(data || []);
    } catch {
      setError('Não foi possível carregar os jogos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('novo') === '1') openNew();
  }, []);

  function openNew() {
    if (!season) { showToast('Crie uma temporada primeiro', 'error'); return; }
    setEditing(null);
    setForm({ ...empty });
    setShowSecondComp(false);
    setModalOpen(true);
  }

  function openEdit(m: Match) {
    setEditing(m);
    setForm({
      adversario: m.adversario, logo_url: m.logo_url || '', data: m.data, horario: m.horario?.slice(0, 5) || '',
      local: m.local || '', competicao: m.competicao || '', segunda_competicao: m.segunda_competicao || '',
      tipo: m.tipo || 'Amistoso', observacoes: m.observacoes || '',
    });
    setShowSecondComp(!!m.segunda_competicao);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!season) { showToast('Sem temporada ativa', 'error'); return; }
    if (!form.adversario.trim()) { showToast('Adversário é obrigatório', 'error'); return; }
    if (!form.data) { showToast('Data é obrigatória', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        season_id: season.id,
        adversario: form.adversario.trim(),
        logo_url: form.logo_url.trim() || null,
        data: form.data,
        horario: form.horario || null,
        local: form.local.trim() || null,
        competicao: form.competicao.trim() || null,
        segunda_competicao: showSecondComp ? (form.segunda_competicao.trim() || null) : null,
        tipo: form.tipo,
        observacoes: form.observacoes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (editing) {
        const { error } = await supabase.from('matches').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('Jogo atualizado!', 'success');
      } else {
        const { error } = await supabase.from('matches').insert({ ...payload, status: 'upcoming' });
        if (error) throw error;
        showToast('Jogo criado!', 'success');
      }
      setModalOpen(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar jogo', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const { error } = await supabase.from('matches').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Jogo excluído', 'success');
      load();
    } catch {
      showToast('Erro ao excluir jogo', 'error');
    }
  }

  const filtered = matches.filter(m => m.status === tab);
  const tabs: { key: typeof tab; label: string; count: number }[] = [
    { key: 'upcoming', label: 'Próximos', count: matches.filter(m => m.status === 'upcoming').length },
    { key: 'completed', label: 'Realizados', count: matches.filter(m => m.status === 'completed').length },
    { key: 'cancelled', label: 'Cancelados', count: matches.filter(m => m.status === 'cancelled').length },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Jogos</h1>
        <button onClick={openNew} className="btn-primary">
          <Plus size={16} /> Novo Jogo
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex-1 min-w-fit px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap',
              tab === t.key ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800',
            )}
          >
            {t.label} <span className="opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : !season ? (
        <EmptyState title="Sem temporada" description="Crie uma temporada antes de adicionar jogos." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Calendar size={48} />} title="Nenhum jogo" />
      ) : (
        <div className="space-y-3">
          {filtered.map(m => (
            <div key={m.id} className="relative group">
              <MatchCard match={m} onClick={() => navigate(`/admin/jogos/${m.id}`)} />
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => openEdit(m)} className="btn-secondary text-xs flex-1">Editar</button>
                <button onClick={() => setDeleteTarget(m)} className="btn-ghost text-xs text-red-400 hover:bg-red-900/20">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? 'Editar Jogo' : 'Novo Jogo'}
        size="lg"
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button onClick={handleSave} className="btn-primary flex-1" disabled={saving}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              {editing ? 'Salvar' : 'Criar jogo'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="label">Adversário *</label>
            <input className="input" value={form.adversario} onChange={e => setForm(f => ({ ...f, adversario: e.target.value }))} />
          </div>
          <div>
            <label className="label">URL do escudo do adversário (opcional)</label>
            <input className="input" placeholder="https://..." value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Data *</label>
              <input className="input" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="label">Horário</label>
              <input className="input" type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Local</label>
            <input className="input" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} />
          </div>
          <div>
            <label className="label">Competição</label>
            <input className="input" value={form.competicao} onChange={e => setForm(f => ({ ...f, competicao: e.target.value }))} />
            {!showSecondComp ? (
              <button
                type="button"
                onClick={() => setShowSecondComp(true)}
                className="mt-2 text-red-500 text-sm font-medium hover:text-red-400 flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar segunda competição
              </button>
            ) : (
              <div className="mt-2">
                <label className="label">Segunda competição</label>
                <div className="flex gap-2">
                  <input className="input" value={form.segunda_competicao} onChange={e => setForm(f => ({ ...f, segunda_competicao: e.target.value }))} placeholder="Ex.: Copa MS" />
                  <button
                    type="button"
                    onClick={() => { setShowSecondComp(false); setForm(f => ({ ...f, segunda_competicao: '' })); }}
                    className="btn-ghost text-red-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="label">Tipo de jogo</label>
            <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
              {MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input min-h-[80px]" value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir jogo"
        message={`Excluir o jogo contra ${deleteTarget?.adversario}? Todos os eventos, presenças e convidados serão removidos.`}
        confirmLabel="Excluir"
        danger
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
