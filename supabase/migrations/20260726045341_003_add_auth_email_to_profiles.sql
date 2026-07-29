
/*
# Add auth_email to profiles for client-side login lookup

## Changes
- Add `auth_email` text column to `profiles` to store the auth user email.
- This allows the player login flow to look up the email by phone (normalized)
  from the client side, then call signInWithPassword with that email.
- The anon key can already SELECT profiles (public subset), and auth_email
  is not sensitive — it's an internal system email like "nome.sobrenome@alif-fc.local".
*/

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auth_email text;

-- Backfill auth_email from auth.users for existing profiles that have a user_id
DO $$
BEGIN
  UPDATE profiles p
  SET auth_email = u.email
  FROM auth.users u
  WHERE p.user_id = u.id AND p.auth_email IS NULL;
END $$;
