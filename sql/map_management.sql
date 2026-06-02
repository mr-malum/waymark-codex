-- =========================================================
-- Waymark Codex
-- Map management helpers
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing add/rename/remove maps.

create or replace function public.next_map_ref_code(target_campaign_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select 'MAP-' || lpad(
    (
      coalesce(
        max(
          nullif(regexp_replace(ref_code, '^MAP-', ''), '')::integer
        ),
        0
      ) + 1
    )::text,
    4,
    '0'
  )
  from public.maps
  where campaign_id = target_campaign_id
    and ref_code ~ '^MAP-[0-9]+$';
$$;

grant execute on function public.next_map_ref_code(uuid)
  to authenticated;

create or replace function public.create_campaign_map(
  target_campaign_id uuid,
  target_owner_type text,
  target_owner_id uuid,
  map_name text,
  new_map_type text default null
)
returns public.maps
language plpgsql
security definer
set search_path = public
as $$
declare
  created_map public.maps;
  next_ref text;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if nullif(trim(map_name), '') is null then
    raise exception 'map name is required';
  end if;

  if target_owner_id is null then
    raise exception 'map owner is required';
  end if;

  if target_owner_type not in ('region', 'hex', 'poi', 'poi-group') then
    raise exception 'unsupported map owner type';
  end if;

  next_ref := public.next_map_ref_code(target_campaign_id);

  insert into public.maps (
    campaign_id,
    ref_code,
    name,
    map_type,
    sort_order,
    region_owner_id,
    hex_owner_id,
    poi_owner_id,
    poi_group_owner_id
  )
  values (
    target_campaign_id,
    next_ref,
    trim(map_name),
    nullif(trim(new_map_type), ''),
    (
      select coalesce(max(sort_order), 0) + 1
      from public.maps
      where campaign_id = target_campaign_id
    ),
    case when target_owner_type = 'region' then target_owner_id else null end,
    case when target_owner_type = 'hex' then target_owner_id else null end,
    case when target_owner_type = 'poi' then target_owner_id else null end,
    case when target_owner_type = 'poi-group' then target_owner_id else null end
  )
  returning * into created_map;

  return created_map;
end;
$$;

grant execute on function public.create_campaign_map(uuid, text, uuid, text, text)
  to authenticated;

create or replace function public.update_campaign_map(
  target_campaign_id uuid,
  target_map_id uuid,
  map_name text,
  new_map_type text default null
)
returns public.maps
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_map public.maps;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if nullif(trim(map_name), '') is null then
    raise exception 'map name is required';
  end if;

  update public.maps
  set name = trim(map_name),
      map_type = nullif(trim(new_map_type), ''),
      updated_at = now()
  where campaign_id = target_campaign_id
    and id = target_map_id
  returning * into updated_map;

  if updated_map.id is null then
    raise exception 'map not found';
  end if;

  return updated_map;
end;
$$;

grant execute on function public.update_campaign_map(uuid, uuid, text, text)
  to authenticated;

create or replace function public.delete_campaign_map(
  target_campaign_id uuid,
  target_map_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  delete from public.maps
  where campaign_id = target_campaign_id
    and id = target_map_id;

  if not found then
    raise exception 'map not found';
  end if;
end;
$$;

grant execute on function public.delete_campaign_map(uuid, uuid)
  to authenticated;
