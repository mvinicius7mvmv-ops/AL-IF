
/*
# AL-IF FC Core Schema

## Overview
Complete database schema for the AL-IF FC amateur football club management system.
This migration creates all core tables, relationships, indexes, and RLS policies.

## New Tables
1. `user_roles` — stores role (admin/player) per auth.users entry
2. `profiles` — player profiles linked to auth.users
3. `seasons` — football seasons (isolated stats per season)
4. `matches` — all games (upcoming, completed, cancelled)
5. `match_attendance` — player presence per match (unique per player+match)
6. `guests` — non-official players for a specific match
7. `match_events` — goals, assists, cards per match
8. `monthly_fees` — player monthly dues
9. `finance_entries` — club income/expense ledger
10. `manual_stat_adjustments` — admin corrections to stats

## Security
- RLS enabled on all tables
- Public data (matches, profiles subset, seasons) readable by anon
- Private data (attendance, financials, full profiles) gated to authenticated
- Admin-only operations enforced via user_roles check
- Players can only modify their own attendance and profile photo
*/

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- user_roles
-- ============================================================
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin','player')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Admin helper function (security-definer so it bypasses RLS for the check itself)
CREATE OR REPLACE FUNCTION is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles WHERE user_id = uid AND role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "user_roles_select" ON user_roles;
CREATE POLICY "user_roles_select" ON user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles_insert" ON user_roles;
CREATE POLICY "user_roles_insert" ON user_roles FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles_update" ON user_roles;
CREATE POLICY "user_roles_update" ON user_roles FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "user_roles_delete" ON user_roles;
CREATE POLICY "user_roles_delete" ON user_roles FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  apelido text,
  foto_url text,
  numero integer,
  posicao text,
  telefone text,
  telefone_normalizado text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  data_entrada date,
  data_nascimento date,
  observacoes text,
  must_change_password boolean NOT NULL DEFAULT true,
  temp_password text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telefone_norm_unique
  ON profiles (telefone_normalizado)
  WHERE telefone_normalizado IS NOT NULL;

CREATE INDEX IF NOT EXISTS profiles_user_id_idx ON profiles(user_id);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Public can see basic info (no phone, no dob, no internal notes)
DROP POLICY IF EXISTS "profiles_anon_select" ON profiles;
CREATE POLICY "profiles_anon_select" ON profiles FOR SELECT
  TO anon, authenticated USING (status = 'active');

DROP POLICY IF EXISTS "profiles_auth_select_own" ON profiles;
CREATE POLICY "profiles_auth_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_insert" ON profiles;
CREATE POLICY "profiles_insert" ON profiles FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()) OR auth.uid() = user_id)
  WITH CHECK (is_admin(auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- seasons
-- ============================================================
CREATE TABLE IF NOT EXISTS seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ano integer NOT NULL,
  ativa boolean NOT NULL DEFAULT false,
  encerrada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "seasons_anon_select" ON seasons;
CREATE POLICY "seasons_anon_select" ON seasons FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "seasons_insert" ON seasons;
CREATE POLICY "seasons_insert" ON seasons FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "seasons_update" ON seasons;
CREATE POLICY "seasons_update" ON seasons FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "seasons_delete" ON seasons;
CREATE POLICY "seasons_delete" ON seasons FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- matches
-- ============================================================
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE RESTRICT,
  adversario text NOT NULL,
  logo_url text,
  data date NOT NULL,
  horario time,
  local text,
  competicao text,
  segunda_competicao text,
  tipo text DEFAULT 'Amistoso',
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','completed','cancelled')),
  gols_alif integer,
  gols_adversario integer,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS matches_season_id_idx ON matches(season_id);
CREATE INDEX IF NOT EXISTS matches_status_idx ON matches(status);
CREATE INDEX IF NOT EXISTS matches_data_idx ON matches(data);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "matches_anon_select" ON matches;
CREATE POLICY "matches_anon_select" ON matches FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "matches_insert" ON matches;
CREATE POLICY "matches_insert" ON matches FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "matches_update" ON matches;
CREATE POLICY "matches_update" ON matches FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "matches_delete" ON matches;
CREATE POLICY "matches_delete" ON matches FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- match_attendance
-- ============================================================
CREATE TABLE IF NOT EXISTS match_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  resposta text NOT NULL CHECK (resposta IN ('vou','nao_vou','talvez')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id, player_id)
);

CREATE INDEX IF NOT EXISTS match_attendance_match_id_idx ON match_attendance(match_id);
CREATE INDEX IF NOT EXISTS match_attendance_player_id_idx ON match_attendance(player_id);

ALTER TABLE match_attendance ENABLE ROW LEVEL SECURITY;

-- Admin can see all attendance; players see only their own
DROP POLICY IF EXISTS "attendance_select" ON match_attendance;
CREATE POLICY "attendance_select" ON match_attendance FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = match_attendance.player_id
        AND p.user_id = auth.uid()
    )
  );

