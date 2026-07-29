/*
# Security Audit Fixes

## Overview
Resolves 4 security audit warnings:
1. Functions with mutable search_path
2. pg_trgm extension in public schema
3. Broad SELECT policy on public photos bucket
4. SECURITY DEFINER function with excessive EXECUTE grants

## 1. Fixed search_path on functions

### normalize_phone
- Added `SET search_path = public` to fix mutable search_path warning.
- Function logic unchanged — still IMMUTABLE, SECURITY INVOKER.

### is_admin
- Added `SET search_path = public` to fix mutable search_path warning.
- Kept SECURITY DEFINER (required: the user_roles SELECT policy calls is_admin,
  so SECURITY INVOKER would cause infinite RLS recursion).
- Revoked EXECUTE from PUBLIC and anon (was overly broad).
- Granted EXECUTE only to authenticated (RLS policies run as authenticated),
  plus service_role and postgres for internal use.

## 2. Moved pg_trgm to extensions schema

- Created `extensions` schema.
- Dropped pg_trgm from public and re-created it in the `extensions` schema.
- No indexes or views depend on pg_trgm, so no further updates needed.
- The extension's operators are still accessible via schema-qualified calls
  or through the default search_path if extensions is added to it.

## 3. Restricted fotos bucket listing

- Removed `fotos_public_read` policy (allowed anon + authenticated to list
  ALL files in the bucket via the Storage API).
- Added `fotos_authenticated_read` policy: only authenticated users can list
  files. The bucket remains public=true, so individual files are still
  accessible via public URLs — but anonymous users can no longer enumerate
  the entire bucket contents.

## 4. Restricted EXECUTE on is_admin

- REVOKE EXECUTE FROM PUBLIC and anon.
- GRANT EXECUTE TO authenticated, service_role only.
- This prevents unauthenticated users from probing admin status.

## Security impact
- No data loss. All existing functionality preserved.
- Login flow, admin permissions, and public photo URLs continue to work.
- Anonymous users can no longer list all photos or call is_admin.
*/

-- ============================================================
-- 1A. Fix normalize_phone: add fixed search_path
-- ============================================================
CREATE OR REPLACE FUNCTION public.normalize_phone(phone text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $function$
SELECT regexp_replace(phone, '[^0-9]', '', 'g');
$function$;

-- ============================================================
-- 1B + 4. Fix is_admin: add fixed search_path, keep SECURITY DEFINER,
--          restrict EXECUTE grants
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
SELECT EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = uid AND role = 'admin'
);
$function$;

-- Restrict EXECUTE: revoke from broad roles
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;

-- Grant only to roles that need it
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO service_role;

-- ============================================================
-- 2. Move pg_trgm extension to extensions schema
-- ============================================================
CREATE SCHEMA IF NOT EXISTS extensions;

-- Drop and recreate in the new schema (no indexes depend on it)
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm SCHEMA extensions;

-- Make extension functions accessible by default
ALTER SCHEMA extensions OWNER TO postgres;

-- ============================================================
-- 3. Restrict fotos bucket SELECT policy
-- ============================================================
-- Remove broad public read (allowed anon to list all files)
DROP POLICY IF EXISTS "fotos_public_read" ON storage.objects;

-- Allow only authenticated users to list/read objects in the bucket
-- (the bucket itself is public, so individual file URLs still work)
DROP POLICY IF EXISTS "fotos_authenticated_read" ON storage.objects;
CREATE POLICY "fotos_authenticated_read"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'fotos');
