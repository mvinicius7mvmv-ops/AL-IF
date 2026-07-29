import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'admin' | 'player';

export interface Profile {
  id: string;
  user_id: string | null;
  nome: string;
  apelido: string | null;
  foto_url: string | null;
  numero: number | null;
  posicao: string | null;
  telefone: string | null;
  telefone_normalizado: string | null;
  status: 'active' | 'inactive';
  data_entrada: string | null;
  data_nascimento: string | null;
  observacoes: string | null;
  must_change_password: boolean;
  temp_password: string | null;
  auth_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface Season {
  id: string;
  nome: string;
  ano: number;
  ativa: boolean;
  encerrada: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  season_id: string;
  adversario: string;
  logo_url: string | null;
  data: string;
  horario: string | null;
  local: string | null;
  competicao: string | null;
  segunda_competicao: string | null;
  tipo: string | null;
  status: 'upcoming' | 'completed' | 'cancelled';
  gols_alif: number | null;
  gols_adversario: number | null;
  observacoes: string | null;
  man_of_the_match_player_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchAttendance {
  id: string;
  match_id: string;
  player_id: string;
  resposta: 'vou' | 'nao_vou' | 'talvez';
  created_at: string;
  updated_at: string;
}

export interface Guest {
  id: string;
  match_id: string;
  nome: string;
  posicao: string | null;
  observacao: string | null;
  presenca: 'confirmado' | 'nao_confirmado' | 'talvez' | null;
  created_at: string;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  player_id: string | null;
  guest_id: string | null;
  tipo: 'gol' | 'assistencia' | 'cartao_amarelo' | 'cartao_vermelho';
  minuto: number | null;
  observacao: string | null;
  created_at: string;
}

export interface MonthlyFee {
  id: string;
  player_id: string;
  competencia: string;
  valor: number;
  vencimento: string | null;
  status: 'pago' | 'pendente' | 'atrasado';
  pago_em: string | null;
  observacao: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceEntry {
  id: string;
  tipo: 'receita' | 'despesa';
  categoria: string | null;
  descricao: string;
  valor: number;
  data: string;
  observacao: string | null;
  related_player_id: string | null;
  related_fee_id: string | null;
  created_at: string;
}

export interface ManualStatAdjustment {
  id: string;
  player_id: string;
  season_id: string;
  tipo: 'gols' | 'assistencias' | 'jogos' | 'cartoes_amarelos' | 'cartoes_vermelhos' | 'presenca';
  valor: number;
  motivo: string;
  criado_por: string | null;
  criado_em: string;
}

export interface Sponsor {
  id: string;
  name: string;
  logo_url: string | null;
  website_url: string | null;
  instagram_url: string | null;
  description: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}
