-- =========================================================
-- Waymark Codex
-- Generated map overlay drawing
-- =========================================================
--
-- Run this in Supabase SQL Editor before testing generated map drawing.

create table if not exists public.generated_map_overlays (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  overlay_type text not null,
  from_hex_id uuid references public.hexes(id) on delete cascade,
  to_hex_id uuid references public.hexes(id) on delete cascade,
  hex_id uuid references public.hexes(id) on delete cascade,
  edge text,
  style text,
  is_major_route boolean not null default false,
  route_name text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint generated_map_overlays_type_check
    check (overlay_type in ('road', 'river', 'sea_route', 'path', 'wall', 'mist', 'farmland')),
  constraint generated_map_overlays_edge_check
    check (edge is null or edge in ('E', 'SE', 'SW', 'W', 'NW', 'NE')),
  constraint generated_map_overlays_shape_check
    check (
      (overlay_type in ('road', 'river', 'sea_route', 'path') and from_hex_id is not null and to_hex_id is not null and hex_id is null and edge is null)
      or
      (overlay_type in ('road', 'river', 'sea_route', 'path') and from_hex_id is not null and to_hex_id is null and hex_id is null and edge is not null)
      or
      (overlay_type = 'wall' and hex_id is not null and edge is not null and from_hex_id is null and to_hex_id is null)
      or
      (overlay_type in ('mist', 'farmland') and hex_id is not null and edge is null and from_hex_id is null and to_hex_id is null)
    )
);

alter table public.generated_map_overlays
  add column if not exists is_major_route boolean not null default false,
  add column if not exists route_name text;

alter table public.generated_map_overlays
  drop constraint if exists generated_map_overlays_type_check;

alter table public.generated_map_overlays
  add constraint generated_map_overlays_type_check
  check (overlay_type in ('road', 'river', 'sea_route', 'path', 'wall', 'mist', 'farmland'));

alter table public.generated_map_overlays
  drop constraint if exists generated_map_overlays_shape_check;

alter table public.generated_map_overlays
  add constraint generated_map_overlays_shape_check
  check (
    (overlay_type in ('road', 'river', 'sea_route', 'path') and from_hex_id is not null and to_hex_id is not null and hex_id is null and edge is null)
    or
    (overlay_type in ('road', 'river', 'sea_route', 'path') and from_hex_id is not null and to_hex_id is null and hex_id is null and edge is not null)
    or
    (overlay_type = 'wall' and hex_id is not null and edge is not null and from_hex_id is null and to_hex_id is null)
    or
    (overlay_type in ('mist', 'farmland') and hex_id is not null and edge is null and from_hex_id is null and to_hex_id is null)
  );

create index if not exists idx_generated_map_overlays_campaign
  on public.generated_map_overlays (campaign_id, overlay_type);

create index if not exists idx_generated_map_overlays_from_hex
  on public.generated_map_overlays (from_hex_id);

create index if not exists idx_generated_map_overlays_to_hex
  on public.generated_map_overlays (to_hex_id);

create index if not exists idx_generated_map_overlays_hex_edge
  on public.generated_map_overlays (hex_id, edge);

alter table public.generated_map_overlays enable row level security;

drop policy if exists "generated_map_overlays_select_member" on public.generated_map_overlays;
create policy "generated_map_overlays_select_member"
on public.generated_map_overlays
for select
to authenticated
using (
  exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = generated_map_overlays.campaign_id
      and cm.user_id = auth.uid()
  )
);

create or replace function public.can_shape_campaign_world(target_campaign_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.campaign_members cm
    where cm.campaign_id = target_campaign_id
      and cm.user_id = auth.uid()
      and cm.role::text in ('owner', 'superuser')
  );
$$;

drop function if exists public.add_generated_map_overlay(uuid, text, text, text, text, text);
drop function if exists public.add_generated_map_overlay(uuid, text, text, text, text, text, boolean, text);

