/*
# Tighten security on user_roles and user_duties

## Overview
Revokes unnecessary INSERT/UPDATE/DELETE grants from anon and authenticated
roles on user_roles and user_duties tables. These tables should only be
written to by the service_role (via edge functions), never by direct client
access. RLS policies already block these operations (no write policies exist),
but revoking the grants adds defense-in-depth.

Also revokes EXECUTE on has_role, is_admin, and get_my_roles from anon role
(these were accidentally granted to anon in a previous migration).

## Changes
- REVOKE INSERT, UPDATE, DELETE on user_roles FROM anon, authenticated
- REVOKE INSERT, UPDATE, DELETE on user_duties FROM anon, authenticated
- REVOKE EXECUTE on has_role(text), is_admin(), get_my_roles() FROM anon
- GRANT EXECUTE on has_role(text), is_admin(), get_my_roles() TO authenticated (kept)

## Security
- user_roles: only SELECT granted to authenticated; writes via service_role only
- user_duties: only SELECT granted to authenticated; writes via service_role only
- SECURITY DEFINER functions: only authenticated can call (not anon)

## Notes
1. These grants were inherited from the default Supabase setup which grants
   all privileges to anon and authenticated. RLS policies already block
   writes, but this ensures defense-in-depth.
2. The service_role bypasses RLS entirely, so edge functions can still
   read/write these tables.
3. This migration is safe to re-run (idempotent).
*/

-- Revoke write grants on user_roles
REVOKE INSERT ON public.user_roles FROM anon;
REVOKE UPDATE ON public.user_roles FROM anon;
REVOKE DELETE ON public.user_roles FROM anon;
REVOKE INSERT ON public.user_roles FROM authenticated;
REVOKE UPDATE ON public.user_roles FROM authenticated;
REVOKE DELETE ON public.user_roles FROM authenticated;

-- Revoke write grants on user_duties
REVOKE INSERT ON public.user_duties FROM anon;
REVOKE UPDATE ON public.user_duties FROM anon;
REVOKE DELETE ON public.user_duties FROM anon;
REVOKE INSERT ON public.user_duties FROM authenticated;
REVOKE UPDATE ON public.user_duties FROM authenticated;
REVOKE DELETE ON public.user_duties FROM authenticated;

-- Revoke EXECUTE from anon on SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_roles() FROM anon;