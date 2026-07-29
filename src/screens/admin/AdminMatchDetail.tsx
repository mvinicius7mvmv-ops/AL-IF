import { useEffect, useState } from 'react';
import { supabase, Match, MatchEvent, Guest, MatchAttendance, Profile } from '@/lib/supabase';
import { useRouter } from '@/contexts/RouterContext';
import { useToast } from '@/contexts/ToastContext';
import { Modal, ConfirmModal } from '@/components/Modal';
import { Loading, EmptyState, ErrorState } from '@/components/States';
import { Crest } from '@/components/Crest';
import { StatusBadge, EventIcon, eventTypeLabel } from '@/components/Badges';
import { formatDate, cn } from '@/lib/utils';
import {
  ArrowLeft, Calendar, Clock, MapPin, Trophy, Shirt, Edit2, Save,
  Plus, Trash2, Share2, Copy, Users, UserPlus, Check, X, Loader2,
  CheckCircle, AlertCircle, HelpCircle, Goal, Star,
} from 'lucide-react';

export function AdminMatchDetail({ matchId }: { matchId: string }) {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [match, setMatch] = useState<Match | null>(null);
  const [events, setEvents] = useState<(MatchEvent & { profiles?: { nome: string; apelido: string | null } | null; guests?: { nome: string } | null })[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [attendance, setAttendance] = useState<(MatchAttendance & { profiles: { nome: string; apelido: string | null; foto_url: string | null } })[]>([]);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editInfo, setEditInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ ...({} as Partial<Match>) });
  const [showSecondComp, setShowSecondComp] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);

  const [scoreForm, setScoreForm] = useState({ gols_alif: '', gols_adversario: '' });
  const [savingScore, setSavingScore] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'finalize' | 'cancel' | 'reopen' | 'delete'; label: string; message: string } | null>(null);

  const [eventModal, setEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MatchEvent | null>(null);
  const [eventForm, setEventForm] = useState({ tipo: 'gol' as MatchEvent['tipo'], minuto: '', player_id: '', guest_id: '', observacao: '' });
  const [savingEvent, setSavingEvent] = useState(false);
  const [deleteEventTarget, setDeleteEventTarget] = useState<MatchEvent | null>(null);

  const [guestModal, setGuestModal] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [guestForm, setGuestForm] = useState({ nome: '', posicao: '', observacao: '', presenca: 'nao_confirmado' as Guest['presenca'] });
  const [savingGuest, setSavingGuest] = useState(false);
  const [deleteGuestTarget, setDeleteGuestTarget] = useState<Guest | null>(null);

  const [momPlayerId, setMomPlayerId] = useState('');
  const [editMom, setEditMom] = useState(false);
  const [savingMom, setSavingMom] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data: m } = await supabase.from('matches').select('*').eq('id', matchId).maybeSingle();
      if (!m) { setError('Jogo não encontrado.'); setLoading(false); return; }
      setMatch(m as Match);
      setInfoForm(m as Match);
      setShowSecondComp(!!(m as Match).segunda_competicao);
      setMomPlayerId((m as Match).man_of_the_match_player_id || '');
      setScoreForm({
        gols_alif: (m as Match).gols_alif != null ? String((m as Match).gols_alif) : '',
        gols_adversario: (m as Match).gols_adversario != null ? String((m as Match).gols_adversario) : '',
      });

      const [evRes, gRes, aRes, pRes] = await Promise.all([
        supabase.from('match_events').select('*, profiles(nome, apelido), guests(nome)').eq('match_id', matchId).order('minuto', { ascending: true, nullsFirst: true }),
        supabase.from('guests').select('*').eq('match_id', matchId).order('nome'),
        supabase.from('match_attendance').select('*, profiles(nome, apelido, foto_url)').eq('match_id', matchId),
        supabase.from('profiles').select('*').eq('status', 'active').order('nome'),
      ]);
      setEvents(evRes.data || []);
      setGuests(gRes.data || []);
      setAttendance(aRes.data || []);
      setPlayers(pRes.data || []);
    } catch {
      setError('Não foi possível carregar o jogo.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [matchId]);

  async function saveInfo() {
    if (!match) return;
    setSavingInfo(true);
    try {
      const { error } = await supabase.from('matches').update({
        adversario: infoForm.adversario,
        logo_url: infoForm.logo_url || null,
        data: infoForm.data,
        horario: infoForm.horario || null,
        local: infoForm.local || null,
        competicao: infoForm.competicao || null,
        segunda_competicao: showSecondComp ? (infoForm.segunda_competicao || null) : null,
        tipo: infoForm.tipo,
        observacoes: infoForm.observacoes || null,
        updated_at: new Date().toISOString(),
      }).eq('id', match.id);
      if (error) throw error;
      showToast('Informações salvas!', 'success');
      setEditInfo(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSavingInfo(false);
    }
  }

  async function saveScore(finalize?: boolean) {
    if (!match) return;
    setSavingScore(true);
    try {
      const payload: any = {
        gols_alif: scoreForm.gols_alif !== '' ? Number(scoreForm.gols_alif) : null,
        gols_adversario: scoreForm.gols_adversario !== '' ? Number(scoreForm.gols_adversario) : null,
        updated_at: new Date().toISOString(),
      };
      if (finalize) payload.status = 'completed';
      const { error } = await supabase.from('matches').update(payload).eq('id', match.id);
      if (error) throw error;
      showToast(finalize ? 'Jogo finalizado!' : 'Resultado salvo sem finalizar!', 'success');
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSavingScore(false);
    }
  }

  async function changeStatus(newStatus: 'upcoming' | 'completed' | 'cancelled') {
    if (!match) return;
    try {
      const { error } = await supabase.from('matches').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', match.id);
      if (error) throw error;
      showToast(newStatus === 'cancelled' ? 'Jogo cancelado' : newStatus === 'completed' ? 'Jogo finalizado' : 'Jogo reaberto', 'success');
      load();
    } catch {
      showToast('Erro ao alterar status', 'error');
    }
  }

  async function handleConfirmAction() {
    if (!confirmAction || !match) return;
    if (confirmAction.type === 'finalize') await saveScore(true);
    else if (confirmAction.type === 'cancel') await changeStatus('cancelled');
    else if (confirmAction.type === 'reopen') await changeStatus('upcoming');
    else if (confirmAction.type === 'delete') {
      const { error } = await supabase.from('matches').delete().eq('id', match.id);
      if (error) { showToast('Erro ao excluir', 'error'); return; }
      showToast('Jogo excluído', 'success');
      navigate('/admin/jogos');
    }
  }

  // Events
  function openNewEvent() {
    setEditingEvent(null);
    setEventForm({ tipo: 'gol', minuto: '', player_id: '', guest_id: '', observacao: '' });
    setEventModal(true);
  }
  function openEditEvent(ev: MatchEvent) {
    setEditingEvent(ev);
    setEventForm({
      tipo: ev.tipo, minuto: ev.minuto != null ? String(ev.minuto) : '',
      player_id: ev.player_id || '', guest_id: ev.guest_id || '', observacao: ev.observacao || '',
    });
    setEventModal(true);
  }
  async function saveEvent() {
    if (!match) return;
    if (!eventForm.player_id && !eventForm.guest_id) { showToast('Selecione um jogador ou convidado', 'error'); return; }
    setSavingEvent(true);
    try {
      const payload = {
        match_id: match.id,
        tipo: eventForm.tipo,
        minuto: eventForm.minuto ? Number(eventForm.minuto) : null,
        player_id: eventForm.player_id || null,
        guest_id: eventForm.guest_id || null,
        observacao: eventForm.observacao || null,
      };
      if (editingEvent) {
        const { error } = await supabase.from('match_events').update(payload).eq('id', editingEvent.id);
        if (error) throw error;
        showToast('Evento atualizado', 'success');
      } else {
        const { error } = await supabase.from('match_events').insert(payload);
        if (error) throw error;
        showToast('Evento adicionado', 'success');
      }
      setEventModal(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar evento', 'error');
    } finally {
      setSavingEvent(false);
    }
  }
  async function deleteEvent() {
    if (!deleteEventTarget) return;
    try {
      const { error } = await supabase.from('match_events').delete().eq('id', deleteEventTarget.id);
      if (error) throw error;
      showToast('Evento excluído', 'success');
      load();
    } catch {
      showToast('Erro ao excluir evento', 'error');
    }
  }

  // Guests
  function openNewGuest() {
    setEditingGuest(null);
    setGuestForm({ nome: '', posicao: '', observacao: '', presenca: 'nao_confirmado' });
    setGuestModal(true);
  }
  function openEditGuest(g: Guest) {
    setEditingGuest(g);
    setGuestForm({ nome: g.nome, posicao: g.posicao || '', observacao: g.observacao || '', presenca: g.presenca || 'nao_confirmado' });
    setGuestModal(true);
  }
  async function saveGuest() {
    if (!match) return;
    if (!guestForm.nome.trim()) { showToast('Nome é obrigatório', 'error'); return; }
    setSavingGuest(true);
    try {
      const payload = {
        match_id: match.id,
        nome: guestForm.nome.trim(),
        posicao: guestForm.posicao.trim() || null,
        observacao: guestForm.observacao.trim() || null,
        presenca: guestForm.presenca,
      };
      if (editingGuest) {
        const { error } = await supabase.from('guests').update(payload).eq('id', editingGuest.id);
        if (error) throw error;
        showToast('Convidado atualizado', 'success');
      } else {
        const { error } = await supabase.from('guests').insert(payload);
        if (error) throw error;
        showToast('Convidado adicionado', 'success');
      }
      setGuestModal(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar convidado', 'error');
    } finally {
      setSavingGuest(false);
    }
  }
  async function deleteGuest() {
    if (!deleteGuestTarget) return;
    try {
      const { error } = await supabase.from('guests').delete().eq('id', deleteGuestTarget.id);
      if (error) throw error;
      showToast('Convidado removido', 'success');
      load();
    } catch {
      showToast('Erro ao remover convidado', 'error');
    }
  }

  // Man of the Match
  async function saveMom() {
    if (!match) return;
    setSavingMom(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ man_of_the_match_player_id: momPlayerId || null, updated_at: new Date().toISOString() })
        .eq('id', match.id);
      if (error) throw error;
      showToast('Craque da Partida salvo!', 'success');
      setEditMom(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao salvar', 'error');
    } finally {
      setSavingMom(false);
    }
  }

  async function removeMom() {
    if (!match) return;
    setSavingMom(true);
    try {
      const { error } = await supabase
        .from('matches')
        .update({ man_of_the_match_player_id: null, updated_at: new Date().toISOString() })
        .eq('id', match.id);
      if (error) throw error;
      showToast('Craque da Partida removido', 'success');
      setMomPlayerId('');
      setEditMom(false);
      load();
    } catch (e: any) {
      showToast(e.message || 'Erro ao remover', 'error');
    } finally {
      setSavingMom(false);
    }
  }

  // Share
  async function handleShare() {
    if (!match) return;
    const link = `${window.location.origin}/entrar?match=${match.id}`;
    const msg = `AL-IF FC\nPróximo jogo\nAdversário: ${match.adversario}\nData: ${formatDate(match.data)}\nHorário: ${match.horario?.slice(0,5) || 'A definir'}\nLocal: ${match.local || 'A definir'}\nCompetição: ${match.competicao || '-'}\nConfirme sua presença: ${link}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'AL-IF FC', text: msg, url: link }); } catch {}
    } else {
      navigator.clipboard.writeText(msg);
      showToast('Mensagem copiada!', 'success');
    }
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!match) return null;

  const attendanceByStatus = {
    vou: attendance.filter(a => a.resposta === 'vou'),
    nao_vou: attendance.filter(a => a.resposta === 'nao_vou'),
    talvez: attendance.filter(a => a.resposta === 'talvez'),
  };
  const respondedIds = new Set(attendance.map(a => a.player_id));
  const noResponse = players.filter(p => !respondedIds.has(p.id));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <button onClick={() => navigate('/admin/jogos')} className="btn-ghost -ml-2">
          <ArrowLeft size={18} /> Voltar
        </button>
        <div className="flex gap-2">
          {match.status === 'upcoming' && (
            <button onClick={handleShare} className="btn-secondary text-sm">
              <Share2 size={14} /> Compartilhar presença
            </button>
          )}
        </div>
      </div>

      {/* Match header */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <StatusBadge status={match.status} />
          <button onClick={() => setEditInfo(!editInfo)} className="btn-ghost text-xs">
            <Edit2 size={14} /> {editInfo ? 'Cancelar' : 'Editar info'}
          </button>
        </div>

        {!editInfo ? (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <Crest size={56} />
                <p className="text-white font-bold text-sm text-center truncate w-full">AL-IF FC</p>
              </div>
              <div className="px-3 py-2 rounded-xl bg-neutral-800 shrink-0">
                {match.status === 'completed' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-3xl font-bold text-white tabular-nums">{match.gols_alif ?? 0}</span>
                    <span className="text-neutral-600 text-sm">x</span>
                    <span className="text-3xl font-bold text-white tabular-nums">{match.gols_adversario ?? 0}</span>
                  </div>
                ) : match.status === 'cancelled' ? (
                  <span className="text-neutral-500 text-sm font-medium px-2">CANCELADO</span>
                ) : (
                  <span className="text-neutral-400 text-sm font-medium px-2">VS</span>
                )}
              </div>
              <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
                <div className="w-14 h-14 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center overflow-hidden shrink-0">
                  {match.logo_url ? <img src={match.logo_url} alt={match.adversario} className="w-full h-full object-contain p-1" /> : <Shirt size={24} className="text-neutral-600" />}
                </div>
                <p className="text-white font-bold text-sm text-center truncate w-full">{match.adversario}</p>
              </div>
            </div>
            <div className="mt-5 pt-5 border-t border-neutral-800 grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-neutral-300"><Calendar size={14} className="text-red-500" /> {formatDate(match.data)}</div>
              {match.horario && <div className="flex items-center gap-2 text-neutral-300"><Clock size={14} className="text-red-500" /> {match.horario.slice(0,5)}</div>}
              {match.local && <div className="flex items-center gap-2 text-neutral-300 col-span-2"><MapPin size={14} className="text-red-500" /> {match.local}</div>}
            </div>
            {(match.competicao || match.segunda_competicao) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {match.competicao && <span className="badge bg-red-600/15 text-red-400 border border-red-800/40"><Trophy size={12} /> {match.competicao}</span>}
                {match.segunda_competicao && <span className="badge bg-neutral-800 text-neutral-300 border border-neutral-700"><Trophy size={12} /> {match.segunda_competicao}</span>}
              </div>
            )}
            {match.observacoes && <div className="mt-3 p-3 rounded-lg bg-neutral-800/50 text-neutral-400 text-sm">{match.observacoes}</div>}
          </>
        ) : (
          <div className="space-y-3">
            <div><label className="label">Adversário</label><input className="input" value={infoForm.adversario || ''} onChange={e => setInfoForm(f => ({ ...f, adversario: e.target.value }))} /></div>
            <div><label className="label">URL do escudo</label><input className="input" value={infoForm.logo_url || ''} onChange={e => setInfoForm(f => ({ ...f, logo_url: e.target.value }))} /></div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><label className="label">Data</label><input className="input" type="date" value={infoForm.data || ''} onChange={e => setInfoForm(f => ({ ...f, data: e.target.value }))} /></div>
              <div><label className="label">Horário</label><input className="input" type="time" value={infoForm.horario?.slice(0,5) || ''} onChange={e => setInfoForm(f => ({ ...f, horario: e.target.value }))} /></div>
            </div>
            <div><label className="label">Local</label><input className="input" value={infoForm.local || ''} onChange={e => setInfoForm(f => ({ ...f, local: e.target.value }))} /></div>
            <div>
              <label className="label">Competição</label>
              <input className="input" value={infoForm.competicao || ''} onChange={e => setInfoForm(f => ({ ...f, competicao: e.target.value }))} />
              {!showSecondComp ? (
                <button type="button" onClick={() => setShowSecondComp(true)} className="mt-2 text-red-500 text-sm font-medium flex items-center gap-1"><Plus size={14} /> Adicionar segunda competição</button>
              ) : (
                <div className="mt-2">
                  <label className="label">Segunda competição</label>
                  <div className="flex gap-2">
                    <input className="input" value={infoForm.segunda_competicao || ''} onChange={e => setInfoForm(f => ({ ...f, segunda_competicao: e.target.value }))} />
                    <button type="button" onClick={() => { setShowSecondComp(false); setInfoForm(f => ({ ...f, segunda_competicao: null })); }} className="btn-ghost text-red-400"><X size={16} /></button>
                  </div>
                </div>
              )}
            </div>
            <div><label className="label">Tipo</label><input className="input" value={infoForm.tipo || ''} onChange={e => setInfoForm(f => ({ ...f, tipo: e.target.value }))} /></div>
            <div><label className="label">Observações</label><textarea className="input min-h-[60px]" value={infoForm.observacoes || ''} onChange={e => setInfoForm(f => ({ ...f, observacoes: e.target.value }))} /></div>
            <button onClick={saveInfo} className="btn-primary w-full" disabled={savingInfo}>
              {savingInfo && <Loader2 size={16} className="animate-spin" />} Salvar informações
            </button>
          </div>
        )}
      </div>

      {/* Result + actions */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-white mb-4">Resultado & Status</h2>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label">AL-IF FC</label>
            <input className="input text-center text-2xl font-bold tabular-nums" type="number" min="0" placeholder="0" value={scoreForm.gols_alif} onChange={e => setScoreForm(f => ({ ...f, gols_alif: e.target.value }))} />
          </div>
          <div>
            <label className="label">{match.adversario}</label>
            <input className="input text-center text-2xl font-bold tabular-nums" type="number" min="0" placeholder="0" value={scoreForm.gols_adversario} onChange={e => setScoreForm(f => ({ ...f, gols_adversario: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => saveScore(false)} className="btn-secondary text-sm" disabled={savingScore}>
            <Save size={14} /> Salvar sem finalizar
          </button>
          {match.status !== 'completed' && (
            <button onClick={() => setConfirmAction({ type: 'finalize', label: 'Finalizar jogo', message: 'Finalizar o jogo moverá para "Realizados" e atualizará as estatísticas. Continuar?' })} className="btn-primary text-sm" disabled={savingScore}>
              <CheckCircle size={14} /> Finalizar jogo
            </button>
          )}
          {match.status !== 'cancelled' && (
            <button onClick={() => setConfirmAction({ type: 'cancel', label: 'Cancelar jogo', message: 'Cancelar este jogo? Ele será movido para "Cancelados".' })} className="btn-secondary text-sm text-red-400 hover:bg-red-900/20">
              <X size={14} /> Cancelar jogo
            </button>
          )}
          {match.status === 'cancelled' && (
            <button onClick={() => setConfirmAction({ type: 'reopen', label: 'Reabrir jogo', message: 'Reabrir este jogo? Ele voltará para "Próximos".' })} className="btn-primary text-sm">
              <CheckCircle size={14} /> Reabrir jogo
            </button>
          )}
          <button onClick={() => setConfirmAction({ type: 'delete', label: 'Excluir jogo', message: 'Excluir permanentemente este jogo e todos os dados relacionados?' })} className="btn-ghost text-sm text-red-400 hover:bg-red-900/20 col-span-2">
            <Trash2 size={14} /> Excluir jogo
          </button>
        </div>
      </div>

      {/* Events */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Eventos</h2>
          <button onClick={openNewEvent} className="btn-primary text-xs"><Plus size={14} /> Adicionar</button>
        </div>
        {events.length === 0 ? (
          <EmptyState title="Sem eventos" description="Adicione gols, assistências e cartões." />
        ) : (
          <div className="space-y-2">
            {events.map(ev => {
              const name = ev.profiles?.apelido || ev.profiles?.nome || ev.guests?.nome || '—';
              return (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50">
                  <div className="text-neutral-500 text-sm font-mono w-10 text-center shrink-0">{ev.minuto != null ? `${ev.minuto}'` : '-'}</div>
                  <EventIcon tipo={ev.tipo} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{name}</p>
                    {!ev.player_id && ev.guest_id && <p className="text-neutral-500 text-xs">Convidado</p>}
                  </div>
                  <span className="text-xs text-neutral-400 shrink-0">{eventTypeLabel(ev.tipo)}</span>
                  <button onClick={() => openEditEvent(ev)} className="text-neutral-500 hover:text-white"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleteEventTarget(ev)} className="text-neutral-500 hover:text-red-400"><Trash2 size={14} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Man of the Match */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2"><Star size={18} className="text-yellow-400" /> Craque da Partida</h2>
        </div>
        {!editMom ? (
          match.man_of_the_match_player_id ? (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-neutral-800/50">
              {(() => {
                const p = players.find(pl => pl.id === match.man_of_the_match_player_id);
                if (!p) return <p className="text-neutral-500 text-sm">Jogador não encontrado</p>;
                return (
                  <>
                    <div className="w-12 h-12 rounded-full bg-neutral-700 overflow-hidden shrink-0 border-2 border-yellow-400/50">
                      {p.foto_url ? <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-lg font-bold text-neutral-600">{(p.apelido || p.nome).charAt(0).toUpperCase()}</div>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold truncate">{p.apelido || p.nome}</p>
                      {p.numero && <p className="text-neutral-500 text-xs">#{p.numero}</p>}
                    </div>
                    <Star size={20} className="text-yellow-400 shrink-0" />
                  </>
                );
              })()}
              <div className="flex gap-2 shrink-0">
                <button onClick={() => { setMomPlayerId(match.man_of_the_match_player_id || ''); setEditMom(true); }} className="btn-ghost text-xs"><Edit2 size={14} /> Editar</button>
                <button onClick={removeMom} className="btn-ghost text-xs text-red-400" disabled={savingMom}>{savingMom ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Remover</button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 rounded-lg bg-neutral-800/50">
              <p className="text-neutral-500 text-sm">Nenhum craque selecionado</p>
              <button onClick={() => { setMomPlayerId(''); setEditMom(true); }} className="btn-primary text-xs"><Star size={14} /> Selecionar</button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            <p className="text-neutral-400 text-sm">Selecione o Craque da Partida</p>
            <select className="input" value={momPlayerId} onChange={e => setMomPlayerId(e.target.value)}>
              <option value="">— Selecione um jogador —</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.apelido || p.nome} {p.numero ? `#${p.numero}` : ''}</option>)}
            </select>
            <div className="flex gap-2">
              <button onClick={() => setEditMom(false)} className="btn-secondary text-sm flex-1" disabled={savingMom}>Cancelar</button>
              <button onClick={saveMom} className="btn-primary text-sm flex-1" disabled={savingMom}>{savingMom && <Loader2 size={14} className="animate-spin" />} Salvar</button>
            </div>
          </div>
        )
      }
      </div>

      {/* Attendance */}
      <div className="card p-5">
        <h2 className="text-base font-bold text-white mb-4">Presenças</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <AttendanceList icon={<CheckCircle size={16} className="text-green-400" />} title="Confirmados" list={attendanceByStatus.vou} color="green" />
          <AttendanceList icon={<X size={16} className="text-red-400" />} title="Não vão" list={attendanceByStatus.nao_vou} color="red" />
          <AttendanceList icon={<HelpCircle size={16} className="text-yellow-400" />} title="Talvez" list={attendanceByStatus.talvez} color="yellow" />
          <AttendanceList icon={<Users size={16} className="text-neutral-400" />} title="Sem resposta" list={noResponse.map(p => ({ profiles: p }))} color="neutral" />
        </div>
      </div>

      {/* Guests */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">Convidados</h2>
          <button onClick={openNewGuest} className="btn-primary text-xs"><UserPlus size={14} /> Adicionar</button>
        </div>
        {guests.length === 0 ? (
          <EmptyState title="Sem convidados" />
        ) : (
          <div className="space-y-2">
            {guests.map(g => (
              <div key={g.id} className="flex items-center gap-3 p-3 rounded-lg bg-neutral-800/50">
                <div className="w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
                  {g.nome.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{g.nome}</p>
                  {g.posicao && <p className="text-neutral-500 text-xs">{g.posicao}</p>}
                </div>
                <span className={cn(
                  'badge shrink-0',
                  g.presenca === 'confirmado' ? 'bg-green-500/15 text-green-400 border border-green-800/40'
                    : g.presenca === 'talvez' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-800/40'
                    : 'bg-neutral-800 text-neutral-400',
                )}>{g.presenca === 'confirmado' ? 'Confirmado' : g.presenca === 'talvez' ? 'Talvez' : 'Pendente'}</span>
                <button onClick={() => openEditGuest(g)} className="text-neutral-500 hover:text-white"><Edit2 size={14} /></button>
                <button onClick={() => setDeleteGuestTarget(g)} className="text-neutral-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Event Modal */}
      <Modal
        open={eventModal}
        onClose={() => { if (!savingEvent) setEventModal(false); }}
        title={editingEvent ? 'Editar Evento' : 'Novo Evento'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setEventModal(false)} className="btn-secondary flex-1" disabled={savingEvent}>Cancelar</button>
            <button onClick={saveEvent} className="btn-primary flex-1" disabled={savingEvent}>
              {savingEvent && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div>
            <label className="label">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {(['gol','assistencia','cartao_amarelo','cartao_vermelho'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setEventForm(f => ({ ...f, tipo: t }))}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors',
                    eventForm.tipo === t ? 'bg-red-600 text-white border-red-600' : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:border-neutral-600',
                  )}
                >
                  <EventIcon tipo={t} /> {eventTypeLabel(t)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Minuto</label>
            <input className="input" type="number" min="0" max="120" placeholder="Ex.: 35" value={eventForm.minuto} onChange={e => setEventForm(f => ({ ...f, minuto: e.target.value }))} />
          </div>
          <div>
            <label className="label">Jogador</label>
            <select className="input" value={eventForm.player_id} onChange={e => setEventForm(f => ({ ...f, player_id: e.target.value, guest_id: '' }))}>
              <option value="">— Nenhum —</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.apelido || p.nome} {p.numero ? `#${p.numero}` : ''}</option>)}
            </select>
          </div>
          {guests.length > 0 && (
            <div>
              <label className="label">Ou convidado</label>
              <select className="input" value={eventForm.guest_id} onChange={e => setEventForm(f => ({ ...f, guest_id: e.target.value, player_id: '' }))}>
                <option value="">— Nenhum —</option>
                {guests.map(g => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Observação</label>
            <input className="input" value={eventForm.observacao} onChange={e => setEventForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Guest Modal */}
      <Modal
        open={guestModal}
        onClose={() => { if (!savingGuest) setGuestModal(false); }}
        title={editingGuest ? 'Editar Convidado' : 'Novo Convidado'}
        footer={
          <div className="flex gap-3">
            <button onClick={() => setGuestModal(false)} className="btn-secondary flex-1" disabled={savingGuest}>Cancelar</button>
            <button onClick={saveGuest} className="btn-primary flex-1" disabled={savingGuest}>
              {savingGuest && <Loader2 size={16} className="animate-spin" />} Salvar
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <div><label className="label">Nome *</label><input className="input" value={guestForm.nome} onChange={e => setGuestForm(f => ({ ...f, nome: e.target.value }))} /></div>
          <div><label className="label">Posição</label><input className="input" value={guestForm.posicao} onChange={e => setGuestForm(f => ({ ...f, posicao: e.target.value }))} /></div>
          <div>
            <label className="label">Presença</label>
            <select className="input" value={guestForm.presenca || ''} onChange={e => setGuestForm(f => ({ ...f, presenca: e.target.value as any }))}>
              <option value="nao_confirmado">Pendente</option>
              <option value="confirmado">Confirmado</option>
              <option value="talvez">Talvez</option>
            </select>
          </div>
          <div><label className="label">Observação</label><textarea className="input min-h-[60px]" value={guestForm.observacao} onChange={e => setGuestForm(f => ({ ...f, observacao: e.target.value }))} /></div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmAction}
        title={confirmAction?.label || ''}
        message={confirmAction?.message || ''}
        confirmLabel={confirmAction?.label || 'Confirmar'}
        danger={confirmAction?.type === 'cancel' || confirmAction?.type === 'delete'}
        onConfirm={handleConfirmAction}
        onClose={() => setConfirmAction(null)}
      />
      <ConfirmModal
        open={!!deleteEventTarget}
        title="Excluir evento"
        message="Excluir este evento do jogo?"
        confirmLabel="Excluir"
        danger
        onConfirm={deleteEvent}
        onClose={() => setDeleteEventTarget(null)}
      />
      <ConfirmModal
        open={!!deleteGuestTarget}
        title="Remover convidado"
        message={`Remover ${deleteGuestTarget?.nome} deste jogo?`}
        confirmLabel="Remover"
        danger
        onConfirm={deleteGuest}
        onClose={() => setDeleteGuestTarget(null)}
      />
    </div>
  );
}

function AttendanceList({
  icon, title, list, color,
}: {
  icon: React.ReactNode;
  title: string;
  list: { profiles: { nome: string; apelido: string | null; foto_url: string | null }; player_id?: string }[];
  color: 'green' | 'red' | 'yellow' | 'neutral';
}) {
  const countCls = {
    green: 'text-green-400', red: 'text-red-400', yellow: 'text-yellow-400', neutral: 'text-neutral-400',
  }[color];

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <h3 className="text-sm font-semibold text-neutral-300">{title}</h3>
        <span className={cn('text-sm font-bold tabular-nums', countCls)}>{list.length}</span>
      </div>
      {list.length === 0 ? (
        <p className="text-neutral-600 text-xs">Ninguém</p>
      ) : (
        <div className="space-y-1.5">
          {list.map((a, i) => {
            const p = a.profiles;
            return (
              <div key={a.player_id || i} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-neutral-800 overflow-hidden shrink-0">
                  {p.foto_url ? <img src={p.foto_url} alt={p.nome} className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-neutral-600">{(p.apelido || p.nome).charAt(0).toUpperCase()}</div>
                  )}
                </div>
                <span className="text-neutral-300 text-sm truncate">{p.apelido || p.nome}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
