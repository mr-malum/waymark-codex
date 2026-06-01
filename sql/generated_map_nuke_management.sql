-- =========================================================
-- Campaign Codex
-- Generated map bulk/nuke tools
-- =========================================================
--
-- Run after hex_mapper_import_bridge.sql, generated_map_overlay_management.sql,
-- and generated_hex_terrain_management.sql.

create or replace function public.clear_generated_hex_region_layer(
  target_campaign_id uuid,
  target_region_type text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_type text := lower(trim(coalesce(target_region_type, '')));
  unclaimed_region_id uuid;
  updated_count integer := 0;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if normalized_type not in ('geographic', 'political') then
    raise exception 'unsupported region type';
  end if;

  if normalized_type = 'geographic' then
    select id into unclaimed_region_id
    from public.regions
    where campaign_id = target_campaign_id
      and region_type = 'geographic'
      and ref_code = 'REG-0000'
    limit 1;

    if unclaimed_region_id is null then
      raise exception 'Unclaimed geographic region not found.';
    end if;

    with updated as (
      update public.hexes
      set region_id = unclaimed_region_id,
          geographic_region_id = unclaimed_region_id,
          updated_at = now()
      where campaign_id = target_campaign_id
        and base_terrain is not null
        and coalesce(geographic_region_id, region_id) is distinct from unclaimed_region_id
      returning id
    )
    select count(*) into updated_count from updated;
  else
    with updated as (
      update public.hexes
      set political_region_id = null,
          updated_at = now()
      where campaign_id = target_campaign_id
        and base_terrain is not null
        and political_region_id is not null
      returning id
    )
    select count(*) into updated_count from updated;
  end if;

  return coalesce(updated_count, 0);
end;
$$;

create or replace function public.clear_generated_hex_features(
  target_campaign_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  with updated as (
    update public.hexes
    set terrain_features = '[]'::jsonb,
        terrain = public.format_hex_mapper_terrain(base_terrain, '[]'::jsonb),
        updated_at = now()
    where campaign_id = target_campaign_id
      and base_terrain is not null
      and jsonb_array_length(coalesce(terrain_features, '[]'::jsonb)) > 0
    returning id
  )
  select count(*) into updated_count from updated;

  return coalesce(updated_count, 0);
end;
$$;

create or replace function public.restore_poi_group_snapshots(
  target_campaign_id uuid,
  delete_group_ids uuid[] default '{}'::uuid[],
  group_snapshot jsonb default '[]'::jsonb
)
returns table(
  snapshot_order integer,
  id uuid,
  slug text,
  name text,
  group_type text,
  group_icon text,
  group_tags text[],
  generation_source text,
  population text,
  lore text
)
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

  if coalesce(array_length(delete_group_ids, 1), 0) > 0 then
    delete from public.poi_groups as existing_group
    where existing_group.campaign_id = target_campaign_id
      and existing_group.id = any(delete_group_ids);
  end if;

  return query
  with snapshot as (
    select
      coalesce(item.snapshot_order, row_number() over ())::integer as snapshot_order,
      nullif(trim(coalesce(item.group_ref, '')), '') as group_ref,
      nullif(trim(coalesce(item.name, '')), '') as name,
      public.normalize_poi_category_type(item.group_type) as group_type,
      public.normalize_poi_icon_value(item.group_icon) as group_icon,
      public.normalize_poi_tag_list(coalesce(item.group_tags, '{}'::text[])) as group_tags,
      nullif(trim(coalesce(item.population, '')), '') as population,
      nullif(trim(coalesce(item.lore, '')), '') as lore,
      nullif(trim(coalesce(item.generation_source, '')), '') as generation_source
    from jsonb_to_recordset(coalesce(group_snapshot, '[]'::jsonb)) as item(
      snapshot_order integer,
      group_ref text,
      name text,
      group_type text,
      group_icon text,
      group_tags text[],
      population text,
      lore text,
      generation_source text
    )
  ),
  resolved as (
    select *
    from snapshot
    where group_ref is not null
      and name is not null
      and group_type is not null
      and group_icon is not null
  ),
  inserted as (
    insert into public.poi_groups as restored_group (
      campaign_id,
      slug,
      name,
      group_type,
      group_icon,
      group_tags,
      generation_source,
      population,
      lore,
      visibility,
      created_by
    )
    select
      target_campaign_id,
      resolved.group_ref,
      resolved.name,
      resolved.group_type,
      resolved.group_icon,
      resolved.group_tags,
      resolved.generation_source,
      resolved.population,
      resolved.lore,
      'shared'::public.content_visibility,
      auth.uid()
    from resolved
    returning
      restored_group.id,
      restored_group.slug,
      restored_group.name,
      restored_group.group_type,
      restored_group.group_icon,
      restored_group.group_tags,
      restored_group.generation_source,
      restored_group.population,
      restored_group.lore
  )
  select
    resolved.snapshot_order,
    inserted.id,
    inserted.slug,
    inserted.name,
    inserted.group_type,
    inserted.group_icon,
    inserted.group_tags,
    inserted.generation_source,
    inserted.population,
    inserted.lore
  from inserted
  join resolved
    on inserted.slug = resolved.group_ref
  order by resolved.snapshot_order;
end;
$$;

create or replace function public.restore_generated_poi_snapshots(
  target_campaign_id uuid,
  delete_poi_ids uuid[] default '{}'::uuid[],
  poi_snapshot jsonb default '[]'::jsonb
)
returns table(
  snapshot_order integer,
  id uuid,
  ref_code text,
  poi_group_id uuid,
  name text,
  hex_id uuid,
  poi_type text,
  poi_icon text,
  poi_tags text[],
  generation_source text,
  notoriety_tier text,
  population text,
  lore text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  next_base_number integer := 0;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if coalesce(array_length(delete_poi_ids, 1), 0) > 0 then
    delete from public.pois as existing_poi
    where existing_poi.campaign_id = target_campaign_id
      and existing_poi.id = any(delete_poi_ids);
  end if;

  select coalesce(max(substring(existing_poi.ref_code from '^POI-([0-9]+)$')::integer), 0)
    into next_base_number
  from public.pois as existing_poi
  where existing_poi.campaign_id = target_campaign_id
    and existing_poi.ref_code ~ '^POI-[0-9]+$';

  return query
  with snapshot as (
    select
      coalesce(item.snapshot_order, row_number() over ())::integer as snapshot_order,
      nullif(trim(coalesce(item.name, '')), '') as name,
      nullif(trim(coalesce(item.hex_ref, '')), '') as hex_ref,
      nullif(trim(coalesce(item.group_ref, '')), '') as group_ref,
      public.normalize_poi_category_type(item.poi_type) as poi_type,
      public.normalize_poi_icon_value(item.poi_icon) as poi_icon,
      public.normalize_poi_tag_list(coalesce(item.poi_tags, '{}'::text[])) as poi_tags,
      public.normalize_poi_notoriety_tier(item.notoriety_tier) as notoriety_tier,
      nullif(trim(coalesce(item.population, '')), '') as population,
      nullif(trim(coalesce(item.lore, '')), '') as lore,
      nullif(trim(coalesce(item.generation_source, '')), '') as generation_source
    from jsonb_to_recordset(coalesce(poi_snapshot, '[]'::jsonb)) as item(
      snapshot_order integer,
      name text,
      hex_ref text,
      group_ref text,
      poi_type text,
      poi_icon text,
      poi_tags text[],
      notoriety_tier text,
      population text,
      lore text,
      generation_source text
    )
  ),
  resolved as (
    select
      snapshot.snapshot_order,
      snapshot.name,
      target_hex.id as hex_id,
      target_group.id as poi_group_id,
      snapshot.poi_type,
      snapshot.poi_icon,
      snapshot.poi_tags,
      snapshot.notoriety_tier,
      snapshot.population,
      snapshot.lore,
      snapshot.generation_source
    from snapshot
    join public.hexes target_hex
      on target_hex.campaign_id = target_campaign_id
      and target_hex.ref_code = snapshot.hex_ref
    left join public.poi_groups target_group
      on target_group.campaign_id = target_campaign_id
      and target_group.slug = snapshot.group_ref
    where snapshot.name is not null
      and snapshot.poi_type is not null
      and snapshot.poi_icon is not null
      and snapshot.notoriety_tier is not null
      and (snapshot.group_ref is null or target_group.id is not null)
      and not (
        snapshot.poi_type = 'settlement'
        and snapshot.population is null
      )
  ),
  numbered as (
    select
      resolved.*,
      next_base_number + row_number() over (order by resolved.snapshot_order) as next_number
    from resolved
  ),
  inserted as (
    insert into public.pois as restored_poi (
      campaign_id,
      ref_code,
      name,
      hex_id,
      poi_group_id,
      poi_type,
      poi_icon,
      poi_tags,
      generation_source,
      notoriety_tier,
      population,
      lore,
      visibility,
      created_by
    )
    select
      target_campaign_id,
      'POI-' || lpad(numbered.next_number::text, 4, '0'),
      numbered.name,
      numbered.hex_id,
      numbered.poi_group_id,
      numbered.poi_type,
      numbered.poi_icon,
      numbered.poi_tags,
      numbered.generation_source,
      numbered.notoriety_tier,
      numbered.population,
      numbered.lore,
      'shared'::public.content_visibility,
      auth.uid()
    from numbered
    returning
      restored_poi.id,
      restored_poi.ref_code,
      restored_poi.poi_group_id,
      restored_poi.name,
      restored_poi.hex_id,
      restored_poi.poi_type,
      restored_poi.poi_icon,
      restored_poi.poi_tags,
      restored_poi.generation_source,
      restored_poi.notoriety_tier,
      restored_poi.population,
      restored_poi.lore
  )
  select
    numbered.snapshot_order,
    inserted.id,
    inserted.ref_code,
    inserted.poi_group_id,
    inserted.name,
    inserted.hex_id,
    inserted.poi_type,
    inserted.poi_icon,
    inserted.poi_tags,
    inserted.generation_source,
    inserted.notoriety_tier,
    inserted.population,
    inserted.lore
  from inserted
  join numbered
    on inserted.ref_code = 'POI-' || lpad(numbered.next_number::text, 4, '0')
  order by numbered.snapshot_order;
end;
$$;

create or replace function public.restore_generated_map_overlays(
  target_campaign_id uuid,
  overlay_snapshot jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer := 0;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  with snapshot as (
    select
      lower(trim(coalesce(item.overlay_type, ''))) as overlay_type,
      nullif(trim(coalesce(item.from_hex_ref, '')), '') as from_hex_ref,
      nullif(trim(coalesce(item.to_hex_ref, '')), '') as to_hex_ref,
      nullif(trim(coalesce(item.hex_ref, '')), '') as hex_ref,
      nullif(trim(coalesce(item.edge, '')), '') as edge,
      nullif(lower(trim(coalesce(item.style, ''))), '') as style,
      coalesce(item.is_major_route, false) as is_major_route,
      nullif(trim(coalesce(item.route_name, '')), '') as route_name
    from jsonb_to_recordset(coalesce(overlay_snapshot, '[]'::jsonb)) as item(
      overlay_type text,
      from_hex_ref text,
      to_hex_ref text,
      hex_ref text,
      edge text,
      style text,
      is_major_route boolean,
      route_name text
    )
  ),
  resolved as (
    select
      snapshot.overlay_type,
      from_hex.id as from_hex_id,
      to_hex.id as to_hex_id,
      wall_hex.id as hex_id,
      snapshot.edge,
      snapshot.style,
      snapshot.is_major_route,
      snapshot.route_name
    from snapshot
    left join public.hexes from_hex
      on from_hex.campaign_id = target_campaign_id
      and from_hex.ref_code = snapshot.from_hex_ref
    left join public.hexes to_hex
      on to_hex.campaign_id = target_campaign_id
      and to_hex.ref_code = snapshot.to_hex_ref
    left join public.hexes wall_hex
      on wall_hex.campaign_id = target_campaign_id
      and wall_hex.ref_code = snapshot.hex_ref
  ),
  inserted as (
    insert into public.generated_map_overlays (
      campaign_id,
      overlay_type,
      from_hex_id,
      to_hex_id,
      hex_id,
      edge,
      style,
      is_major_route,
      route_name,
      created_by
    )
    select
      target_campaign_id,
      overlay_type,
      case when overlay_type in ('road', 'river', 'sea_route', 'path') then from_hex_id else null end,
      case when overlay_type in ('road', 'river', 'sea_route', 'path') then to_hex_id else null end,
      case when overlay_type in ('wall', 'mist') then hex_id else null end,
      case when overlay_type = 'wall' or (overlay_type in ('road', 'river', 'sea_route', 'path') and to_hex_id is null) then edge else null end,
      style,
      case when overlay_type = 'sea_route' then true else is_major_route end,
      case when overlay_type in ('road', 'river', 'sea_route') then route_name else null end,
      auth.uid()
    from resolved
    where (
      overlay_type in ('road', 'river', 'sea_route', 'path')
      and from_hex_id is not null
      and to_hex_id is not null
      and from_hex_id <> to_hex_id
    )
    or (
      overlay_type in ('road', 'river', 'sea_route', 'path')
      and from_hex_id is not null
      and to_hex_id is null
      and edge in ('E', 'SE', 'SW', 'W', 'NW', 'NE')
    )
    or (
      overlay_type = 'wall'
      and hex_id is not null
      and edge in ('E', 'SE', 'SW', 'W', 'NW', 'NE')
    )
    or (
      overlay_type = 'mist'
      and hex_id is not null
    )
    returning id
  )
  select count(*) into inserted_count from inserted;

  return coalesce(inserted_count, 0);
end;
$$;

create or replace function public.restore_generated_hex_region_snapshots(
  target_campaign_id uuid,
  region_snapshot jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  with snapshot as (
    select
      nullif(trim(coalesce(item.hex_ref, '')), '') as hex_ref,
      nullif(trim(coalesce(item.geographic_region_ref, '')), '') as geographic_region_ref,
      nullif(trim(coalesce(item.political_region_ref, '')), '') as political_region_ref
    from jsonb_to_recordset(coalesce(region_snapshot, '[]'::jsonb)) as item(
      hex_ref text,
      geographic_region_ref text,
      political_region_ref text
    )
  ),
  resolved as (
    select
      target_hex.id as hex_id,
      geo_region.id as geographic_region_id,
      pol_region.id as political_region_id
    from snapshot
    join public.hexes target_hex
      on target_hex.campaign_id = target_campaign_id
      and target_hex.ref_code = snapshot.hex_ref
      and target_hex.base_terrain is not null
    join public.regions geo_region
      on geo_region.campaign_id = target_campaign_id
      and geo_region.ref_code = snapshot.geographic_region_ref
      and geo_region.region_type = 'geographic'
    left join public.regions pol_region
      on pol_region.campaign_id = target_campaign_id
      and pol_region.ref_code = snapshot.political_region_ref
      and pol_region.region_type = 'political'
  ),
  updated as (
    update public.hexes target_hex
    set region_id = resolved.geographic_region_id,
        geographic_region_id = resolved.geographic_region_id,
        political_region_id = resolved.political_region_id,
        updated_at = now()
    from resolved
    where target_hex.id = resolved.hex_id
    returning target_hex.id
  )
  select count(*) into updated_count from updated;

  return coalesce(updated_count, 0);
end;
$$;

create or replace function public.restore_generated_hex_feature_snapshots(
  target_campaign_id uuid,
  feature_snapshot jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  with snapshot as (
    select
      nullif(trim(coalesce(item.hex_ref, '')), '') as hex_ref,
      coalesce(item.terrain_features, '[]'::jsonb) as terrain_features
    from jsonb_to_recordset(coalesce(feature_snapshot, '[]'::jsonb)) as item(
      hex_ref text,
      terrain_features jsonb
    )
  ),
  updated as (
    update public.hexes target_hex
    set terrain_features = snapshot.terrain_features,
        terrain = public.format_hex_mapper_terrain(target_hex.base_terrain, snapshot.terrain_features),
        updated_at = now()
    from snapshot
    where target_hex.campaign_id = target_campaign_id
      and target_hex.ref_code = snapshot.hex_ref
      and target_hex.base_terrain is not null
    returning target_hex.id
  )
  select count(*) into updated_count from updated;

  return coalesce(updated_count, 0);
end;
$$;

create or replace function public.restore_generated_hex_terrain_snapshots(
  target_campaign_id uuid,
  terrain_snapshot jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer := 0;
begin
  if auth.uid() is null or not public.can_shape_campaign_world(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  with snapshot as (
    select
      nullif(trim(coalesce(item.hex_ref, '')), '') as hex_ref,
      lower(trim(coalesce(item.base_terrain, ''))) as base_terrain,
      coalesce(item.terrain_features, '[]'::jsonb) as terrain_features,
      item.elevation as elevation
    from jsonb_to_recordset(coalesce(terrain_snapshot, '[]'::jsonb)) as item(
      hex_ref text,
      base_terrain text,
      terrain_features jsonb,
      elevation integer
    )
  ),
  normalized as (
    select
      hex_ref,
      base_terrain,
      (
        select coalesce(jsonb_agg(distinct lower(trim(value)) order by lower(trim(value))), '[]'::jsonb)
        from jsonb_array_elements_text(snapshot.terrain_features)
        where nullif(trim(value), '') is not null
          and lower(trim(value)) not in ('snowcap', 'mist')
      ) as terrain_features,
      elevation
    from snapshot
    where base_terrain in (
      'deep_sea',
      'sea',
      'coastal_water',
      'inland_water',
      'beach',
      'plains',
      'grassland',
      'lush_grassland',
      'wetland',
      'jungle_floor',
      'desert',
      'deep_desert',
      'barrens',
      'bleak_barrens',
      'snow',
      'rock',
      'wastes'
    )
  ),
  validated as (
    select *
    from normalized
    where jsonb_array_length(terrain_features) <= 3
      and not ((terrain_features ? 'woods') and (terrain_features ? 'forest'))
      and (
        case when terrain_features ? 'mountains' then 1 else 0 end +
        case when terrain_features ? 'snowcapped_mountains' then 1 else 0 end +
        case when terrain_features ? 'lone_mountain' then 1 else 0 end +
        case when terrain_features ? 'volcano' then 1 else 0 end
      ) <= 1
      and not exists (
        select 1
        from jsonb_array_elements_text(terrain_features) feature(value)
        where value not in (
          'woods',
          'forest',
          'jungle',
          'shrub',
          'cactus_scrub',
          'marsh',
          'kelp',
          'ridges',
          'mountains',
          'snowcapped_mountains',
          'cliffs',
          'lone_mountain',
          'volcano',
          'reef',
          'shoals',
          'water_rocks',
          'rapids',
          'falls',
          'whirlpool',
          'farmland',
          'sand',
          'waves',
          'ice'
        )
      )
  ),
  updated as (
    update public.hexes target_hex
    set base_terrain = validated.base_terrain,
        terrain_features = validated.terrain_features,
        elevation = validated.elevation,
        terrain = public.format_hex_mapper_terrain(validated.base_terrain, validated.terrain_features),
        updated_at = now()
    from validated
    where target_hex.campaign_id = target_campaign_id
      and target_hex.ref_code = validated.hex_ref
      and target_hex.base_terrain is not null
    returning target_hex.id
  )
  select count(*) into updated_count from updated;

  return coalesce(updated_count, 0);
end;
$$;

grant execute on function public.clear_generated_hex_region_layer(uuid, text) to authenticated;
grant execute on function public.clear_generated_hex_features(uuid) to authenticated;
grant execute on function public.restore_poi_group_snapshots(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.restore_generated_poi_snapshots(uuid, uuid[], jsonb) to authenticated;
grant execute on function public.restore_generated_map_overlays(uuid, jsonb) to authenticated;
grant execute on function public.restore_generated_hex_region_snapshots(uuid, jsonb) to authenticated;
grant execute on function public.restore_generated_hex_feature_snapshots(uuid, jsonb) to authenticated;
grant execute on function public.restore_generated_hex_terrain_snapshots(uuid, jsonb) to authenticated;
