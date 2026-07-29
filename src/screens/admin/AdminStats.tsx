import { useEffect, useState } from 'react';
import { supabase, Season, Profile, MatchEvent, ManualStatAdjustment } from '@/lib/supabase';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { cn } from '@/lib/utils';
import { Plus, Trash2, Edit2, Loader2, TrendingUp, Goal, Shirt, Calendar, Square, Star } from 'lucide-react';

interface PlayerStats {
  player: Profile;
  gols: number; golsAuto: number; golsAdj: number;
  assistencias: number; assistenciasAuto: number; assistenciasAdj: number;
  jogos: number; jogosAuto: number; jogosAdj: number;
  cartoesAmarelos: number; cartoesAmarelosAuto: number; cartoesAmarelosAdj: number;
  cartoesVermelhos: number; cartoesVermelhosAuto: number; cartoesVermelhosAdj: number;
  presenca: number; presencaAuto: number; presencaAdj: number;
  craque: number;
}

type StatTab = 'gols' | 'assistencias' | 'jogos' | 'cartoes_amarelos' | 'cartoes_vermelhos' | 'presenca' | 'craque';

export function AdminStats() {
  const { showToast } = useToast();
  const [season, setSeason] = useState<Season | null>(null);
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [adjustments, setAdjustments] = useState<(ManualStatAdjustment & { profiles?: { nome: string; apelido: string | null } })[]>([]);
  const [tab, setTab] = useState<StatTab>('gols');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManualStatAdjustment | null>(null);
  const [form, setForm] = useState({ player_id: '', tipo: 'gols' as ManualStatAdjustment['tipo'], valor: '1', motivo: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ManualStatAdjustment | null>(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: seasons } = await supabase.from('seasons').select('*').order('ano', { ascending: false });
      const active = seasons?.find(s => s.ativa) || seasons?.[0] || null;
      setSeason(active);
      if (!active) { setLoading(false); return; }

      const [eventsRes, adjsRes, playersRes, attRes, momRes] = await Promise.all([
        supabase.from('match_events').select('tipo, player_id, match_id, matches!inner(season_id)').eq('matches.season_id', active.id).not('player_id', 'is', null),
        supabase.from('manual_stat_adjustments').select('*, profiles(nome, apelido)').eq('season_id', active.id).order('criado_em', { ascending: false }),
        supabase.from('profiles').select('*').eq('status', 'active').order('nome'),
        supabase.from('match_attendance').select('player_id, matches!inner(season_id)').eq('matches.season_id', active.id).eq('resposta', 'vou'),
        supabase.from('matches').select('man_of_the_match_player_id').eq('season_id', active.id).eq('status', 'completed').not('man_of_the_match_player_id', 'is', null),
      ]);

      const events = eventsRes.data || [];
      const adjs = adjsRes.data || [];
      const profiles = playersRes.data || [];
      const attendance = attRes.data || [];
      const momAwards = momRes.data || [];
      setAdjustments(adjs as any);

      const map = new Map<string, PlayerStats>();
      profiles.forEach(p => {
        map.set(p.id, {
          player: p,
          gols: 0, golsAuto: 0, golsAdj: 0,
          assistencias: 0, assistenciasAuto: 0, assistenciasAdj: 0,
          jogos: 0, jogosAuto: 0, jogosAdj: 0,
          cartoesAmarelos: 0, cartoesAmarelosAuto: 0, cartoesAmarelosAdj: 0,
          cartoesVermelhos: 0, cartoesVermelhosAuto: 0, cartoesVermelhosAdj: 0,
          presenca: 0, presencaAuto: 0, presencaAdj: 0,
          craque: 0,
        });
      });

      const matchesByPlayer = new Map<string, Set<string>>();
      events.forEach((ev: any) => {
        const s = map.get(ev.player_id);
        if (!s) return;
        if (ev.tipo === 'gol') { s.golsAuto++; s.gols++; }
        else if (ev.tipo === 'assistencia') { s.assistenciasAuto++; s.assistencias++; }
        else if (ev.tipo === 'cartao_amarelo') { s.cartoesAmarelosAuto++; s.cartoesAmarelos++; }
        else if (ev.tipo === 'cartao_vermelho') { s.cartoesVermelhosAuto++; s.cartoesVermelhos++; }
        if (!matchesByPlayer.has(ev.player_id)) matchesByPlayer.set(ev.player_id, new Set());
        matchesByPlayer.get(ev.player_id)!.add(ev.match_id);
      });
      attendance.forEach((a: any) => {
        const s = map.get(a.player_id);
        if (s) { s.presencaAuto++; s.presenca++; }
        if (!matchesByPlayer.has(a.player_id)) matchesByPlayer.set(a.player_id, new Set());
        matchesByPlayer.get(a.player_id)!.add(a.match_id);
      });
      matchesByPlayer.forEach((set, pid) => {
        const s = map.get(pid);
        if (s) { s.jogosAuto = set.size; s.jogos = set.size; }
      });

      adjs.forEach((adj: any) => {
        const s = map.get(adj.player_id);
        if (!s) return;
        if (adj.tipo === 'gols') { s.golsAdj += adj.valor; s.gols += adj.valor; }
        else if (adj.tipo === 'assistencias') { s.assistenciasAdj += adj.valor; s.assistencias += adj.valor; }
        else if (adj.tipo === 'jogos') { s.jogosAdj += adj.valor; s.jogos += adj.valor; }
        else if (adj.tipo === 'cartoes_amarelos') { s.cartoesAmarelosAdj += adj.valor; s.cartoesAmarelos += adj.valor; }
        else if (adj.tipo === 'cartoes_vermelhos') { s.cartoesVermelhosAdj += adj.valor; s.cartoesVermelhos += adj.valor; }
        else if (adj.tipo === 'presenca') { s.presencaAdj += adj.valor; s.presenca += adj.valor; }
      });

      momAwards.forEach((m: any) => {
        const s = map.get(m.man_of_the_match_player_id);
        if (s) s.craque++;
      });

      setPlayers([...map.values()]);
    } catch {
      setError('Não foi possível carregar as estatísticas.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openNew() {
    setEditing(null);
    setForm({ player_id: '', tipo: tab === 'cartoes_amarelos' ? 'cartoes_amarelos' : tab === 'cartoes_vermelhos' ? 'cartoes_vermelhos' : tab, valor: '1', motivo: '' });
    setModalOpen(true);
  }
  function openEdit(adj: ManualStatAdjustment) {
    setEditing(adj);
    setForm({ player_id: adj.player_id, tipo: adj.tipo, valor: String(adj.valor), motivo: adj.motivo });
    setModalOpen(true);
  }

  async function save() {
    if (!season) return;
    if (!form.player_id) { showToast('Selecione um jogador', 'error'); return; }
    if (!form.motivo.trim()) { showToast('Motivo é obrigatório', 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        season_id: season.id,
        player_id: form.player_id,
        tipo: form.tipo,
        valor: Number(form.valor),
        motivo: form.motivo.trim(),
      };
      if (editing) {
        const { error } = await supabase.from('manual_stat_adjustments').update(payload).eq('id', editing.id);
        if (error) throw error;
        showToast('Ajuste atualizado', 'success');
      } else {
        const { error } = await supabase.from('manual_stat_adjustments').insert(payload);
        if (error) throw error;
        showToast('Ajuste criado', 'success');
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
      const { error } = await supabase.from('manual_stat_adjustments').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      showToast('Ajuste excluído', 'success');
      load();
    } catch {
      showToast('Erro ao excluir', 'error');
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const tabs: { key: StatTab; label: string; icon: React.ReactNode }[] = [
    { key: 'gols', label: 'Gols', icon: <Goal size={14} /> },
    { key: 'assistencias', label: 'Assistências', icon: <TrendingUp size={14} /> },
    { key: 'jogos', label: 'Jogos', icon: <Shirt size={14} /> },
    { key: 'presenca', label: 'Presença', icon: <Calendar size={14} /> },
    { key: 'craque', label: 'Craque', icon: <Star size={14} /> },
    { key: 'cartoes_amarelos', label: 'Amarelos', icon: <Square size={14} className="text-yellow-400" /> },
    { key: 'cartoes_vermelhos', label: 'Vermelhos', icon: <Square size={14} className="text-red-400" /> },
  ];

  const getValue = (s: PlayerStats, t: StatTab): { total: number; auto: number; adj: number } => {
    switch (t) {
      case 'gols': return { total: s.gols, auto: s.golsAuto, adj: s.golsAdj };
      case 'assistencias': return { total: s.assistencias, auto: s.assistenciasAuto, adj: s.assistenciasAdj };
      case 'jogos': return { total: s.jogos, auto: s.jogosAuto, adj: s.jogosAdj };
      case 'presenca': return { total: s.presenca, auto: s.presencaAuto, adj: s.presencaAdj };
      case 'craque': return { total: s.craque, auto: s.craque, adj: 0 };
      case 'cartoes_amarelos': return { total: s.cartoesAmarelos, auto: s.cartoesAmarelosAuto, adj: s.cartoesAmarelosAdj };
      case 'cartoes_vermelhos': return { total: s.cartoesVermelhos, auto: s.cartoesVermelhosAuto, adj: s.cartoesVermelhosAdj };
    }
  };

  const ranked = players
    .map(s => ({ s, v: getValue(s, tab) }))
    .filter(x => x.v.total > 0)
    .sort((a, b) => b.v.total - a.v.total);

  const tipoLabels: Record<string, string> = {
    gols: 'Gols', assistencias: 'Assistências', jogos: 'Jogos', presenca: 'Presença',
    cartoes_amarelos: 'Cartões Amarelos', cartoes_vermelhos: 'Cartões Vermelhos',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Estatísticas</h1>
        <button onClick={openNew} className="btn-primary"><Plus size={16} /> Ajuste Manual</button>
      </div>
      {season && <p className="text-neutral-500 text-sm -mt-2">{season.nome}</p>}

      <div className="flex gap-1 p-1 bg-neutral-900 border border-neutral-800 rounded-lg overflow-x-auto no-scrollbar">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={cn('flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-colors whitespace-nowrap', tab === t.key ? 'bg-red-600 text-white' : 'text-neutral-400 hover:text-white hover:bg-neutral-800')}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {ranked.length === 0 ? (
        <EmptyState title="Sem dados" description="Nenhum registro nesta categoria." />
      ) : (
        <div className="card divide-y divide-neutral-800">
          {ranked.map(({ s, v }, i) => (
            <div key={s.player.id} className="flex items-center gap-3 p-3">
              <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0', i === 0 ? 'bg-yellow-500 text-black' : i === 1 ? 'bg-neutral-400 text-black' : i === 2 ? 'bg-amber-700 text-white' : 'bg-neutral-800 text-neutral-400')}>{i + 1}</div>
              <div className="w-9 h-9 rounded-full bg-neutral-800 overflow-hidden shrink-0">
                {s.player.foto_url ? <img src={s.player.foto_url} alt={s.player.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-neutral-600 font-bold">{(s.player.apelido || s.player.nome).charAt(0).toUpperCase()}</div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{s.player.apelido || s.player.nome}</p>
                <p className="text-neutral-500 text-xs">
                  Auto: {v.auto}
                  {v.adj !== 0 && <span className={v.adj > 0 ? 'text-blue-400' : 'text-red-400'}> · Ajuste: {v.adj > 0 ? '+' : ''}{v.adj}</span>}
                </p>
              </div>
              <p className="text-xl font-bold text-red-500 tabular-nums">{v.total}</p>
            </div>
          ))}
        </div>
      )}

      {/* Manual adjustments list */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wide mb-3">Ajustes Manuais</h2>
        {adjustments.length === 0 ? (
          <EmptyState title="Sem ajustes" description="Clique em 'Ajuste Manual' para criar." />
        ) : (
          <div className="space-y-2">
            {adjustments.map(adj => (
              <div key={adj.id} className="card p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">
                    {adj.profiles?.apelido || adj.profiles?.nome || '—'} · {tipoLabels[adj.tipo]}
                  </p>
                  <p className="text-neutral-500 text-xs truncate">{adj.motivo}</p>
                </div>
                <span className={cn('text-sm font-bold tabular-nums', adj.valor > 0 ? 'text-green-400' : 'text-red-400')}>{adj.valor > 0 ? '+' : ''}{adj.valor}</span>
                <button onClick={() => openEdit(adj)} className="text-neutral-500 hover:text-white"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteTarget(adj)} className="text-neutral-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => { if (!saving) setModalOpen(false); }}
        title={editing ? 'Editar Ajuste' : 'Novo Ajuste Manual'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1" disabled={saving}>Cancelar</button>
            <button onClick={save} className="btn-primary flex-1" disabled={saving}>{saving && <Loader2 size={16} className="animate-spin" />} Salvar</button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Jogador</label>
            <select className="input" value={form.player_id} onChange={e => setForm(f => ({ ...f, player_id: e.target.value }))}>
              <option value="">Selecione</option>
              {players.map(p => <option key={p.player.id} value={p.player.id}>{p.player.apelido || p.player.nome}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}>
              <option value="gols">Gols</option>
              <option value="assistencias">Assistências</option>
              <option value="jogos">Jogos</option>
              <option value="presenca">Presença</option>
              <option value="cartoes_amarelos">Cartões Amarelos</option>
              <option value="cartoes_vermelhos">Cartões Vermelhos</option>
            </select>
          </div>
          <div>
            <label className="label">Valor (use negativo para subtrair)</label>
            <input className="input" type="number" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
          </div>
          <div>
            <label className="label">Motivo *</label>
            <textarea className="input min-h-[60px]" placeholder="Ex.: Gol não registrado no jogo do dia..." value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))} />
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Excluir ajuste"
        message="Excluir este ajuste manual?"
        confirmLabel="Excluir"
        danger
        onConfirm={del}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
