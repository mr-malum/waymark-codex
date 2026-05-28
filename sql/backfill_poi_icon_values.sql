-- =========================================================
-- Campaign Codex
-- Backfill canonical POI / grouped POI icon values
-- =========================================================
--
-- Neutral migration helper for moving existing blank or legacy icon values
-- onto the controlled icon list used by the app.
--
-- This does NOT infer icons from POI type. Any row without a recognized icon
-- is backfilled to `unknown_marker` so the new constraint can validate cleanly.
--
-- Recommended order:
-- 1. Run create_poi_with_next_ref_code.sql
-- 2. Run edit_poi_management.sql
-- 3. Run this file

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
      'abbey', 'abandoned_shack', 'anchor', 'arcane_portal', 'bandit_camp', 'battlefield', 'border_post', 'bridge', 'bridge_gate',
      'campsite', 'canyon_pass', 'castle', 'catacombs', 'cave', 'chest', 'city', 'compass_rose', 'crater', 'crypt', 'dead_tree',
      'docks', 'dragon_lair', 'dungeon', 'farmstead', 'ferry', 'fishing_camp', 'ford', 'fort', 'galleon', 'gate', 'geyser',
      'graveyard', 'harbor', 'hilltop_town', 'hunting_blind', 'inn', 'island', 'island_2', 'kraken', 'laboratory', 'lair',
      'ley_nexus', 'lighthouse', 'lodge', 'lumber_camp', 'lumber_mill', 'market', 'mausoleum', 'mine', 'monolith', 'mountain_city',
      'mountain_gate', 'mountain_hold', 'mountain_pass', 'oasis', 'obelisk', 'observatory', 'pirate_flag', 'plague_marker',
      'port_town', 'pyramid', 'quarry', 'reef', 'roadside_shrine', 'rowboat', 'ruins', 'sacred_grove', 'sea_fort', 'ship_stern',
      'shipwreck', 'shrine', 'skull_marker', 'sloop', 'spring', 'standing_stones', 'stone_tower', 'swamp', 'tavern', 'temple',
      'trade_goods', 'trader', 'tree', 'unknown_marker', 'village', 'volcano', 'warehouse', 'walled_city', 'walled_encampment',
      'watch_fire', 'watchtower', 'waterfall', 'whirlpool', 'windmill', 'wizard_tower', 'ziggurat'
    ) then icon_value
    else null
  end
  from normalized
$$;

update public.pois
set poi_icon = coalesce(public.normalize_poi_icon_value(poi_icon), 'unknown_marker')
where nullif(trim(coalesce(poi_icon, '')), '') is null
   or poi_icon is distinct from public.normalize_poi_icon_value(poi_icon);

update public.poi_groups
set group_icon = coalesce(public.normalize_poi_icon_value(group_icon), 'unknown_marker')
where nullif(trim(coalesce(group_icon, '')), '') is null
   or group_icon is distinct from public.normalize_poi_icon_value(group_icon);

-- Audit any remaining invalid or blank POI icon values across all campaigns.
select
  campaign_id,
  poi_icon,
  count(*) as record_count
from public.pois
where nullif(trim(coalesce(poi_icon, '')), '') is null
   or poi_icon is distinct from public.normalize_poi_icon_value(poi_icon)
group by campaign_id, poi_icon
order by campaign_id, poi_icon;

-- Audit any remaining invalid or blank grouped POI icon values across all campaigns.
select
  campaign_id,
  group_icon,
  count(*) as record_count
from public.poi_groups
where nullif(trim(coalesce(group_icon, '')), '') is null
   or group_icon is distinct from public.normalize_poi_icon_value(group_icon)
group by campaign_id, group_icon
order by campaign_id, group_icon;
