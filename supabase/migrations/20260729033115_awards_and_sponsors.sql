/*
# Awards & Sponsors System

## Overview
Adds two new features:
1. Man of the Match (Craque da Partida) — stored as a nullable FK on matches.
2. Sponsor Management — a new `sponsors` table with full CRUD.

## 1. Man of the Match (matches table)

- Adds `man_of_the_match_player_id` column to `matches`.
- Nullable — most matches won't have one. Only completed matches should have it.
- FK to `profiles(id) ON DELETE SET NULL` — if a player is deleted, the award
  reference is cleared but the match is preserved.
- Admins set/clear this field; it's exposed publicly via the matches SELECT policy.

## 2. Sponsors table

- New table `sponsors` for managing club sponsors.
- Fields: id, name, logo_url, website_url, instagram_url, description, display_order, active, created_at, updated_at.
- Public SELECT (active sponsors visible to everyone — anon + authenticated).
- Admin-only INSERT/UPDATE/DELETE (gated via is_admin).
- Default display_order to 0, active to true.
- Indexes on display_order and active for efficient public queries.

## Security
- No changes to existing tables' RLS policies.
- The matches column addition is additive — existing policies still apply.
- sponsors follows the same pattern as seasons: public read, admin write.
*/

-- ============================================================
-- 1. Man of the Match column on matches
-- ============================================================
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS man_of_the_match_player_id uuid
  REFERENCES profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Sponsors table
-- ============================================================
CREATE TABLE IF NOT EXISTS sponsors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  website_url text,
  instagram_url text,
  description text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;

-- Public can read all sponsors (needed so anon visitors see them on the public site)
DROP POLICY IF EXISTS "sponsors_public_select" ON sponsors;
CREATE POLICY "sponsors_public_select"
  ON sponsors FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only admins can insert
DROP POLICY IF EXISTS "sponsors_admin_insert" ON sponsors;
CREATE POLICY "sponsors_admin_insert"
  ON sponsors FOR INSERT
  TO authenticated
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can update
DROP POLICY IF EXISTS "sponsors_admin_update" ON sponsors;
CREATE POLICY "sponsors_admin_update"
  ON sponsors FOR UPDATE
  TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Only admins can delete
DROP POLICY IF EXISTS "sponsors_admin_delete" ON sponsors;
CREATE POLICY "sponsors_admin_delete"
  ON sponsors FOR DELETE
  TO authenticated
  USING (is_admin(auth.uid()));

-- Indexes for public queries
CREATE INDEX IF NOT EXISTS idx_sponsors_display_order ON sponsors(display_order);
CREATE INDEX IF NOT EXISTS idx_sponsors_active ON sponsors(active);

-- ============================================================
-- 3. Storage path for sponsor logos (reuse existing 'fotos' bucket)
-- ============================================================
-- Sponsor logos are stored in the 'fotos' bucket under /sponsors/ path.
-- The existing 'fotos' bucket policies already allow authenticated users
-- to upload/modify/delete, and the bucket is public so logos can be
-- served via public URLs. No additional storage policies needed.
