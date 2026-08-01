/*
# Opponents, Competitions, and Monthly Fees Redesign

## Overview
This migration adds two new tables (opponents, competitions) with foreign key
relationships to matches, and extends monthly_fees with admin tracking fields.
Existing match data (text-based opponent/competition fields) is preserved.

## 1. New Tables

### opponents
- id (uuid PK)
- name (text, NOT NULL) — opponent team name
- logo_url (text, nullable) — logo image URL from Storage
- city (text, nullable)
- state (text, nullable)
- notes (text, nullable)
- active (boolean, default true)
- created_at, updated_at (timestamptz)

### competitions
- id (uuid PK)
- name (text, NOT NULL) — competition name
- logo_url (text, nullable)
- type (text, NOT NULL) — one of: Championship, Cup, League, Friendly, Tournament, Other
- active (boolean, default true)
- created_at, updated_at (timestamptz)

## 2. Modified Tables

### matches — new nullable FK columns (existing text columns kept for backward compat)
- opponent_id (uuid, nullable) → references opponents(id) ON DELETE SET NULL
- competition_id (uuid, nullable) → references competitions(id) ON DELETE SET NULL
- segunda_competition_id (uuid, nullable) → references competitions(id) ON DELETE SET NULL

### monthly_fees — new tracking columns
- confirmado_por (uuid, nullable) — admin user_id who confirmed payment
- isento (boolean, default false) — exempt from payment

## 3. Security (RLS)
- opponents: public SELECT (anon+authenticated), admin-only INSERT/UPDATE/DELETE
- competitions: public SELECT (anon+authenticated), admin-only INSERT/UPDATE/DELETE
- matches: existing policies unchanged (new columns inherit table-level RLS)
- monthly_fees: existing policies unchanged

## 4. Indexes
- matches.opponent_id
- matches.competition_id
- matches.segunda_competition_id
- monthly_fees.competencia + player_id unique (prevents duplicate monthly records)

## 5. Important Notes
1. Existing matches retain their text-based adversario/logo_url/competicao fields.
   New matches will use opponent_id/competition_id FKs instead.
   The UI will display from the FK when available, falling back to text fields.
2. A unique constraint on (player_id, competencia) prevents duplicate monthly fees.
3. The is_admin() function is used for admin-only policies, matching the existing pattern.
*/

-- ============ OPPONENTS TABLE ============
CREATE TABLE IF NOT EXISTS opponents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  city text,
  state text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE opponents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "opponents_public_select" ON opponents;
CREATE POLICY "opponents_public_select" ON opponents FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "opponents_admin_insert" ON opponents;
CREATE POLICY "opponents_admin_insert" ON opponents FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "opponents_admin_update" ON opponents;
CREATE POLICY "opponents_admin_update" ON opponents FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "opponents_admin_delete" ON opponents;
CREATE POLICY "opponents_admin_delete" ON opponents FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============ COMPETITIONS TABLE ============
CREATE TABLE IF NOT EXISTS competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  type text NOT NULL CHECK (type IN ('Championship', 'Cup', 'League', 'Friendly', 'Tournament', 'Other')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "competitions_public_select" ON competitions;
CREATE POLICY "competitions_public_select" ON competitions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "competitions_admin_insert" ON competitions;
CREATE POLICY "competitions_admin_insert" ON competitions FOR INSERT
  TO authenticated WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "competitions_admin_update" ON competitions;
CREATE POLICY "competitions_admin_update" ON competitions FOR UPDATE
  TO authenticated USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "competitions_admin_delete" ON competitions;
CREATE POLICY "competitions_admin_delete" ON competitions FOR DELETE
  TO authenticated USING (is_admin(auth.uid()));

-- ============ MATCHES — NEW FK COLUMNS ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'opponent_id') THEN
    ALTER TABLE matches ADD COLUMN opponent_id uuid REFERENCES opponents(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'competition_id') THEN
    ALTER TABLE matches ADD COLUMN competition_id uuid REFERENCES competitions(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'matches' AND column_name = 'segunda_competition_id') THEN
    ALTER TABLE matches ADD COLUMN segunda_competition_id uuid REFERENCES competitions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_matches_opponent_id ON matches(opponent_id);
CREATE INDEX IF NOT EXISTS idx_matches_competition_id ON matches(competition_id);
CREATE INDEX IF NOT EXISTS idx_matches_segunda_competition_id ON matches(segunda_competition_id);

-- ============ MONTHLY_FEES — NEW COLUMNS ============
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_fees' AND column_name = 'confirmado_por') THEN
    ALTER TABLE monthly_fees ADD COLUMN confirmado_por uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'monthly_fees' AND column_name = 'isento') THEN
    ALTER TABLE monthly_fees ADD COLUMN isento boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Prevent duplicate monthly fee records for the same player + month
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uniq_fee_player_competencia') THEN
    ALTER TABLE monthly_fees ADD CONSTRAINT uniq_fee_player_competencia UNIQUE (player_id, competencia);
  END IF;
END $$;
