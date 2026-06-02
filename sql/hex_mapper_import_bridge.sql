-- =========================================================
-- Waymark Codex
-- Hex Mapper import bridge
-- =========================================================
--
-- Run this in Supabase SQL Editor before importing Hex Mapper exports.
-- First milestone scope:
-- - owner-only finalized JSON import
-- - generated map campaign metadata
-- - shared regions table with geographic/political typing
-- - dual hex region refs, while keeping legacy region_id in sync
-- - non-destructive hex upserts

alter table public.campaigns
  add column if not exists map_mode text not null default 'static',
  add column if not exists generated_map_config jsonb not null default '{}'::jsonb;

alter table public.campaigns
  drop constraint if exists campaigns_map_mode_check;

alter table public.campaigns
  add constraint campaigns_map_mode_check
  check (map_mode in ('static', 'generated'));

alter table public.regions
  add column if not exists region_type text not null default 'geographic',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists border_color text not null default '#ffd84d';

alter table public.regions
  drop constraint if exists regions_region_type_check;

alter table public.regions
  add constraint regions_region_type_check
  check (region_type in ('geographic', 'political'));

alter table public.regions
  drop constraint if exists regions_border_color_check;

update public.regions
set border_color = case border_color
  when 'red' then '#ff2d2d'
  when 'blue' then '#1f7cff'
  when 'yellow' then '#ffe600'
  when 'green' then '#39ff14'
  when 'orange' then '#ff8a00'
  when 'purple' then '#bf4dff'
  when 'black' then '#070707'
  when 'white' then '#ffffff'
  when 'brown' then '#d9782d'
  when 'gold' then '#ffd84d'
  when 'none' then 'none'
  else case
    when border_color ~ '^#[0-9a-fA-F]{6}$' then lower(border_color)
    else '#ffd84d'
  end
end;

alter table public.regions
  add constraint regions_border_color_check
  check (border_color = 'none' or border_color ~ '^#[0-9a-fA-F]{6}$');

update public.regions
set border_color = 'none'
where ref_code = 'REG-0000'
  and region_type = 'geographic';

alter table public.hexes
  add column if not exists geographic_region_id uuid references public.regions(id) on delete set null,
  add column if not exists political_region_id uuid references public.regions(id) on delete set null,
  add column if not exists base_terrain text,
  add column if not exists terrain_features jsonb not null default '[]'::jsonb,
  add column if not exists elevation integer,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.hexes
set geographic_region_id = region_id
where geographic_region_id is null
  and region_id is not null;

create index if not exists idx_regions_campaign_type_ref
  on public.regions (campaign_id, region_type, ref_code);

create index if not exists idx_hexes_campaign_geographic_region
  on public.hexes (campaign_id, geographic_region_id);

create index if not exists idx_hexes_campaign_political_region
  on public.hexes (campaign_id, political_region_id);

create index if not exists idx_hexes_campaign_ref_code
  on public.hexes (campaign_id, ref_code);

create or replace function public.format_hex_mapper_terrain(
  base_terrain text,
  terrain_features jsonb default '[]'::jsonb
)
returns text
language plpgsql
immutable
as $$
declare
  base_label text;
  feature_labels text[];
  feature_id text;
begin
  base_label := case base_terrain
    when 'deep_sea' then 'Deep Sea'
    when 'sea' then 'Sea'
    when 'coastal_water' then 'Coastal Water'
    when 'inland_water' then 'Inland Water'
    when 'beach' then 'Beach'
    when 'plains' then 'Plains'
    when 'grassland' then 'Grassland'
    when 'lush_grassland' then 'Lush Grassland'
    when 'wetland' then 'Wetland'
    when 'jungle_floor' then 'Jungle Floor'
    when 'desert' then 'Desert'
    when 'deep_desert' then 'Deep Desert'
    when 'barrens' then 'Barrens'
    when 'bleak_barrens' then 'Bleak Barrens'
    when 'snow' then 'Snow'
    when 'rock' then 'Rock'
    when 'wastes' then 'Wastes'
    else initcap(replace(coalesce(nullif(base_terrain, ''), 'unknown'), '_', ' '))
  end;

  feature_labels := array[]::text[];

  for feature_id in
    select jsonb_array_elements_text(coalesce(terrain_features, '[]'::jsonb))
  loop
    feature_labels := feature_labels || case feature_id
      when 'woods' then 'Woods'
      when 'forest' then 'Forest'
      when 'jungle' then 'Jungle'
      when 'shrub' then 'Shrub'
      when 'cactus_scrub' then 'Cactus Scrub'
      when 'marsh' then 'Marsh'
      when 'kelp' then 'Kelp'
      when 'ridges' then 'Ridges'
      when 'mountains' then 'Mountains'
      when 'snowcapped_mountains' then 'Snowcapped Mountains'
      when 'cliffs' then 'Cliffs'
      when 'lone_mountain' then 'Lone Mountain'
      when 'volcano' then 'Volcano'
      when 'reef' then 'Reef'
      when 'shoals' then 'Shoals'
      when 'water_rocks' then 'Water Rocks'
      when 'rapids' then 'Rapids'
      when 'falls' then 'Falls'
      when 'whirlpool' then 'Whirlpool'
      when 'farmland' then 'Farmland'
      when 'sand' then 'Sand'
      when 'waves' then 'Waves'
      when 'ice' then 'Ice'
      when 'snowcap' then 'Snowcap'
      else initcap(replace(feature_id, '_', ' '))
    end;
  end loop;

  if array_length(feature_labels, 1) is null then
    return base_label;
  end if;

  return array_to_string(feature_labels, ', ') || ' / ' || base_label;