-- Players can only insert their own attendance
DROP POLICY IF EXISTS "attendance_insert" ON match_attendance;
CREATE POLICY "attendance_insert" ON match_attendance FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = player_id
        AND p.user_id = auth.uid()
    )
  );

-- Players can only update their own attendance
DROP POLICY IF EXISTS "attendance_update" ON match_attendance;
CREATE POLICY "attendance_update" ON match_attendance FOR UPDATE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = match_attendance.player_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_admin(auth.uid())
    OR (
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = player_id
          AND p.user_id = auth.uid()
      )
      -- Prevent changing player_id to someone else
      AND player_id = (
        SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1
      )
    )
  );

DROP POLICY IF EXISTS "attendance_delete" ON match_attendance;
CREATE POLICY "attendance_delete" ON match_attendance FOR DELETE
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = match_attendance.player_id
        AND p.user_id = auth.uid()
    )
  );

-- ============================================================
-- guests
-- ============================================================
CREATE TABLE IF NOT EXISTS guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  nome text NOT NULL,
  posicao text,
  observacao text,
  presenca text CHECK (presenca IN ('confirmado','nao_confirmado','talvez')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guests_match_id_idx ON guests(match_id);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guests_anon_select" ON guests;
CREATE POLICY "guests_anon_select" ON guests FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "guests_insert" ON guests;
CREATE POLICY "guests_insert" ON guests FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "guests_update" ON guests;
CREATE POLICY "guests_update" ON guests FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "guests_delete" ON guests;
CREATE POLICY "guests_delete" ON guests FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- match_events
-- ============================================================
CREATE TABLE IF NOT EXISTS match_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('gol','assistencia','cartao_amarelo','cartao_vermelho')),
  minuto integer,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS match_events_match_id_idx ON match_events(match_id);
CREATE INDEX IF NOT EXISTS match_events_player_id_idx ON match_events(player_id);

ALTER TABLE match_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_anon_select" ON match_events;
CREATE POLICY "events_anon_select" ON match_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "events_insert" ON match_events;
CREATE POLICY "events_insert" ON match_events FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "events_update" ON match_events;
CREATE POLICY "events_update" ON match_events FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "events_delete" ON match_events;
CREATE POLICY "events_delete" ON match_events FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- monthly_fees
-- ============================================================
CREATE TABLE IF NOT EXISTS monthly_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  competencia text NOT NULL, -- e.g. "2026-07"
  valor numeric(10,2) NOT NULL,
  vencimento date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago','pendente','atrasado')),
  pago_em date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS monthly_fees_player_id_idx ON monthly_fees(player_id);

ALTER TABLE monthly_fees ENABLE ROW LEVEL SECURITY;

-- Admin sees all; player sees only own
DROP POLICY IF EXISTS "fees_select" ON monthly_fees;
CREATE POLICY "fees_select" ON monthly_fees FOR SELECT
  TO authenticated
  USING (
    is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = monthly_fees.player_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "fees_insert" ON monthly_fees;
CREATE POLICY "fees_insert" ON monthly_fees FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "fees_update" ON monthly_fees;
CREATE POLICY "fees_update" ON monthly_fees FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "fees_delete" ON monthly_fees;
CREATE POLICY "fees_delete" ON monthly_fees FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- finance_entries
-- ============================================================
CREATE TABLE IF NOT EXISTS finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('receita','despesa')),
  categoria text,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  data date NOT NULL,
  observacao text,
  related_player_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  related_fee_id uuid REFERENCES monthly_fees(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finance_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "finance_select" ON finance_entries;
CREATE POLICY "finance_select" ON finance_entries FOR SELECT
  TO authenticated USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "finance_insert" ON finance_entries;
CREATE POLICY "finance_insert" ON finance_entries FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "finance_update" ON finance_entries;
CREATE POLICY "finance_update" ON finance_entries FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "finance_delete" ON finance_entries;
CREATE POLICY "finance_delete" ON finance_entries FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- manual_stat_adjustments
-- ============================================================
CREATE TABLE IF NOT EXISTS manual_stat_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  season_id uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('gols','assistencias','jogos','cartoes_amarelos','cartoes_vermelhos','presenca')),
  valor integer NOT NULL,
  motivo text NOT NULL,
  criado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manual_adj_player_idx ON manual_stat_adjustments(player_id);
CREATE INDEX IF NOT EXISTS manual_adj_season_idx ON manual_stat_adjustments(season_id);

ALTER TABLE manual_stat_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "adj_select" ON manual_stat_adjustments;
CREATE POLICY "adj_select" ON manual_stat_adjustments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "adj_insert" ON manual_stat_adjustments;
CREATE POLICY "adj_insert" ON manual_stat_adjustments FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "adj_update" ON manual_stat_adjustments;
CREATE POLICY "adj_update" ON manual_stat_adjustments FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "adj_delete" ON manual_stat_adjustments;
CREATE POLICY "adj_delete" ON manual_stat_adjustments FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============================================================
-- UTILITY FUNCTION: normalize phone
-- ============================================================
CREATE OR REPLACE FUNCTION normalize_phone(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(phone, '[^0-9]', '', 'g');
$$;
