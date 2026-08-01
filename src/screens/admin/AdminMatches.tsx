import { useEffect, useState, useRef } from 'react';
import { supabase, Match, Season, Opponent, Competition } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { MatchCard } from '@/screens/public/PublicMatches';
import { MATCH_TYPES, cn } from '@/lib/utils';
import { Plus, Calendar, Trash2, Loader2, X, Shield, Trophy } from 'lucide-react';
import { COMP_TYPES, TYPE_LABELS } from '@/screens/admin/AdminCompetitions';

const empty = {
  opponent_id: '', adversario: '', logo_url: '',
  competition_id: '', competicao: '',
  segunda_competition_id: '', segunda_competicao: '',
  data: '', horario: '', local: '',
  tipo: 'Amistoso', observacoes: '',
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

  const [opponents, setOpponents] = useState<Opponent[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [showNewOpp, setShowNewOpp] = useState(false);
  const [showNewComp, setShowNewComp] = useState(false);
  const [newOppName, setNewOppName] = useState('');
  const [newCompName, setNewCompName] = useState('');
  const [newCompType, setNewCompType] = useState<Competition['type']>('Championship');
  const [creatingQuick, setCreatingQuick] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [seasonsRes, oppRes, compRes] = await Promise.all([
        supabase.from('seasons').select('*').order('ano', { ascending: false }),
        supabase.from('opponents').select('*').order('name', { ascending: true }),
        supabase.from('competitions').select('*').order('name', { ascending: true }),
      ]);
      const active = seasonsRes.data?.find(s => s.ativa) || seasonsRes.data?.[0] || null;
      setSeason(active);
      setOpponents((oppRes.data || []) as Opponent[]);
      setCompetitions((compRes.data || []) as Competition[]);
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
    setShowNewOpp(false);
    setShowNewComp(false);
    setModalOpen(true);
  }

  function openEdit(m: Match) {
    setEditing(m);
    setForm({
      opponent_id: m.opponent_id || '',
      adversario: m.adversario,
      logo_url: m.logo_url || '',
      competition_id: m.competition_id || '',
      competicao: m.competicao || '',
      segunda_competition_id: m.segunda_competition_id || '',
      segunda_competicao: m.segunda_competicao || '',
      data: m.data, horario: m.horario?.slice(0, 5) || '',
      local: m.local || '', tipo: m.tipo || 'Amistoso', observacoes: m.observacoes || '',
    });
    setShowSecondComp(!!m.segunda_competicao || !!m.segunda_competition_id);
    setShowNewOpp(false);
    setShowNewComp(false);
    setModalOpen(true);
  }

  function selectOpponent(id: string) {
    const o = opponents.find(x => x.id === id);
    setForm(f => ({
      ...f,
      opponent_id: id,
      adversario: o?.name || '',
      logo_url: o?.logo_url || '',
    }));
  }

  function selectCompetition(id: string, isSecond: boolean) {
    const c = competitions.find(x => x.id === id);
    if (isSecond) {
      setForm(f => ({ ...f, segunda_competition_id: id, segunda_competicao: c?.name || '' }));
    } else {
      setForm(f => ({ ...f, competition_id: id, competicao: c?.name || '' }));
    }
  }

  async function quickCreateOpponent() {
    if (!newOppName.trim()) { showToast('Nome é obrigatório', 'error'); return; }
    setCreatingQuick(true);
    try {
      const { data, error } = await supabase.from('opponents').insert({ name: newOppName.trim(), active: true }).select().single();
      if (error) throw error;
      showToast('Adversário criado!', 'success');
      const newOpp = data as Opponent;
      setOpponents(prev => [...prev, newOpp].sort((a, b) => a.name.localeCompare(b.name)));
      selectOpponent(newOpp.id);
      setNewOppName('');
      setShowNewOpp(false);
    } catch (e: any) {
      showToast(e.message || 'Erro ao criar', 'error');
    } finally {
      setCreatingQuick(false);
    }
  }

  async function quickCreateCompetition() {
    if (!newCompName.trim()) { showToast('Nome é obrigatório', 'error'); return; }
    setCreatingQuick(true);
    try {
      const { data, error } = await supabase.from('competitions').insert({ name: newCompName.trim(), type: newCompType, active: true }).select().single();
      if (error) throw error;
      showToast('Competição criada!', 'success');
      const newComp = data as Competition;
      setCompetitions(prev => [...prev, newComp].sort((a, b) => a.name.localeCompare(b.name)));
      if (showSecondComp) {
        selectCompetition(newComp.id, true);
      } else {
        selectCompetition(newComp.id, false);
      }
      setNewCompName('');
      setShowNewComp(false);
    } catch (e: any) {
      showToast(e.message || 'Erro ao criar', 'error');
    } finally {
      setCreatingQuick(false);
    }
  }

  async function handleSave() {
    if (!season) { showToast('Sem temporada ativa', 'error'); return; }
    if (!form.opponent_id && !form.adversario.trim()) { showToast('Selecione um adversário', 'error'); return; }
    if (!form.data) { showToast('Data é obrigatória', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        season_id: season.id,
        opponent_id: form.opponent_id || null,
        adversario: form.adversario.trim(),
        logo_url: form.logo_url.trim() || null,
        competition_id: form.competition_id || null,
        competicao: form.competicao.trim() || null,
        segunda_competition_id: showSecondComp ? (form.segunda_competition_id || null) : null,
        segunda_competicao: showSecondComp ? (form.segunda_competicao.trim() || null) : null,
        data: form.data,
        horario: form.horario || null,
        local: form.local.trim() || null,
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

  const activeOpponents = opponents.filter(o => o.active);
  const activeCompetitions = competitions.filter(c => c.active);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Jogos</h1>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Novo Jogo</button>
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
          {/* Opponent selector */}
          <div>
            <label className="label">Adversário *</label>
            {!showNewOpp ? (
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={form.opponent_id}
                  onChange={e => selectOpponent(e.target.value)}
                >
                  <option value="">Selecione o adversário</option>
                  {activeOpponents.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewOpp(true)}
                  className="btn-secondary text-xs whitespace-nowrap"
                >
                  <Plus size={14} /> Novo
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="input flex-1"
                  placeholder="Nome do adversário"
                  value={newOppName}
                  onChange={e => setNewOppName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={quickCreateOpponent}
                  disabled={creatingQuick}
                  className="btn-primary text-xs whitespace-nowrap"
                >
                  {creatingQuick ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
                </button>
                <button
                  type="button"
                  onClick={() => { setShowNewOpp(false); setNewOppName(''); }}
                  className="btn-ghost text-red-400"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {form.opponent_id && form.logo_url && (
              <div className="mt-2 flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-neutral-800 overflow-hidden">
                  <img src={form.logo_url} alt={form.adversario} className="w-full h-full object-contain p-0.5" />
                </div>
                <span className="text-neutral-400 text-xs">Logo carregado automaticamente</span>
              </div>
            )}
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

          {/* Competition selector */}
          <div>
            <label className="label">Competição</label>
            {!showNewComp ? (
              <div className="flex gap-2">
                <select
                  className="input flex-1"
                  value={form.competition_id}
                  onChange={e => selectCompetition(e.target.value, false)}
                >
                  <option value="">Selecione a competição</option>
                  {activeCompetitions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewComp(true)}
                  className="btn-secondary text-xs whitespace-nowrap"
                >
                  <Plus size={14} /> Nova
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    className="input flex-1"
                    placeholder="Nome da competição"
                    value={newCompName}
                    onChange={e => setNewCompName(e.target.value)}
                    autoFocus
                  />
                  <select
                    className="input w-32"
                    value={newCompType}
                    onChange={e => setNewCompType(e.target.value as Competition['type'])}
                  >
                    {COMP_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={quickCreateCompetition}
                    disabled={creatingQuick}
                    className="btn-primary text-xs whitespace-nowrap"
                  >
                    {creatingQuick ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Criar
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowNewComp(false); setNewCompName(''); }}
                    className="btn-ghost text-red-400"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
            {!showSecondComp && !showNewComp && (
              <button
                type="button"
                onClick={() => setShowSecondComp(true)}
                className="mt-2 text-red-500 text-sm font-medium hover:text-red-400 flex items-center gap-1"
              >
                <Plus size={14} /> Adicionar segunda competição
              </button>
            )}
            {showSecondComp && !showNewComp && (
              <div className="mt-2">
                <label className="label">Segunda competição</label>
                <div className="flex gap-2">
                  <select
                    className="input flex-1"
                    value={form.segunda_competition_id}
                    onChange={e => selectCompetition(e.target.value, true)}
                  >
                    <option value="">Selecione a segunda competição</option>
                    {activeCompetitions
                      .filter(c => c.id !== form.competition_id)
                      .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowNewComp(true)}
                    className="btn-secondary text-xs whitespace-nowrap"
                  >
                    <Plus size={14} /> Nova
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowSecondComp(false); setForm(f => ({ ...f, segunda_competition_id: '', segunda_competicao: '' })); }}
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
