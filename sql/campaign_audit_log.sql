-- =========================================================
-- Waymark Codex
-- Owner audit log
-- =========================================================

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.campaign_audit_log (
  id uuid primary key default extensions.gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.campaign_audit_log enable row level security;

drop policy if exists "campaign_audit_log_select_owner" on public.campaign_audit_log;
create policy "campaign_audit_log_select_owner"
on public.campaign_audit_log
for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = campaign_audit_log.campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  )
);

create or replace function public.get_campaign_audit_log(
  target_campaign_id uuid,
  result_limit integer default 30
)
returns table (
  id uuid,
  campaign_id uuid,
  actor_user_id uuid,
  actor_username text,
  action text,
  target_type text,
  target_id uuid,
  summary text,
  metadata jsonb,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    log.id,
    log.campaign_id,
    log.actor_user_id,
    profile.username as actor_username,
    log.action,
    log.target_type,
    log.target_id,
    log.summary,
    log.metadata,
    log.created_at
  from public.campaign_audit_log log
  left join public.profiles profile
    on profile.id = log.actor_user_id
  where log.campaign_id = target_campaign_id
    and exists (
      select 1
      from public.campaign_members cm
      where cm.campaign_id = target_campaign_id
        and cm.user_id = auth.uid()
        and cm.role::text in ('owner', 'superuser')
    )
  order by log.created_at desc
  limit least(greatest(coalesce(result_limit, 30), 1), 100);
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
begin
  if target_campaign_id is null or audit_summary is null or trim(audit_summary) = '' then
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
end;
$$;

create or replace function public.audit_campaign_table_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_campaign_id uuid;
  row_target_id uuid;
  row_label text;
  row_action text;
  row_summary text;
  row_data jsonb;
  changed_fields jsonb;
begin
  if tg_op = 'DELETE' then
    row_campaign_id := old.campaign_id;
    row_target_id := old.id;
    row_data := to_jsonb(old);
  else
    row_campaign_id := new.campaign_id;
    row_target_id := new.id;
    row_data := to_jsonb(new);
  end if;

  if row_campaign_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  row_action := lower(tg_op);

  row_label := coalesce(
    row_data->>'name',
    row_data->>'entry_title',
    row_data->>'ref_code',
    row_data->>'slug',
    row_data->>'storage_path',
    tg_table_name
  );

  if tg_table_name = 'assets' then
    if tg_op = 'UPDATE' and coalesce(old.storage_path, '') <> coalesce(new.storage_path, '') then
      row_summary := 'Changed image asset';
    elsif tg_op = 'INSERT' then
      row_summary := 'Added image asset';
    elsif tg_op = 'DELETE' then
      row_summary := 'Removed image asset';
    else
      if tg_op = 'DELETE' then
        return old;
      end if;
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    row_summary := 'Added ' || replace(tg_table_name, '_', ' ') || ': ' || row_label;
  elsif tg_op = 'UPDATE' then
    row_summary := 'Edited ' || replace(tg_table_name, '_', ' ') || ': ' || row_label;
    select coalesce(jsonb_object_agg(new_fields.key, jsonb_build_object(
      'old',
      old_fields.value,
      'new',
      new_fields.value
    )), '{}'::jsonb)
      into changed_fields
    from jsonb_each(to_jsonb(new)) new_fields
    join jsonb_each(to_jsonb(old)) old_fields
      on old_fields.key = new_fields.key
    where new_fields.value is distinct from old_fields.value
      and new_fields.key not in ('updated_at');
  elsif tg_op = 'DELETE' then
    row_summary := 'Removed ' || replace(tg_table_name, '_', ' ') || ': ' || row_label;
  end if;

  perform public.write_campaign_audit_log(
    row_campaign_id,
    row_action,
    tg_table_name,
    row_target_id,
    row_summary,
    jsonb_build_object(
      'table',
      tg_table_name,
      'changed_fields',
      coalesce(changed_fields, '{}'::jsonb)
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_regions on public.regions;
create trigger trg_audit_regions after insert or update or delete on public.regions
for each row execute function public.audit_campaign_table_change();

drop trigger if exists trg_audit_hexes on public.hexes;
create trigger trg_audit_hexes after insert or update or delete on public.hexes
for each row execute function public.audit_campaign_table_change();

drop trigger if exists trg_audit_poi_groups on public.poi_groups;
create trigger trg_audit_poi_groups after insert or update or delete on public.poi_groups
for each row execute function public.audit_campaign_table_change();

drop trigger if exists trg_audit_pois on public.pois;
create trigger trg_audit_pois after insert or update or delete on public.pois
for each row execute function public.audit_campaign_table_change();

drop trigger if exists trg_audit_npcs on public.npcs;
create trigger trg_audit_npcs after insert or update or delete on public.npcs
for each row execute function public.audit_campaign_table_change();

drop trigger if exists trg_audit_maps on public.maps;
create trigger trg_audit_maps after insert or update or delete on public.maps
for each row execute function public.audit_campaign_table_change();

drop trigger if exists trg_audit_dm_journal on public.dm_journal;
create trigger trg_audit_dm_journal after insert or delete on public.dm_journal
for each row execute function public.audit_campaign_table_change();

drop trigger if exists trg_audit_assets on public.assets;
create trigger trg_audit_assets after insert or update or delete on public.assets
for each row execute function public.audit_campaign_table_change();

create or replace function public.audit_campaign_member_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_campaign_id uuid;
  target_user_id uuid;
  target_role text;
  target_username text;
  audit_action text;
begin
  if tg_op = 'DELETE' then
    target_campaign_id := old.campaign_id;
    target_user_id := old.user_id;
    target_role := old.role::text;
  else
    target_campaign_id := new.campaign_id;
    target_user_id := new.user_id;
    target_role := new.role::text;
  end if;

  select username into target_username
  from public.profiles
  where id = target_user_id;

  audit_action := lower(tg_op);

  perform public.write_campaign_audit_log(
    target_campaign_id,
    audit_action,
    'campaign_members',
    target_user_id,
    case
      when tg_op = 'INSERT' then 'Added member: ' || coalesce(target_username, target_user_id::text) || ' as ' || target_role
      when tg_op = 'UPDATE' then 'Changed member role: ' || coalesce(target_username, target_user_id::text) || ' to ' || target_role
      else 'Removed member: ' || coalesce(target_username, target_user_id::text)
    end,
    jsonb_build_object('role', target_role)
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_campaign_members on public.campaign_members;
create trigger trg_audit_campaign_members after insert or update or delete on public.campaign_members
for each row execute function public.audit_campaign_member_change();

create or replace function public.audit_campaign_name_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.name, '') = coalesce(new.name, '') then
    return new;
  end if;

  perform public.write_campaign_audit_log(
    new.id,
    'UPDATE',
    'campaigns',
    new.id,
    'Renamed campaign from ' || old.name || ' to ' || new.name,
    jsonb_build_object('old_name', old.name, 'new_name', new.name)
  );

  return new;
end;
$$;

drop trigger if exists trg_audit_campaign_name on public.campaigns;
create trigger trg_audit_campaign_name after update of name on public.campaigns
for each row execute function public.audit_campaign_name_change();

grant execute on function public.get_campaign_audit_log(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
