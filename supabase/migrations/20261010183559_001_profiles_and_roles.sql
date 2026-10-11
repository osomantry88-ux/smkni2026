/*
# Profiles and Role Management

## Overview
Creates the `profiles` table that extends Supabase's built-in `auth.users` with
school-specific fields (full name, role). Includes a trigger that automatically
creates a profile row whenever a new user signs up, assigning `super_admin` to
the very first user and `staff` to subsequent registrations.

## New Tables
- `profiles`
  - `id` (uuid, PK, references auth.users) — one-to-one with auth.users
  - `full_name` (text) — display name shown in the UI
  - `role` (text, not null) — one of: super_admin, admin, guru, tendik, staff
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

## Security
- RLS enabled on `profiles`.
- Authenticated users can read all profiles (staff need to see colleagues).
- Users can update only their own profile.
- A SECURITY DEFINER trigger function `handle_new_user()` auto-creates a profile
  on signup. The first user becomes `super_admin`; everyone after is `staff`.
  The function has a fixed `search_path` to prevent path injection.

## Notes
1. The first user to sign up automatically receives the `super_admin` role.
2. Subsequent users get `staff` role (can be upgraded by a super_admin later).
3. Profile creation is automatic — no client-side insert needed.
*/

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'staff'
    CHECK (role IN ('super_admin', 'admin', 'guru', 'tendik', 'staff')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup. First user = super_admin, rest = staff.
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
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'super_admin') THEN 'super_admin'
      ELSE 'staff'
    END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at auto-maintenance
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();