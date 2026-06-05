-- =========================================================
-- Waymark Codex
-- Campaign audit settings and retention controls
-- =========================================================
--
-- Purpose:
-- Adds per-campaign audit-log controls so audit logging can be disabled,
-- hex-row spam can be suppressed, and old/excess audit rows can be pruned
-- automatically after each audit write.
--
-- Recommended default:
-- - Keep audit enabled for normal Codex records.
-- - Keep hex auditing disabled unless deliberately debugging map writes.
-- - Cap every campaign to 5000 audit rows.
-- - Retain audit rows for 90 days.

create index if not exists campaign_audit_log_campaign_created_idx
on public.campaign_audit_log (campaign_id, created_at desc, id desc);

create table if not exists public.campaign_audit_settings (
  campaign_id uuid primary key references public.campaigns(id) on delete cascade,
  audit_enabled boolean not null default true,
  audit_hexes_enabled boolean not null default false,
  max_entries integer not null default 5000,
  retention_days integer not null default 90,
  updated_at timestamptz not null default now()
);

alter table public.campaign_audit_settings
  alter column max_entries set default 5000,
  alter column retention_days set default 90;

update public.campaign_audit_settings
set
  max_entries = greatest(coalesce(max_entries, 5000), 1),
  retention_days = greatest(coalesce(retention_days, 90), 1),
  updated_at = now()
where max_entries is null
   or max_entries < 1
   or retention_days is null
   or retention_days < 1;

alter table public.campaign_audit_settings
  alter column retention_days set not null;

alter table public.campaign_audit_settings enable row level security;

drop policy if exists "campaign_audit_settings_select_admin" on public.campaign_audit_settings;
create policy "campaign_audit_settings_select_admin"
on public.campaign_audit_settings
for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = campaign_audit_settings.campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  )
);

drop function if exists public.get_campaign_audit_settings(uuid);
create or replace function public.get_campaign_audit_settings(
  target_campaign_id uuid
)
returns table (
  settings_campaign_id uuid,
  audit_enabled boolean,
  audit_hexes_enabled boolean,
  max_entries integer,
  retention_days integer
)
language sql
security definer
set search_path = public
as $$
  select
    target_campaign_id as settings_campaign_id,
    coalesce(settings.audit_enabled, true) as audit_enabled,
    coalesce(settings.audit_hexes_enabled, false) as audit_hexes_enabled,
    coalesce(settings.max_entries, 5000) as max_entries,
    coalesce(settings.retention_days, 90) as retention_days
  from (select 1) seed
  left join public.campaign_audit_settings settings
    on settings.campaign_id = target_campaign_id
  where exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  );
$$;

drop function if exists public.update_campaign_audit_enabled(uuid, boolean);
create or replace function public.update_campaign_audit_enabled(
  target_campaign_id uuid,
  next_audit_enabled boolean
)
returns table (
  settings_campaign_id uuid,
  audit_enabled boolean,
  audit_hexes_enabled boolean,
  max_entries integer,
  retention_days integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  ) then
    raise exception 'not authorized';
  end if;

  insert into public.campaign_audit_settings (
    campaign_id,
    audit_enabled,
    audit_hexes_enabled,
    max_entries,
    retention_days
  )
  values (
    target_campaign_id,
    coalesce(next_audit_enabled, true),
    false,
    5000,
    90
  )
  on conflict (campaign_id) do update
  set
    audit_enabled = excluded.audit_enabled,
    updated_at = now();

  return query
  select
    settings.campaign_id as settings_campaign_id,
    settings.audit_enabled,
    settings.audit_hexes_enabled,
    settings.max_entries,
    settings.retention_days
  from public.campaign_audit_settings settings
  where settings.campaign_id = target_campaign_id;
end;
$$;

