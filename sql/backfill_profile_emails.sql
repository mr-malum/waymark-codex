-- =========================================================
-- Waymark Codex
-- Backfill profile emails for username login
-- =========================================================
--
-- Run this in Supabase SQL Editor if username login says:
-- "Invalid login credentials"
-- after fixing resolve_login_email_by_username ambiguity.

update public.profiles profile
set email = lower(auth_user.email),
    updated_at = now()
from auth.users auth_user
where profile.id = auth_user.id
  and auth_user.email is not null
  and (
    profile.email is null
    or lower(profile.email) <> lower(auth_user.email)
  );

select
  profile.id,
  profile.username,
  profile.email
from public.profiles profile
order by profile.username;

