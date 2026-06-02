-- =========================================================
-- Waymark Codex
-- Backfill canonical POI / grouped POI type values
-- =========================================================
--
-- Targeted migration helper for moving free-text poi_type / group_type
-- values onto the controlled canonical list used by the app.
--
-- Recommended order:
-- 1. Run create_poi_with_next_ref_code.sql
-- 2. Run edit_poi_management.sql
-- 3. Run this file

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

-- Normalize any already-canonical label values across every campaign.
update public.poi_groups
set group_type = public.normalize_poi_category_type(group_type)
where group_type is not null
  and public.normalize_poi_category_type(group_type) is not null
  and group_type is distinct from public.normalize_poi_category_type(group_type);

update public.pois
set poi_type = public.normalize_poi_category_type(poi_type)
where poi_type is not null
  and public.normalize_poi_category_type(poi_type) is not null
  and poi_type is distinct from public.normalize_poi_category_type(poi_type);

-- Apply the explicit legacy remap list for campaign 83de6e77-e967-4df2-aa57-b9e9024d84e1.
with mapped_pois(name, canonical_type) as (
  values
    ('Zu''klas Village', 'settlement'),
    ('Perfect Oasis', 'wilderness_site'),
    ('Secluded Caves', 'dungeon'),
    ('Myrnak Tower', 'dungeon_complex'),
    ('Tomb of the Hillrider', 'dungeon'),
    ('Mistyvale', 'settlement'),
    ('Sage''s Mount', 'wilderness_site'),
    ('City of Blasted Glass', 'ruin'),
    ('Castle Fate', 'stronghold'),
    ('Pits of Ral Parthana', 'dungeon'),
    ('Friendship Abbey', 'holy_site'),
    ('Haunchrest Inn', 'waypoint'),
    ('Grandaburg - Farms 4', 'resource_site'),
    ('Grandaburg - Farms 3', 'resource_site'),
    ('Grandaburg City Center', 'settlement'),
    ('Grandaburg - Farms 5', 'resource_site'),
    ('Grandaburg - Farms 2', 'resource_site'),
    ('Grandaburg - Farms 1', 'resource_site'),
    ('Grandaburg - Farms 6', 'resource_site'),
    ('Mountain Temple Summit', 'holy_site'),
    ('Mountain Temple Entrance', 'dungeon'),
    ('City of Erikol - East', 'settlement'),
    ('City of Erikol - West', 'settlement'),
    ('Smuggler''s Hold', 'dungeon'),
    ('Ruined Ziggurat', 'ruin'),
    ('Dwarven Obelisk', 'landmark'),
    ('Dwarven City of Stein-los', 'settlement'),
    ('The Deep Cities', 'dungeon_complex'),
    ('Garden of Dwarf Heroes', 'holy_site'),
    ('The Tainted City - Ruins', 'ruin'),
    ('The Tainted City - Dungeon', 'dungeon'),
    ('City of Torgos - District 1', 'settlement'),
    ('City of Torgos - Docks West', 'settlement'),
    ('City of Torgos - District 3', 'settlement'),
    ('City of Torgos - District 4', 'settlement'),
    ('City of Torgos - District 2', 'settlement'),
    ('City of Torgos - Docks East', 'settlement'),
    ('Ruined Fishing Village', 'ruin'),
    ('Woodland Lodge of Elfwine', 'waypoint'),
    ('Abandoned Shelter', 'waypoint')
)
update public.pois target
set poi_type = mapped_pois.canonical_type
from mapped_pois
where target.campaign_id = '83de6e77-e967-4df2-aa57-b9e9024d84e1'::uuid
  and target.name = mapped_pois.name
  and target.poi_type is distinct from mapped_pois.canonical_type;

-- Verify the explicit campaign remap landed as expected.
with expected(name, canonical_type) as (
  values
    ('Zu''klas Village', 'settlement'),
    ('Perfect Oasis', 'wilderness_site'),
    ('Secluded Caves', 'dungeon'),
    ('Myrnak Tower', 'dungeon_complex'),
    ('Tomb of the Hillrider', 'dungeon'),
    ('Mistyvale', 'settlement'),
    ('Sage''s Mount', 'wilderness_site'),
    ('City of Blasted Glass', 'ruin'),
    ('Castle Fate', 'stronghold'),
    ('Pits of Ral Parthana', 'dungeon'),
    ('Friendship Abbey', 'holy_site'),
    ('Haunchrest Inn', 'waypoint'),
    ('Grandaburg - Farms 4', 'resource_site'),
    ('Grandaburg - Farms 3', 'resource_site'),
    ('Grandaburg City Center', 'settlement'),
    ('Grandaburg - Farms 5', 'resource_site'),
    ('Grandaburg - Farms 2', 'resource_site'),
    ('Grandaburg - Farms 1', 'resource_site'),
    ('Grandaburg - Farms 6', 'resource_site'),
    ('Mountain Temple Summit', 'holy_site'),
    ('Mountain Temple Entrance', 'dungeon'),
    ('City of Erikol - East', 'settlement'),
    ('City of Erikol - West', 'settlement'),
    ('Smuggler''s Hold', 'dungeon'),
    ('Ruined Ziggurat', 'ruin'),
    ('Dwarven Obelisk', 'landmark'),
    ('Dwarven City of Stein-los', 'settlement'),
    ('The Deep Cities', 'dungeon_complex'),
    ('Garden of Dwarf Heroes', 'holy_site'),
    ('The Tainted City - Ruins', 'ruin'),
    ('The Tainted City - Dungeon', 'dungeon'),
    ('City of Torgos - District 1', 'settlement'),
    ('City of Torgos - Docks West', 'settlement'),
    ('City of Torgos - District 3', 'settlement'),
    ('City of Torgos - District 4', 'settlement'),
    ('City of Torgos - District 2', 'settlement'),
    ('City of Torgos - Docks East', 'settlement'),
    ('Ruined Fishing Village', 'ruin'),
    ('Woodland Lodge of Elfwine', 'waypoint'),
    ('Abandoned Shelter', 'waypoint')
)
select
  expected.name,
  expected.canonical_type as expected_type,
  pois.poi_type as actual_type
from expected
left join public.pois pois
  on pois.campaign_id = '83de6e77-e967-4df2-aa57-b9e9024d84e1'::uuid
 and pois.name = expected.name
where pois.id is null
   or pois.poi_type is distinct from expected.canonical_type
order by expected.name;

-- Audit any remaining legacy POI type values across all campaigns.
select
  campaign_id,
  poi_type,
  count(*) as record_count
from public.pois
where poi_type is null
   or poi_type is distinct from public.normalize_poi_category_type(poi_type)
group by campaign_id, poi_type
order by campaign_id, poi_type;

-- Audit any remaining legacy grouped POI type values across all campaigns.
select
  campaign_id,
  group_type,
  count(*) as record_count
from public.poi_groups
where group_type is null
   or group_type is distinct from public.normalize_poi_category_type(group_type)
group by campaign_id, group_type
order by campaign_id, group_type;
