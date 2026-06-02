-- =========================================================
-- Waymark Codex
-- Generated campaign migration verification
-- =========================================================
--
-- Replace the campaign id below with the generated test campaign id.
-- This query does not change data.

with target as (
  select '83de6e77-e967-4df2-aa57-b9e9024d84e1'::uuid as campaign_id
),
hex_counts as (
  select
    count(*) filter (where h.base_terrain is not null) as generated_hexes,
    count(*) filter (where h.base_terrain is null) as legacy_hexes
  from public.hexes h
  join target t on t.campaign_id = h.campaign_id
),
poi_counts as (
  select
    count(*) as total_pois,
    count(*) filter (where h.base_terrain is not null) as pois_on_generated_hexes,
    count(*) filter (where h.base_terrain is null) as pois_on_legacy_hexes,
    count(*) filter (where p.hex_id is null) as pois_without_hexes
  from public.pois p
  join target t on t.campaign_id = p.campaign_id
  left join public.hexes h on h.id = p.hex_id
),
region_counts as (
  select
    count(*) as total_regions,
    count(*) filter (where r.region_type = 'geographic') as geographic_regions,
    count(*) filter (where r.region_type = 'political') as political_regions
  from public.regions r
  join target t on t.campaign_id = r.campaign_id
),
campaign_state as (
  select
    c.name,
    c.map_mode,
    c.generated_map_config->'grid' as generated_grid
  from public.campaigns c
  join target t on t.campaign_id = c.id
)
select
  campaign_state.name,
  campaign_state.map_mode,
  hex_counts.generated_hexes,
  hex_counts.legacy_hexes,
  poi_counts.total_pois,
  poi_counts.pois_on_generated_hexes,
  poi_counts.pois_on_legacy_hexes,
  poi_counts.pois_without_hexes,
  region_counts.total_regions,
  region_counts.geographic_regions,
  region_counts.political_regions,
  campaign_state.generated_grid
from campaign_state
cross join hex_counts
cross join poi_counts
cross join region_counts;
