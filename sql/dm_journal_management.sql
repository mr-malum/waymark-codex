-- =========================================================
-- Waymark Codex
-- DM Journal management helpers
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing DM Journal writes.

alter table public.dm_journal
  add column if not exists entry_title text;

create or replace function public.next_dm_journal_ref_code(target_campaign_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'JRN-' || lpad(
    (
      coalesce(
        max(
          nullif(regexp_replace(ref_code, '^JRN-', ''), '')::integer
        ),
        0
      ) + 1
    )::text,
    5,
    '0'
  )
  from public.dm_journal
  where campaign_id = target_campaign_id
    and ref_code ~ '^JRN-[0-9]+$';
$$;

grant execute on function public.next_dm_journal_ref_code(uuid)
  to authenticated;

create or replace function public.create_dm_journal_entry(
  target_campaign_id uuid,
  journal_source_type text,
  journal_source_id uuid,
  journal_title text,
  journal_body text,
  journal_entry_type text default null,
  journal_session_id text default null
)
returns public.dm_journal
language plpgsql
security definer
set search_path = public
as $$
declare
  created_entry public.dm_journal;
  next_ref text;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if journal_source_type not in ('campaign', 'region', 'hex', 'poi_group', 'poi', 'npc', 'map') then
    raise exception 'unsupported journal source type';
  end if;

  if journal_source_type <> 'campaign' and journal_source_id is null then
    raise exception 'journal source is required';
  end if;

  if nullif(trim(journal_title), '') is null then
    raise exception 'journal title is required';
  end if;

  if nullif(trim(journal_body), '') is null then
    raise exception 'journal entry is required';
  end if;

  next_ref := public.next_dm_journal_ref_code(target_campaign_id);

  insert into public.dm_journal (
    campaign_id,
    ref_code,
    entry_title,
    entry_body,
    entry_type,
    source_type,
    source_id,
    occurred_at,
    created_by_user_id,
    session_id
  )
  values (
    target_campaign_id,
    next_ref,
    trim(journal_title),
    trim(journal_body),
    nullif(trim(journal_entry_type), ''),
    journal_source_type::public.journal_source_type,
    case when journal_source_type = 'campaign' then null else journal_source_id end,
    now(),
    auth.uid(),
    nullif(trim(journal_session_id), '')
  )
  returning * into created_entry;

  return created_entry;
end;
$$;

grant execute on function public.create_dm_journal_entry(uuid, text, uuid, text, text, text, text)
  to authenticated;

create or replace function public.delete_dm_journal_entry(
  target_campaign_id uuid,
  target_entry_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  entry_author uuid;
  is_owner boolean;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  select created_by_user_id
    into entry_author
  from public.dm_journal
  where campaign_id = target_campaign_id
    and id = target_entry_id;

  if entry_author is null then
    raise exception 'journal entry not found';
  end if;

  select public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) into is_owner;

  if entry_author <> auth.uid() and not coalesce(is_owner, false) then
    raise exception 'not authorized';
  end if;

  delete from public.dm_journal
  where campaign_id = target_campaign_id
    and id = target_entry_id;
end;
$$;

grant execute on function public.delete_dm_journal_entry(uuid, uuid)
  to authenticated;
