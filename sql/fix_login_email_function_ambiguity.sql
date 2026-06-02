-- =========================================================
-- Waymark Codex
-- Fix username login function ambiguity
-- =========================================================
--
-- Run this in Supabase SQL Editor if login reports:
-- "Could not choose the best candidate function between..."

drop function if exists public.resolve_login_email_by_username(public.citext);
drop function if exists public.resolve_login_email_by_username(text);

create or replace function public.resolve_login_email_by_username(target_username text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.email
  from public.profiles p
  where lower(p.username::text) = lower(trim(target_username))
  limit 1;
$$;

grant execute on function public.resolve_login_email_by_username(text) to anon, authenticated;