create or replace function public.add_generated_map_overlay(
  target_campaign_id uuid,
  target_overlay_type text,
  from_hex_ref text default null,
  to_hex_ref text default null,
  target_edge text default null,
  target_style text default null,
  target_is_major_route boolean default false,
  target_route_name text default null
)
returns public.generated_map_overlays
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_type text := lower(trim(target_overlay_type));
  normalized_style text := nullif(lower(trim(target_style)), '');
  normalized_route_name text := nullif(trim(coalesce(target_route_name, '')), '');
  from_hex uuid;
  to_hex uuid;
  hex_overlay_hex uuid;
  existing_id uuid;
  created_record public.generated_map_overlays;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if normalized_type not in ('road', 'river', 'sea_route', 'path', 'wall', 'mist', 'farmland') then
    raise exception 'unsupported overlay type';
  end if;

  if normalized_type in ('road', 'path') then
    normalized_style := coalesce(normalized_style, 'dark_brown');
    if split_part(normalized_style, '|', 1) not in ('dark_brown', 'tan') then
      raise exception 'unsupported road/path style';
    end if;
  elsif normalized_type = 'river' then
    normalized_style := coalesce(normalized_style, 'river');
    if split_part(normalized_style, '|', 1) <> 'river' then
      raise exception 'unsupported river style';
    end if;
  elsif normalized_type = 'sea_route' then
    normalized_style := 'sea_route';
  elsif normalized_type = 'wall' then
    normalized_style := coalesce(normalized_style, 'wall');
    if normalized_style not in (
      'wall',
      'wall:gatehouse',
      'wall:sluice',
      'wall:broken',
      'palisade',
      'palisade:gate',
      'palisade:water_gate',
      'palisade:broken'
    ) then
      raise exception 'unsupported wall style';
    end if;
  elsif normalized_type = 'farmland' then
    normalized_style := 'farmland';
  else
    normalized_style := 'mist';
  end if;

  if normalized_type in ('road', 'river', 'sea_route', 'path') then
    select id into from_hex
    from public.hexes
    where campaign_id = target_campaign_id
      and ref_code = from_hex_ref
    limit 1;

    if nullif(trim(coalesce(to_hex_ref, '')), '') is not null then
      select id into to_hex
      from public.hexes
      where campaign_id = target_campaign_id
        and ref_code = to_hex_ref
      limit 1;
    end if;

    if from_hex is null then
      raise exception 'invalid overlay hex refs';
    end if;

    if to_hex is null then
      if target_edge not in ('E', 'SE', 'SW', 'W', 'NW', 'NE') then
        raise exception 'invalid overlay exit edge';
      end if;
    elsif from_hex = to_hex then
      raise exception 'invalid overlay hex refs';
    end if;

    select id into existing_id
    from public.generated_map_overlays
    where campaign_id = target_campaign_id
      and overlay_type = normalized_type
      and (
        (from_hex_id = from_hex and to_hex_id = to_hex)
        or
        (from_hex_id = to_hex and to_hex_id = from_hex)
        or
        (to_hex is null and from_hex_id = from_hex and to_hex_id is null and edge = target_edge)
      )
    limit 1;

    if existing_id is not null then
      update public.generated_map_overlays
      set style = case
            when public.generated_map_overlays.is_major_route and not coalesce(target_is_major_route, false) then public.generated_map_overlays.style
            else normalized_style
          end,
          is_major_route = case
            when normalized_type = 'sea_route' then true
            when public.generated_map_overlays.is_major_route and not coalesce(target_is_major_route, false) then true
            else coalesce(target_is_major_route, false)
          end,
          route_name = case
            when normalized_type not in ('road', 'river', 'sea_route') then null
            when public.generated_map_overlays.is_major_route and not coalesce(target_is_major_route, false) then public.generated_map_overlays.route_name
            else normalized_route_name
          end,
          updated_at = now()
      where id = existing_id
      returning * into created_record;

      return created_record;
    end if;

    insert into public.generated_map_overlays (
      campaign_id,
      overlay_type,
      from_hex_id,
      to_hex_id,
      edge,
      style,
      is_major_route,
      route_name,
      created_by
    )
    values (
      target_campaign_id,
      normalized_type,
      from_hex,
      to_hex,
      case when to_hex is null then target_edge else null end,
      normalized_style,
      case when normalized_type = 'sea_route' then true else coalesce(target_is_major_route, false) end,
      case when normalized_type in ('road', 'river', 'sea_route') then normalized_route_name else null end,
      auth.uid()
    )
    returning * into created_record;

    return created_record;
  end if;

  select id into hex_overlay_hex
  from public.hexes
  where campaign_id = target_campaign_id
    and ref_code = from_hex_ref
  limit 1;

  if hex_overlay_hex is null then
    raise exception 'invalid overlay hex';
  end if;

  if normalized_type = 'wall' and target_edge not in ('E', 'SE', 'SW', 'W', 'NW', 'NE') then
    raise exception 'invalid wall hex edge';
  end if;

  select id into existing_id
  from public.generated_map_overlays
  where campaign_id = target_campaign_id
    and overlay_type = normalized_type
    and hex_id = hex_overlay_hex
    and (
      (normalized_type = 'wall' and edge = target_edge)
      or
      (normalized_type in ('mist', 'farmland') and edge is null)
    )
  limit 1;

  if existing_id is not null then
    update public.generated_map_overlays
    set style = normalized_style,
        updated_at = now()
    where id = existing_id
    returning * into created_record;

    return created_record;
  end if;

  insert into public.generated_map_overlays (
    campaign_id,
    overlay_type,
    hex_id,
    edge,
    style,
    created_by
  )
  values (
    target_campaign_id,
    normalized_type,
    hex_overlay_hex,
    case when normalized_type = 'wall' then target_edge else null end,
    normalized_style,
    auth.uid()
  )
  returning * into created_record;

  return created_record;
