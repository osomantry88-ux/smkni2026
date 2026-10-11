/*
# Multi-Role Authentication & Permission System

## Overview
Replaces the single-role profiles system with a multi-role architecture:
- `user_roles` table (many-to-many: one user can have multiple roles)
- `user_duties` table (extra duty assignments, e.g. wali kelas for a specific class)
- SECURITY DEFINER functions for backend-validated role checks
- Column-level privileges to prevent self-role-assignment
- Updated trigger: no more auto-role on signup (roles assigned by admin only)

## Changed Tables
### profiles
- `role` column: dropped NOT NULL constraint, dropped old CHECK constraint
  (roles are now managed through `user_roles`; `profiles.role` kept as a
  denormalized "primary role" for convenience but is no longer the source of truth)
- UPDATE privilege revoked from authenticated; only `full_name` is user-writable
  (prevents users from changing their own role through the data API)

## New Tables
### user_roles
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, references auth.users ON DELETE CASCADE)
- `role` (text, NOT NULL) — one of the 10 defined school roles
- `created_at` (timestamptz)
- UNIQUE(user_id, role) — prevents duplicate role assignments

### user_duties
- `id` (uuid, PK)
- `user_id` (uuid, NOT NULL, references auth.users ON DELETE CASCADE)
- `duty` (text, NOT NULL) — duty description (e.g. "wali_kelas")
- `kelas_id` (uuid, nullable, references kelas ON DELETE SET NULL)
- `created_at` (timestamptz)

## New Functions (SECURITY DEFINER)
- `has_role(p_role text) RETURNS boolean` — true if caller has the given role
- `is_admin() RETURNS boolean` — true if caller has super_admin or admin role
- `get_my_roles() RETURNS text[]` — array of caller's roles
All functions: SECURITY DEFINER, fixed search_path, EXECUTE granted to authenticated only.

## Security
- RLS enabled on user_roles and user_duties
- SELECT: authenticated can read all (needed for user management UI)
- No INSERT/UPDATE/DELETE policies for authenticated — only the service role
  (via edge functions) can write roles
- profiles UPDATE revoked to authenticated; only full_name is writable
- handle_new_user trigger updated: creates profile with role=NULL, no auto-assignment

## Defined Roles
super_admin, admin, kepala_sekolah, guru, wali_kelas, guru_bk, guru_piket,
pembina, siswa, orang_tua_wali

## Notes
1. The first super_admin is created via the setup-admin edge function, NOT
   through public registration.
2. Subsequent users are created by admins via the admin-users edge function.
3. Users cannot choose or change their own roles.
4. The has_role/is_admin functions can be used in future RLS policies for
   per-module access control.
5. This migration is safe to re-run (idempotent).
*/

-- ============================================================
-- 1. Update profiles: relax role column, lock down UPDATE
-- ============================================================

-- Make role nullable (was NOT NULL DEFAULT 'staff')
ALTER TABLE public.profiles ALTER COLUMN role DROP NOT NULL;
ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT;

-- Drop old CHECK constraint (name is auto-generated: profiles_role_check)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'profiles' AND constraint_name = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
  END IF;
END $$;

-- Revoke full UPDATE on profiles; grant only full_name to users
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- ============================================================
-- 2. user_roles table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (
    role IN ('super_admin', 'admin', 'kepala_sekolah', 'guru',
             'wali_kelas', 'guru_bk', 'guru_piket', 'pembina',
             'siswa', 'orang_tua_wali')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
CREATE POLICY "user_roles_select_authenticated"
  ON public.user_roles FOR SELECT TO authenticated USING (true);

-- No INSERT/UPDATE/DELETE policies: only service role (edge functions) can write

-- ============================================================
-- 3. user_duties table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_duties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  duty text NOT NULL,
  kelas_id uuid REFERENCES public.kelas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_duties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_duties_select_authenticated" ON public.user_duties;
CREATE POLICY "user_duties_select_authenticated"
  ON public.user_duties FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 4. SECURITY DEFINER functions for role checks
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_role(p_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = p_role
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('super_admin', 'admin')
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_roles()
RETURNS text[]
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(role), ARRAY[]::text[])
  FROM public.user_roles
  WHERE user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_roles() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated;

-- ============================================================
-- 5. Update handle_new_user trigger (no auto-role assignment)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NULL
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 6. Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_duties_user_id ON public.user_duties(user_id);