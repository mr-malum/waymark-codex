-- =========================================================
-- Waymark Codex
-- Diagnose auth signup trigger failures
-- =========================================================
--
-- Run this in Supabase SQL Editor and inspect/paste the results.
-- It lists every non-internal trigger attached to auth.users.

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

-- Also list profile table columns that can reject inserts.
select
  column_name,
  data_type,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'profiles'
order by ordinal_position;

