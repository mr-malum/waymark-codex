-- =========================================================
-- Campaign Codex
-- POI / grouped POI edit management
-- =========================================================
-- 
-- Run this in Supabase SQL Editor before testing POI Edit.

create or replace function public.normalize_poi_category_type(raw_value text)
returns text
language sql
immutable
as $$
  select case lower(trim(coalesce(raw_value, '')))
    when 'settlement' then 'settlement'
    when 'stronghold' then 'stronghold'
    when 'dungeon' then 'dungeon'
    when 'dungeon complex' then 'dungeon_complex'
    when 'dungeon_complex' then 'dungeon_complex'
    when 'ruin' then 'ruin'
    when 'holy site' then 'holy_site'
    when 'holy_site' then 'holy_site'
    when 'arcane site' then 'arcane_site'
    when 'arcane_site' then 'arcane_site'
    when 'waypoint' then 'waypoint'
    when 'resource site' then 'resource_site'
    when 'resource_site' then 'resource_site'
    when 'wilderness site' then 'wilderness_site'
    when 'wilderness_site' then 'wilderness_site'
    when 'hazard' then 'hazard'
    when 'landmark' then 'landmark'
    else null
  end
$$;

create or replace function public.normalize_poi_notoriety_tier(raw_value text)
returns text
language sql
immutable
as $$
  with extracted as (
    select substring(coalesce(raw_value, '') from '([0-9]+)') as value_text
  )
  select case
    when value_text ~ '^(10|[1-9])$' then value_text
    else null
  end
  from extracted
$$;