end;
$$;

create or replace function public.ensure_campaign_region(
  target_campaign_id uuid,
  target_ref_code text,
  target_name text,
  target_region_type text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_id uuid;
  created_id uuid;
begin
  if target_region_type not in ('geographic', 'political') then
    raise exception 'unsupported region type';
  end if;

  select id
    into existing_id
  from public.regions
  where campaign_id = target_campaign_id
    and ref_code = target_ref_code
  limit 1;

  if existing_id is not null then
    update public.regions
    set name = coalesce(nullif(name, ''), nullif(trim(target_name), ''), target_ref_code),
        region_type = target_region_type,
        border_color = case
          when target_ref_code = 'REG-0000' and target_region_type = 'geographic' then 'none'
          else border_color
        end,
        updated_at = now()
    where id = existing_id
    returning id into created_id;

    return created_id;
  end if;

  insert into public.regions (
    campaign_id,
    ref_code,
    name,
    region_type,
    border_color,
    created_by
  )
  values (
    target_campaign_id,
    target_ref_code,
    coalesce(nullif(trim(target_name), ''), target_ref_code),
    target_region_type,
    case
      when target_ref_code = 'REG-0000' and target_region_type = 'geographic' then 'none'
      else 'gold'
    end,
    auth.uid()
  )
  returning id into created_id;

  return created_id;
end;
$$;

create or replace function public.prevent_reserved_region_change()
returns trigger
language plpgsql
as $$
begin
  if old.ref_code = 'REG-0000' and old.region_type = 'geographic' then
    if tg_op = 'DELETE' then
      raise exception 'REG-0000 is reserved and cannot be deleted';
    end if;

    if new.ref_code <> old.ref_code or new.region_type <> old.region_type then
      raise exception 'REG-0000 ref and type are reserved';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_reserved_region_change on public.regions;
create trigger trg_prevent_reserved_region_change
before update or delete on public.regions
for each row execute function public.prevent_reserved_region_change();

create or replace function public.import_hex_mapper_export(
  target_campaign_id uuid,
  export_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.has_campaign_role(
    target_campaign_id,
    array['owner']::public.campaign_role[]
  ) then
    raise exception 'only campaign owners can import generated maps';
  end if;

  return public.import_hex_mapper_export_as_owner(target_campaign_id, export_payload);
end;
$$;

create or replace function public.import_hex_mapper_export_as_owner(
  target_campaign_id uuid,
  export_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  grid jsonb;
  region_record jsonb;
  hex_record jsonb;
  hex_id uuid;
  geo_region_id uuid;
  target_political_region_id uuid;
  geo_ref text;
  political_ref text;
  x_coord integer;
  y_coord integer;
  ref text;
  base text;
  features jsonb;
  terrain_label text;
  imported_count integer := 0;
  updated_count integer := 0;
  inserted_count integer := 0;
begin
  if coalesce(export_payload->>'mapType', '') not in ('campaign-codex-hex-map', 'waymark-codex-hex-map') then
    raise exception 'unsupported Hex Mapper export';
  end if;

  grid := coalesce(export_payload->'grid', '{}'::jsonb);

  if coalesce(grid->>'coordinateSystem', '') <> 'x,y'
    or coalesce(grid->>'orientation', '') <> 'flat-top'
    or coalesce(grid->>'offset', '') <> 'odd-column'
  then
    raise exception 'unsupported Hex Mapper grid';
  end if;

  geo_region_id := public.ensure_campaign_region(
    target_campaign_id,
    'REG-0000',
    'Wilderness',
    'geographic'
  );

  for region_record in
    select value from jsonb_array_elements(coalesce(export_payload->'regions', '[]'::jsonb))
  loop
    if coalesce(region_record->>'id', '') = '' then
      continue;
    end if;

    if coalesce(region_record->>'region_type', 'geographic') = 'political'
      and region_record->>'id' = 'POL-0000'
    then
      continue;
    end if;

    perform public.ensure_campaign_region(
      target_campaign_id,
      region_record->>'id',
      coalesce(region_record->>'name', region_record->>'id'),
      case
        when coalesce(region_record->>'region_type', 'geographic') = 'political'
          then 'political'
        else 'geographic'
      end
    );
  end loop;

  for hex_record in
    select value from jsonb_array_elements(coalesce(export_payload->'hexes', '[]'::jsonb))
  loop
    x_coord := nullif(hex_record->>'x', '')::integer;
    y_coord := nullif(hex_record->>'y', '')::integer;
    ref := x_coord::text || ':' || y_coord::text;
    base := nullif(hex_record->>'baseTerrain', '');
    features := (
      select coalesce(jsonb_agg(feature.value order by feature.ordinality), '[]'::jsonb)
      from jsonb_array_elements_text(coalesce(hex_record->'features', '[]'::jsonb))
        with ordinality as feature(value, ordinality)
      where feature.value <> 'mist'
    );
    terrain_label := public.format_hex_mapper_terrain(base, features);
    geo_ref := coalesce(nullif(hex_record->>'geographicRegionId', ''), 'REG-0000');
    political_ref := nullif(hex_record->>'politicalRegionId', '');

    select id
      into geo_region_id
    from public.regions
    where campaign_id = target_campaign_id
      and ref_code = geo_ref
    limit 1;

    if geo_region_id is null then
      geo_region_id := public.ensure_campaign_region(
        target_campaign_id,
        geo_ref,
        geo_ref,
        'geographic'
      );
    end if;

    target_political_region_id := null;
    if political_ref is not null and political_ref <> 'POL-0000' then
      select id
        into target_political_region_id
      from public.regions
      where campaign_id = target_campaign_id
        and ref_code = political_ref
      limit 1;

      if target_political_region_id is null then
        target_political_region_id := public.ensure_campaign_region(
          target_campaign_id,
          political_ref,
          political_ref,
          'political'
        );
      end if;
    end if;

    select id
      into hex_id
    from public.hexes
    where campaign_id = target_campaign_id
      and ref_code = ref
    limit 1;

    if hex_id is null then
      insert into public.hexes (
        campaign_id,
        ref_code,
        terrain,
        map_xy,
        region_id,
        geographic_region_id,
        political_region_id,
        base_terrain,
        terrain_features,
        elevation,
        created_by
      )
      values (
        target_campaign_id,
        ref,
        terrain_label,
        ref,
        geo_region_id,
        geo_region_id,
        target_political_region_id,
        base,
        features,
        nullif(hex_record->>'elevation', '')::integer,
        auth.uid()
      );

      inserted_count := inserted_count + 1;
    else
      update public.hexes
      set terrain = terrain_label,
          map_xy = ref,
          region_id = geo_region_id,
          geographic_region_id = geo_region_id,
          political_region_id = target_political_region_id,
          base_terrain = base,
          terrain_features = features,
          elevation = nullif(hex_record->>'elevation', '')::integer,
          updated_at = now()
      where id = hex_id;

      updated_count := updated_count + 1;
    end if;

    imported_count := imported_count + 1;
  end loop;

  update public.campaigns
  set map_mode = 'generated',
      generated_map_config = jsonb_build_object(
        'schemaVersion', export_payload->'schemaVersion',
        'mapType', 'waymark-codex-hex-map',
        'grid', grid,
        'editor', coalesce(export_payload->'editor', '{}'::jsonb)
      ),
      updated_at = now()
  where id = target_campaign_id;

  return jsonb_build_object(
    'hexesImported', imported_count,
    'hexesInserted', inserted_count,
    'hexesUpdated', updated_count,
    'defaultRegionId', geo_region_id
  );
end;
$$;

grant execute on function public.import_hex_mapper_export(uuid, jsonb)
  to authenticated;

grant execute on function public.import_hex_mapper_export_as_owner(uuid, jsonb)
  to authenticated;

notify pgrst, 'reload schema';