end;
$$;

create or replace function public.erase_generated_map_overlays_at_hex(
  target_campaign_id uuid,
  target_hex_ref text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  target_hex_id uuid;
  deleted_count integer;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  select id into target_hex_id
  from public.hexes
  where campaign_id = target_campaign_id
    and ref_code = target_hex_ref
  limit 1;

  if target_hex_id is null then
    return 0;
  end if;

  with deleted as (
    delete from public.generated_map_overlays
    where campaign_id = target_campaign_id
      and (
        from_hex_id = target_hex_id
        or to_hex_id = target_hex_id
        or hex_id = target_hex_id
      )
    returning id
  )
  select count(*) into deleted_count from deleted;

  return coalesce(deleted_count, 0);
end;
$$;

create or replace function public.delete_generated_map_overlay(
  target_campaign_id uuid,
  target_overlay_id uuid
)
returns public.generated_map_overlays
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_record public.generated_map_overlays;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  delete from public.generated_map_overlays
  where campaign_id = target_campaign_id
    and id = target_overlay_id
  returning * into deleted_record;

  if deleted_record.id is null then
    raise exception 'Overlay not found.';
  end if;

  return deleted_record;
end;
$$;

create or replace function public.update_named_generated_route(
  target_campaign_id uuid,
  current_route_type text,
  current_route_name text,
  next_route_name text
)
returns setof public.generated_map_overlays
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_current_type text := lower(trim(current_route_type));
  normalized_current_name text := nullif(trim(coalesce(current_route_name, '')), '');
  normalized_next_name text := nullif(trim(coalesce(next_route_name, '')), '');
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if normalized_current_type not in ('road', 'river', 'sea_route')
    or normalized_current_name is null
    or normalized_next_name is null then
    raise exception 'invalid route update';
  end if;

  return query
  update public.generated_map_overlays
  set is_major_route = true,
      route_name = normalized_next_name,
      updated_at = now()
  where campaign_id = target_campaign_id
    and overlay_type = normalized_current_type
    and route_name = normalized_current_name
  returning *;
end;
$$;

create or replace function public.clear_generated_map_overlays(
  target_campaign_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_count integer;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  with deleted as (
    delete from public.generated_map_overlays
    where campaign_id = target_campaign_id
    returning id
  )
  select count(*) into deleted_count from deleted;

  return coalesce(deleted_count, 0);
end;
$$;

create or replace function public.assign_generated_hex_region(
  target_campaign_id uuid,
  target_hex_ref text,
  target_region_ref text
)
returns public.hexes
language plpgsql
security definer
set search_path = public
as $$
declare
  target_hex_id uuid;
  target_region_id uuid;
  updated_hex public.hexes;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  select id into target_hex_id
  from public.hexes
  where campaign_id = target_campaign_id
    and ref_code = target_hex_ref
    and base_terrain is not null
  limit 1;

  select id into target_region_id
  from public.regions
  where campaign_id = target_campaign_id
    and ref_code = target_region_ref
    and region_type = 'geographic'
  limit 1;

  if target_hex_id is null then
    raise exception 'Generated hex not found.';
  end if;

  if target_region_id is null then
    raise exception 'Geographic region not found.';
  end if;

  update public.hexes
  set region_id = target_region_id,
      geographic_region_id = target_region_id,
      updated_at = now()
  where id = target_hex_id
  returning * into updated_hex;

  return updated_hex;
end;
$$;

create or replace function public.assign_generated_hex_region_layer(
  target_campaign_id uuid,
  target_hex_ref text,
  target_region_ref text,
  target_region_type text default 'geographic'
)
returns public.hexes
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_type text := lower(trim(coalesce(target_region_type, 'geographic')));
  normalized_ref text := nullif(trim(coalesce(target_region_ref, '')), '');
  target_hex_id uuid;
  target_region_id uuid;
  updated_hex public.hexes;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if normalized_type not in ('geographic', 'political') then
    raise exception 'unsupported region type';
  end if;

  select id into target_hex_id
  from public.hexes
  where campaign_id = target_campaign_id
    and ref_code = target_hex_ref
    and base_terrain is not null
  limit 1;

  if target_hex_id is null then
    raise exception 'Generated hex not found.';
  end if;

  if normalized_type = 'political' and normalized_ref is null then
    update public.hexes
    set political_region_id = null,
        updated_at = now()
    where id = target_hex_id
    returning * into updated_hex;

    return updated_hex;
  end if;

  select id into target_region_id
  from public.regions
  where campaign_id = target_campaign_id
    and ref_code = normalized_ref
    and region_type = normalized_type
  limit 1;

  if target_region_id is null then
    raise exception 'Region not found.';
  end if;

  if normalized_type = 'geographic' then
    update public.hexes
    set region_id = target_region_id,
        geographic_region_id = target_region_id,
        updated_at = now()
    where id = target_hex_id
    returning * into updated_hex;
  else
    update public.hexes
    set political_region_id = target_region_id,
        updated_at = now()
    where id = target_hex_id
    returning * into updated_hex;
  end if;

  return updated_hex;
end;
$$;

grant execute on function public.add_generated_map_overlay(uuid, text, text, text, text, text, boolean, text) to authenticated;
grant execute on function public.erase_generated_map_overlays_at_hex(uuid, text) to authenticated;
grant execute on function public.delete_generated_map_overlay(uuid, uuid) to authenticated;
grant execute on function public.update_named_generated_route(uuid, text, text, text) to authenticated;
grant execute on function public.clear_generated_map_overlays(uuid) to authenticated;
grant execute on function public.assign_generated_hex_region(uuid, text, text) to authenticated;
grant execute on function public.assign_generated_hex_region_layer(uuid, text, text, text) to authenticated;
grant select on public.generated_map_overlays to authenticated;

notify pgrst, 'reload schema';