create or replace function public.write_campaign_audit_log(
  target_campaign_id uuid,
  audit_action text,
  audit_target_type text,
  audit_target_id uuid,
  audit_summary text,
  audit_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  settings_audit_enabled boolean := true;
  settings_hexes_enabled boolean := false;
  settings_max_entries integer := 5000;
  settings_retention_days integer := 90;
begin
  if target_campaign_id is null or audit_summary is null or trim(audit_summary) = '' then
    return;
  end if;

  select
    coalesce(audit_enabled, true),
    coalesce(audit_hexes_enabled, false),
    greatest(coalesce(max_entries, 5000), 0),
    greatest(coalesce(retention_days, 90), 0)
  into
    settings_audit_enabled,
    settings_hexes_enabled,
    settings_max_entries,
    settings_retention_days
  from public.campaign_audit_settings
  where campaign_id = target_campaign_id;

  if coalesce(settings_audit_enabled, true) = false then
    return;
  end if;

  if coalesce(audit_target_type, '') = 'hexes'
     and coalesce(settings_hexes_enabled, false) = false then
    return;
  end if;

  insert into public.campaign_audit_log (
    campaign_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    summary,
    metadata
  )
  values (
    target_campaign_id,
    auth.uid(),
    coalesce(nullif(trim(audit_action), ''), 'changed'),
    coalesce(nullif(trim(audit_target_type), ''), 'campaign'),
    audit_target_id,
    trim(audit_summary),
    coalesce(audit_metadata, '{}'::jsonb)
  );

  if settings_retention_days is not null and settings_retention_days > 0 then
    delete from public.campaign_audit_log
    where campaign_id = target_campaign_id
      and created_at < now() - make_interval(days => settings_retention_days);
  end if;

  if settings_max_entries > 0 then
    delete from public.campaign_audit_log
    where id in (
      select id
      from public.campaign_audit_log
      where campaign_id = target_campaign_id
      order by created_at desc, id desc
      offset settings_max_entries
    );
  end if;
end;
$$;

grant execute on function public.get_campaign_audit_settings(uuid) to authenticated;
grant execute on function public.update_campaign_audit_enabled(uuid, boolean) to authenticated;

-- Ensure every existing campaign has an audit settings row.
-- Existing audit_enabled values are preserved on conflict, but caps are enforced.
insert into public.campaign_audit_settings (
  campaign_id,
  audit_enabled,
  audit_hexes_enabled,
  max_entries,
  retention_days
)
select
  campaigns.id,
  true,
  false,
  5000,
  90
from public.campaigns
on conflict (campaign_id) do update
set
  audit_hexes_enabled = false,
  max_entries = 5000,
  retention_days = 90,
  updated_at = now();

-- Testing Grounds settings:
-- audit off, hex audit off, max 5000 rows, purge rows older than 90 days.
insert into public.campaign_audit_settings (
  campaign_id,
  audit_enabled,
  audit_hexes_enabled,
  max_entries,
  retention_days
)
values (
  '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid,
  false,
  false,
  5000,
  90
)
on conflict (campaign_id) do update
set
  audit_enabled = excluded.audit_enabled,
  audit_hexes_enabled = excluded.audit_hexes_enabled,
  max_entries = excluded.max_entries,
  retention_days = excluded.retention_days,
  updated_at = now();

-- Apply the retention window immediately for every campaign.
delete from public.campaign_audit_log log
using public.campaign_audit_settings settings
where settings.campaign_id = log.campaign_id
  and settings.retention_days > 0
  and log.created_at < now() - make_interval(days => settings.retention_days);

-- Apply the row cap immediately for every campaign.
delete from public.campaign_audit_log
where id in (
  select id
  from (
    select
      log.id,
      row_number() over (
        partition by log.campaign_id
        order by log.created_at desc, log.id desc
      ) as row_rank,
      settings.max_entries
    from public.campaign_audit_log log
    join public.campaign_audit_settings settings
      on settings.campaign_id = log.campaign_id
    where settings.max_entries > 0
  ) ranked
  where ranked.row_rank > ranked.max_entries
);

-- Toggle examples:
--
-- Fully disable audit logging for Testing Grounds:
-- update public.campaign_audit_settings
-- set audit_enabled = false,
--     updated_at = now()
-- where campaign_id = '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid;
--
-- Re-enable audit logging while keeping hex spam disabled:
-- update public.campaign_audit_settings
-- set audit_enabled = true,
--     audit_hexes_enabled = false,
--     max_entries = 5000,
--     retention_days = 90,
--     updated_at = now()
-- where campaign_id = '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid;
--
-- Temporarily enable hex auditing for map-write debugging:
-- update public.campaign_audit_settings
-- set audit_hexes_enabled = true,
--     updated_at = now()
-- where campaign_id = '5d5ec4a1-5fd1-48d5-a027-0544ead71aba'::uuid;
