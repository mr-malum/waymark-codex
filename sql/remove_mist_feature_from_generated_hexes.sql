-- =========================================================
-- Waymark Codex
-- One-time generated hex mist feature cleanup
-- =========================================================
--
-- Run after sql/generated_map_overlay_management.sql and
-- sql/generated_hex_terrain_management.sql are applied.
--
-- This converts existing generated hex "mist" features into editable mist
-- overlays, then removes only "mist" from terrain_features.
-- It does not delete campaigns, hexes, regions, POIs, or existing overlays.

select
  c.id as campaign_id,
  c.name as campaign_name,
  count(*) as hexes_with_mist_feature
from public.hexes h
join public.campaigns c on c.id = h.campaign_id
where c.map_mode = 'generated'
  and coalesce(h.terrain_features, '[]'::jsonb) ? 'mist'
group by c.id, c.name
order by c.name;

with mist_hexes as (
  select h.id, h.campaign_id
  from public.hexes h
  join public.campaigns c on c.id = h.campaign_id
  where c.map_mode = 'generated'
    and coalesce(h.terrain_features, '[]'::jsonb) ? 'mist'
),
inserted as (
  insert into public.generated_map_overlays (
    campaign_id,
    overlay_type,
    hex_id,
    edge,
    style,
    created_by
  )
  select
    mist_hexes.campaign_id,
    'mist',
    mist_hexes.id,
    null,
    'mist',
    auth.uid()
  from mist_hexes
  where not exists (
    select 1
    from public.generated_map_overlays existing_overlay
    where existing_overlay.campaign_id = mist_hexes.campaign_id
      and existing_overlay.overlay_type = 'mist'
      and existing_overlay.hex_id = mist_hexes.id
  )
  returning id
)
select count(*) as inserted_mist_overlays from inserted;

with cleaned as (
  select
    h.id,
    h.base_terrain,
    coalesce(
      jsonb_agg(feature.value order by feature.ordinality)
        filter (where feature.value <> 'mist'),
      '[]'::jsonb
    ) as terrain_features
  from public.hexes h
  join public.campaigns c on c.id = h.campaign_id
  cross join lateral jsonb_array_elements_text(coalesce(h.terrain_features, '[]'::jsonb))
    with ordinality as feature(value, ordinality)
  where c.map_mode = 'generated'
    and coalesce(h.terrain_features, '[]'::jsonb) ? 'mist'
  group by h.id, h.base_terrain
),
updated as (
  update public.hexes h
  set terrain_features = cleaned.terrain_features,
      terrain = public.format_hex_mapper_terrain(cleaned.base_terrain, cleaned.terrain_features),
      updated_at = now()
  from cleaned
  where h.id = cleaned.id
  returning h.id
)
select count(*) as cleaned_hexes from updated;

select
  c.id as campaign_id,
  c.name as campaign_name,
  count(*) as remaining_hexes_with_mist_feature
from public.hexes h
join public.campaigns c on c.id = h.campaign_id
where c.map_mode = 'generated'
  and coalesce(h.terrain_features, '[]'::jsonb) ? 'mist'
group by c.id, c.name
order by c.name;
