/*
# Phone-based authentication for players

## Changes

1. Adds a UNIQUE constraint on `profiles.telefone_normalizado` so no two players
   can share the same phone number. This is required because phone is now the
   primary login identifier — duplicates would make login ambiguous.

2. Migrates existing player auth emails from the old `slug@alif-fc.local` format
   to a phone-based format `<telefone_normalizado>@alif-fc.local`. This keeps the
   internal Supabase auth working (it still requires an email field) while making
   the email deterministic from the phone number, so the login screen can derive
   it without a separate lookup.

3. Updates the matching `auth.users` records so their email matches the new
   profile email, keeping auth and profiles in sync.

## Security
- No RLS policy changes.
- The unique constraint enforces data integrity for the phone-based login flow.
*/

-- 1. Add unique constraint on telefone_normalizado (skip rows where it's null)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_telefone_normalizado_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_telefone_normalizado_key UNIQUE (telefone_normalizado);
  END IF;
END $$;

-- 2. Migrate existing profile auth_email values to phone-based format
UPDATE profiles p
SET auth_email = p.telefone_normalizado || '@alif-fc.local',
    updated_at = now()
WHERE p.telefone_normalizado IS NOT NULL
  AND p.auth_email IS NOT NULL
  AND p.auth_email != (p.telefone_normalizado || '@alif-fc.local');

-- 3. Sync auth.users emails to match the new profile auth_email
UPDATE auth.users au
SET email = p.auth_email,
    updated_at = now()
FROM profiles p
WHERE au.id = p.user_id
  AND p.auth_email IS NOT NULL
  AND au.email != p.auth_email;
