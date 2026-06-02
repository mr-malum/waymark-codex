-- =========================================================
-- Waymark Codex
-- Diagnose profile insert blockers during signup
-- =========================================================
--
-- Run this in Supabase SQL Editor and inspect/paste all result sets.

-- 1) Every non-internal trigger on auth.users.
select
  trigger_info.tgname as trigger_name,
  trigger_info.tgenabled as enabled,
  proc_namespace.nspname as function_schema,
  proc_info.proname as function_name,
  pg_get_triggerdef(trigger_info.oid, true) as trigger_definition
from pg_trigger trigger_info
join pg_proc proc_info
  on proc_info.oid = trigger_info.tgfoid
join pg_namespace proc_namespace
  on proc_namespace.oid = proc_info.pronamespace
where trigger_info.tgrelid = 'auth.users'::regclass
  and not trigger_info.tgisinternal
order by trigger_info.tgname;

-- 2) Profile table RLS state.
select
  relrowsecurity as rls_enabled,
  relforcerowsecurity as rls_forced
from pg_class
where oid = 'public.profiles'::regclass;

-- 3) Profile constraints, including checks not shown by column listing.
select
  constraints.constraint_name,
  constraints.constraint_type,
  check_clause
from information_schema.table_constraints constraints
left join information_schema.check_constraints checks
  on checks.constraint_schema = constraints.constraint_schema
 and checks.constraint_name = constraints.constraint_name
where constraints.table_schema = 'public'
  and constraints.table_name = 'profiles'
order by constraint_name;

-- 4) Profile indexes.
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'profiles'
order by indexname;

-- 5) Every trigger on public.profiles.
select
  trigger_info.tgname as trigger_name,
  trigger_info.tgenabled as enabled,
  proc_namespace.nspname as function_schema,
  proc_info.proname as function_name,
  pg_get_triggerdef(trigger_info.oid, true) as trigger_definition
from pg_trigger trigger_info
join pg_proc proc_info
  on proc_info.oid = trigger_info.tgfoid
join pg_namespace proc_namespace
  on proc_namespace.oid = proc_info.pronamespace
where trigger_info.tgrelid = 'public.profiles'::regclass
  and not trigger_info.tgisinternal
order by trigger_info.tgname;

-- 6) Signup bridge function body.
select
  proc_namespace.nspname as function_schema,
  proc_info.proname as function_name,
  pg_get_functiondef(proc_info.oid) as function_definition
from pg_proc proc_info
join pg_namespace proc_namespace
  on proc_namespace.oid = proc_info.pronamespace
where proc_namespace.nspname = 'public'
  and proc_info.proname in ('handle_new_user', 'normalize_campaign_username');
