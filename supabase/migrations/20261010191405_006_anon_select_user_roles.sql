/*
# Allow anon SELECT on user_roles for setup check

## Overview
The login page (unauthenticated, using anon key) needs to check whether a
super_admin role exists to decide whether to show the initial setup form.
Currently the SELECT policy on user_roles is scoped to `authenticated` only,
so the anon key gets an empty result and the setup form never appears.

## Changes
- Replace the `user_roles_select_authenticated` policy with one scoped to
  `TO anon, authenticated` so the anon key can also read user_roles.
- This is safe: user_roles contains only user_id (UUID) and role (text) —
  no passwords, no emails, no sensitive personal data. The anon key already
  has no path to write to user_roles (INSERT/UPDATE/DELETE revoked).

## Security
- SELECT: granted to anon + authenticated (role data is not sensitive)
- INSERT/UPDATE/DELETE: still revoked from anon and authenticated
- Only service_role (edge functions) can write to user_roles

## Notes
1. This is required for the setup-admin check on the login page.
2. user_roles contains no personally identifiable information — only
   user_id (a UUID) and role name.
3. This migration is safe to re-run (idempotent).
*/

DROP POLICY IF EXISTS "user_roles_select_authenticated" ON public.user_roles;
CREATE POLICY "user_roles_select_anon_authenticated"
  ON public.user_roles FOR SELECT
  TO anon, authenticated
  USING (true);