create or replace function public.normalize_poi_icon_value(raw_value text)
returns text
language sql
immutable
as $$
  with normalized as (
    select trim(both '_' from regexp_replace(replace(replace(lower(trim(coalesce(raw_value, ''))), '''', ''), '’', ''), '[^a-z0-9]+', '_', 'g')) as icon_value
  )
  select case
    when icon_value in (
      'abbey', 'arcane_portal', 'bandit_camp', 'battlefield', 'bridge', 'campsite', 'castle', 'cave', 'chest', 'city', 'compass_rose',
      'crater', 'dead_tree', 'docks', 'dragon_lair', 'dungeon', 'farmstead', 'ferry', 'ford', 'fort', 'galleon', 'gate', 'geyser',
      'graveyard', 'harbor', 'hilltop_town', 'hunting_blind', 'kraken', 'lair', 'ley_nexus', 'lighthouse', 'lodge', 'lumber_camp',
      'lumber_mill', 'market', 'mausoleum', 'mine', 'monolith', 'mountain_city', 'mountain_gate', 'mountain_hold', 'mountain_pass',
      'oasis', 'obelisk', 'pirate_flag', 'port_town', 'pyramid', 'quarry', 'reef', 'rowboat', 'ruins', 'sacred_grove', 'sea_fort',
      'ship_stern', 'shipwreck', 'shrine', 'sloop', 'spring', 'standing_stones', 'stone_tower', 'swamp', 'tavern', 'temple', 'trader',
      'tree', 'unknown_marker', 'village', 'walled_city', 'walled_encampment', 'watchtower', 'waterfall', 'windmill', 'wizard_tower',
      'ziggurat'
    ) then icon_value
    else null
  end
  from normalized
$$;

create or replace function public.normalize_poi_tag_value(raw_value text)
returns text
language sql
immutable
as $$
  with normalized as (
    select trim(both '_' from regexp_replace(replace(replace(lower(trim(coalesce(raw_value, ''))), '''', ''), '’', ''), '[^a-z0-9]+', '_', 'g')) as tag_value
  )
  select case
    when tag_value in (
      'haunted', 'cursed', 'plagued', 'monster_lair', 'banditry', 'warzone', 'blighted', 'trapped', 'desecrated', 'lawless',
      'trade', 'rest', 'worship', 'research', 'mining', 'farming', 'fishing', 'smuggling', 'fortification', 'administration', 'pilgrimage', 'burial', 'refuge', 'craftwork',
      'active', 'abandoned', 'occupied', 'sealed', 'hidden', 'contested', 'ruined', 'besieged', 'reclaimed', 'dormant',
      'imperial', 'rebel', 'resistance', 'guild', 'cult', 'criminal', 'noble', 'ecclesiastical', 'military_order', 'arcane_order', 'tribal', 'mercantile',
      'dwarven', 'elven', 'fey', 'ancient', 'draconic', 'arcane', 'sacred', 'infernal', 'celestial', 'primordial', 'necromantic', 'giant_made',
      'underground', 'underwater', 'island', 'borderland', 'roadside', 'frontier', 'crossroads', 'river_crossing', 'offshore', 'remote',
      'forbidden', 'anomalous', 'lost', 'mythic', 'prophetic', 'shrouded', 'impossible', 'whispered', 'nameless', 'otherworldly'
    ) then tag_value
    else null
  end
  from normalized
$$;

create or replace function public.get_poi_tag_category(tag_value text)
returns text
language sql
immutable
as $$
  select case public.normalize_poi_tag_value(tag_value)
    when 'haunted' then 'danger'
    when 'cursed' then 'danger'
    when 'plagued' then 'danger'
    when 'monster_lair' then 'danger'
    when 'banditry' then 'danger'
    when 'warzone' then 'danger'
    when 'blighted' then 'danger'
    when 'trapped' then 'danger'
    when 'desecrated' then 'danger'
    when 'lawless' then 'danger'
    when 'trade' then 'function'
    when 'rest' then 'function'
    when 'worship' then 'function'
    when 'research' then 'function'
    when 'mining' then 'function'
    when 'farming' then 'function'
    when 'fishing' then 'function'
    when 'smuggling' then 'function'
    when 'fortification' then 'function'
    when 'administration' then 'function'
    when 'pilgrimage' then 'function'
    when 'burial' then 'function'
    when 'refuge' then 'function'
    when 'craftwork' then 'function'
    when 'active' then 'state'
    when 'abandoned' then 'state'
    when 'occupied' then 'state'
    when 'sealed' then 'state'
    when 'hidden' then 'state'
    when 'contested' then 'state'
    when 'ruined' then 'state'
    when 'besieged' then 'state'
    when 'reclaimed' then 'state'
    when 'dormant' then 'state'
    when 'imperial' then 'affiliation'
    when 'rebel' then 'affiliation'
    when 'resistance' then 'affiliation'
    when 'guild' then 'affiliation'
    when 'cult' then 'affiliation'
    when 'criminal' then 'affiliation'
    when 'noble' then 'affiliation'
    when 'ecclesiastical' then 'affiliation'
    when 'military_order' then 'affiliation'
    when 'arcane_order' then 'affiliation'
    when 'tribal' then 'affiliation'
    when 'mercantile' then 'affiliation'
    when 'dwarven' then 'character'
    when 'elven' then 'character'
    when 'fey' then 'character'
    when 'ancient' then 'character'
    when 'draconic' then 'character'
    when 'arcane' then 'character'
    when 'sacred' then 'character'
    when 'infernal' then 'character'
    when 'celestial' then 'character'
    when 'primordial' then 'character'
    when 'necromantic' then 'character'
    when 'giant_made' then 'character'
    when 'underground' then 'context'
    when 'underwater' then 'context'
    when 'island' then 'context'
    when 'borderland' then 'context'
    when 'roadside' then 'context'
    when 'frontier' then 'context'
    when 'crossroads' then 'context'
    when 'river_crossing' then 'context'
    when 'offshore' then 'context'
    when 'remote' then 'context'
    when 'forbidden' then 'mystery'
    when 'anomalous' then 'mystery'
    when 'lost' then 'mystery'
    when 'mythic' then 'mystery'
    when 'prophetic' then 'mystery'
    when 'shrouded' then 'mystery'
    when 'impossible' then 'mystery'
    when 'whispered' then 'mystery'
    when 'nameless' then 'mystery'
    when 'otherworldly' then 'mystery'
    else null
  end
$$;

create or replace function public.normalize_poi_tag_list(raw_values text[])
returns text[]
language plpgsql
immutable
as $$
declare
  raw_tag_value text;
  normalized_tag_value text;
  normalized_values text[] := '{}'::text[];
begin
  foreach raw_tag_value in array coalesce(raw_values, '{}'::text[]) loop
    normalized_tag_value := public.normalize_poi_tag_value(raw_tag_value);

    if normalized_tag_value is null then
      raise exception 'POI tags must use supported canonical values.';
    end if;

    if normalized_tag_value = any(normalized_values) then
      continue;
    end if;

    normalized_values := normalized_values || normalized_tag_value;
  end loop;

  if coalesce(array_length(normalized_values, 1), 0) > 4 then
    raise exception 'POI tags are limited to 4 per place.';
  end if;

  if (
    select count(*)
    from unnest(normalized_values) as value
    where public.get_poi_tag_category(value) = 'state'
  ) > 2 then
    raise exception 'POI tags allow at most 2 State tags.';
  end if;

  if (
    select count(*)
    from unnest(normalized_values) as value
    where public.get_poi_tag_category(value) = 'affiliation'
  ) > 2 then
    raise exception 'POI tags allow at most 2 Affiliation tags.';
  end if;

  if (
    select count(*)
    from unnest(normalized_values) as value
    where public.get_poi_tag_category(value) = 'character'
  ) > 2 then
    raise exception 'POI tags allow at most 2 Character tags.';
  end if;

  if (
    select count(*)
    from unnest(normalized_values) as value
    where public.get_poi_tag_category(value) = 'mystery'
  ) > 2 then
    raise exception 'POI tags allow at most 2 Mystery tags.';
  end if;

  return normalized_values;
end;
$$;

create or replace function public.are_poi_group_hex_refs_adjacent(left_hex_ref text, right_hex_ref text)
returns boolean
language plpgsql
immutable
as $$
declare
  left_match text[];
  right_match text[];
  left_x integer;
  left_y integer;
  right_x integer;
  right_y integer;
begin
  if nullif(trim(coalesce(left_hex_ref, '')), '') is null
    or nullif(trim(coalesce(right_hex_ref, '')), '') is null then
    return false;
  end if;

  left_match := regexp_match(trim(left_hex_ref), '^(-?\d+)\s*:\s*(-?\d+)$');
  right_match := regexp_match(trim(right_hex_ref), '^(-?\d+)\s*:\s*(-?\d+)$');
  if left_match is null or right_match is null then
    return false;
  end if;

  left_x := left_match[1]::integer;
  left_y := left_match[2]::integer;
  right_x := right_match[1]::integer;
  right_y := right_match[2]::integer;

  if mod(left_x, 2) = 0 then
    return
      (right_x = left_x + 1 and right_y = left_y)
      or (right_x = left_x and right_y = left_y + 1)
      or (right_x = left_x - 1 and right_y = left_y)
      or (right_x = left_x - 1 and right_y = left_y - 1)
      or (right_x = left_x and right_y = left_y - 1)
      or (right_x = left_x + 1 and right_y = left_y - 1);
  end if;

  return
    (right_x = left_x + 1 and right_y = left_y + 1)
    or (right_x = left_x and right_y = left_y + 1)
    or (right_x = left_x - 1 and right_y = left_y + 1)
    or (right_x = left_x - 1 and right_y = left_y)
    or (right_x = left_x and right_y = left_y - 1)
    or (right_x = left_x + 1 and right_y = left_y);
end;
$$;

create or replace function public.ensure_poi_group_child_adjacency(
  target_campaign_id uuid,
  target_hex_id uuid,
  target_poi_group_id uuid,
  excluded_poi_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_hex_ref text;
  sibling_count integer := 0;
begin
  if target_poi_group_id is null or target_hex_id is null then
    return;
  end if;

  select coalesce(nullif(trim(h.ref_code), ''), nullif(trim(h.map_xy), ''))
    into target_hex_ref
  from public.hexes h
  where h.campaign_id = target_campaign_id
    and h.id = target_hex_id;

  if nullif(trim(coalesce(target_hex_ref, '')), '') is null then
    return;
  end if;

  select count(*)
    into sibling_count
  from public.pois p
  where p.campaign_id = target_campaign_id
    and p.poi_group_id = target_poi_group_id
    and (excluded_poi_id is null or p.id <> excluded_poi_id);

  if sibling_count = 0 then
    return;
  end if;

  if exists (
    select 1
    from public.pois p
    join public.hexes h
      on h.id = p.hex_id
    where p.campaign_id = target_campaign_id
      and p.poi_group_id = target_poi_group_id
      and (excluded_poi_id is null or p.id <> excluded_poi_id)
      and public.are_poi_group_hex_refs_adjacent(
        target_hex_ref,
        coalesce(nullif(trim(h.ref_code), ''), nullif(trim(h.map_xy), ''))
      )
  ) then
    return;
  end if;

  raise exception 'Child Areas added to a grouped POI must use a hex adjacent to an existing child Area in that group.';
end;
$$;

drop function if exists public.update_poi_record(
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid,
  text,
  text,
  text
);

drop function if exists public.update_poi_record(
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid,
  text,
  text[],
  text,
  text
);

drop function if exists public.update_poi_group_record(
  uuid,
  uuid,
  text,
  text,
  text,
  text
);

drop function if exists public.update_poi_group_record(
  uuid,
  uuid,
  text,
  text,
  text[],
  text,
  text
);

drop function if exists public.set_poi_group_parent(
  uuid,
  uuid,
  uuid
);

create or replace function public.update_poi_record(
  target_campaign_id uuid,
  target_poi_id uuid,
  poi_name text,
  new_poi_type text,
  new_poi_icon text,
  poi_hex_id uuid,
  new_poi_group_id uuid default null,
  new_poi_notoriety_tier text default null,
  new_poi_tags text[] default '{}'::text[],
  new_poi_population text default null,
  new_poi_lore text default null
)
returns public.pois
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_poi_type text;
  normalized_poi_icon text;
  normalized_notoriety_tier text;
  normalized_poi_tags text[];
  current_group_id uuid;
  current_hex_id uuid;
  updated_record public.pois;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if nullif(trim(poi_name), '') is null then
    raise exception 'POI name is required.';
  end if;

  if nullif(trim(new_poi_type), '') is null then
    raise exception 'POI type is required.';
  end if;

  normalized_poi_type := public.normalize_poi_category_type(new_poi_type);
  if normalized_poi_type is null then
    raise exception 'POI type must use a supported canonical value.';
  end if;

  if nullif(trim(new_poi_icon), '') is null then
    raise exception 'POI icon is required.';
  end if;

  normalized_poi_icon := public.normalize_poi_icon_value(new_poi_icon);
  if normalized_poi_icon is null then
    raise exception 'POI icon must use a supported value from the picker.';
  end if;

  if nullif(trim(new_poi_notoriety_tier), '') is null then
    raise exception 'POI notoriety is required.';
  end if;

  normalized_notoriety_tier := public.normalize_poi_notoriety_tier(new_poi_notoriety_tier);
  if normalized_notoriety_tier is null then
    raise exception 'POI notoriety must use a supported value from 1 to 10.';
  end if;

  normalized_poi_tags := public.normalize_poi_tag_list(new_poi_tags);

  if normalized_poi_type = 'settlement'
    and new_poi_group_id is null
    and nullif(trim(new_poi_population), '') is null then
    raise exception 'Population is required for Settlements.';
  end if;

  if poi_hex_id is null then
    raise exception 'POI hex is required.';
  end if;

  select p.poi_group_id, p.hex_id
    into current_group_id, current_hex_id
  from public.pois p
  where p.campaign_id = target_campaign_id
    and p.id = target_poi_id;

  if current_hex_id is null then
    raise exception 'POI not found.';
  end if;

  if not exists (
    select 1
    from public.hexes h
    where h.campaign_id = target_campaign_id
      and h.id = poi_hex_id
  ) then
    raise exception 'Selected hex does not belong to this campaign.';
  end if;

  if new_poi_group_id is not null and not exists (
    select 1
    from public.poi_groups pg
    where pg.campaign_id = target_campaign_id
      and pg.id = new_poi_group_id
  ) then
    raise exception 'Selected POI group does not belong to this campaign.';
  end if;

  if new_poi_group_id is not null
    and (
      current_group_id is distinct from new_poi_group_id
      or current_hex_id is distinct from poi_hex_id
    ) then
    perform public.ensure_poi_group_child_adjacency(
      target_campaign_id,
      poi_hex_id,
      new_poi_group_id,
      target_poi_id
    );
  end if;

  update public.pois
  set name = trim(poi_name),
      poi_type = normalized_poi_type,
      poi_icon = normalized_poi_icon,
      hex_id = poi_hex_id,
      poi_group_id = new_poi_group_id,
      notoriety_tier = normalized_notoriety_tier,
      poi_tags = normalized_poi_tags,
      population = nullif(trim(new_poi_population), ''),
      lore = nullif(trim(new_poi_lore), ''),
      updated_at = now()
  where campaign_id = target_campaign_id
    and id = target_poi_id
  returning * into updated_record;

  return updated_record;
end;
$$;

grant execute on function public.update_poi_record(
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  uuid,
  text,
  text[],
  text,
  text
) to authenticated;


create or replace function public.update_poi_group_record(
  target_campaign_id uuid,
  target_poi_group_id uuid,
  group_name text,
  new_group_type text,
  new_group_icon text,
  new_group_tags text[] default '{}'::text[],
  new_group_population text default null,
  new_group_lore text default null
)
returns public.poi_groups
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_group_type text;
  normalized_group_icon text;
  normalized_group_tags text[];
  updated_record public.poi_groups;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  if nullif(trim(group_name), '') is null then
    raise exception 'Grouped POI name is required.';
  end if;

  if nullif(trim(new_group_type), '') is null then
    raise exception 'Grouped POI type is required.';
  end if;

  normalized_group_type := public.normalize_poi_category_type(new_group_type);
  if normalized_group_type is null then
    raise exception 'Grouped POI type must use a supported canonical value.';
  end if;

  if nullif(trim(new_group_icon), '') is null then
    raise exception 'Grouped POI icon is required.';
  end if;

  normalized_group_icon := public.normalize_poi_icon_value(new_group_icon);
  if normalized_group_icon is null then
    raise exception 'Grouped POI icon must use a supported value from the picker.';
  end if;

  normalized_group_tags := public.normalize_poi_tag_list(new_group_tags);

  update public.poi_groups
  set name = trim(group_name),
      group_type = normalized_group_type,
      group_icon = normalized_group_icon,
      group_tags = normalized_group_tags,
      population = nullif(trim(new_group_population), ''),
      lore = nullif(trim(new_group_lore), ''),
      updated_at = now()
  where campaign_id = target_campaign_id
    and id = target_poi_group_id
  returning * into updated_record;

  if updated_record.id is null then
    raise exception 'Grouped POI not found.';
  end if;

  return updated_record;
end;
$$;

grant execute on function public.update_poi_group_record(
  uuid,
  uuid,
  text,
  text,
  text,
  text[],
  text,
  text
) to authenticated;


create or replace function public.set_poi_group_parent(
  target_campaign_id uuid,
  target_poi_id uuid,
  target_poi_group_id uuid default null
)
returns public.pois
language plpgsql
security definer
set search_path = public
as $$
declare
  current_group_id uuid;
  current_hex_id uuid;
  updated_record public.pois;
begin
  if auth.uid() is null then
    raise exception 'not authorized';
  end if;

  if not public.can_edit_campaign(target_campaign_id) then
    raise exception 'not authorized';
  end if;

  select p.poi_group_id, p.hex_id
    into current_group_id, current_hex_id
  from public.pois p
  where p.campaign_id = target_campaign_id
    and p.id = target_poi_id;

  if current_hex_id is null then
    raise exception 'POI not found.';
  end if;

  if target_poi_group_id is not null and not exists (
    select 1
    from public.poi_groups pg
    where pg.campaign_id = target_campaign_id
      and pg.id = target_poi_group_id
  ) then
    raise exception 'Selected POI group does not belong to this campaign.';
  end if;

  if target_poi_group_id is not null
    and current_group_id is distinct from target_poi_group_id then
    perform public.ensure_poi_group_child_adjacency(
      target_campaign_id,
      current_hex_id,
      target_poi_group_id,
      target_poi_id
    );
  end if;

  update public.pois
  set poi_group_id = target_poi_group_id,
      updated_at = now()
  where campaign_id = target_campaign_id
    and id = target_poi_id
  returning * into updated_record;

  return updated_record;
end;
$$;

grant execute on function public.set_poi_group_parent(uuid, uuid, uuid)
  to authenticated;
