-- =========================================================
-- Waymark Codex
-- Merge duplicate Unclaimed Lands/Wilderness region into REG-0000
-- =========================================================
--
-- Run this only for the generated-map test campaign if both:
-- - REG-0000 / Wilderness exists
-- - another Unclaimed Lands region, such as REG-0006, also exists

do $$
declare
  target_campaign_id uuid := '83de6e77-e967-4df2-aa57-b9e9024d84e1';
  canonical_region_id uuid;
  duplicate_region_id uuid;
begin
  select id
    into canonical_region_id
  from public.regions
  where campaign_id = target_campaign_id
    and ref_code = 'REG-0000'
    and region_type = 'geographic'
  limit 1;

  select id
    into duplicate_region_id
  from public.regions
  where campaign_id = target_campaign_id
    and ref_code <> 'REG-0000'
    and region_type = 'geographic'
    and lower(name) = 'unclaimed lands'
  order by ref_code
  limit 1;

  if canonical_region_id is null then
    raise exception 'REG-0000 / Wilderness was not found.';
  end if;

  if duplicate_region_id is null then
    raise notice 'No duplicate Unclaimed Lands region found.';
    return;
  end if;

  update public.regions canonical
  set name = 'Wilderness',
      border_color = 'none',
      lore = coalesce(nullif(canonical.lore, ''), duplicate.lore),
      image_asset_id = coalesce(canonical.image_asset_id, duplicate.image_asset_id),
      updated_at = now()
  from public.regions duplicate
  where canonical.id = canonical_region_id
    and duplicate.id = duplicate_region_id;

  update public.hexes
  set region_id = canonical_region_id,
      updated_at = now()
  where campaign_id = target_campaign_id
    and region_id = duplicate_region_id;

  update public.hexes
  set geographic_region_id = canonical_region_id,
      updated_at = now()
  where campaign_id = target_campaign_id
    and geographic_region_id = duplicate_region_id;

  update public.hexes
  set political_region_id = canonical_region_id,
      updated_at = now()
  where campaign_id = target_campaign_id
    and political_region_id = duplicate_region_id;

  update public.maps
  set region_owner_id = canonical_region_id,
      updated_at = now()
  where campaign_id = target_campaign_id
    and region_owner_id = duplicate_region_id;

  update public.dm_journal
  set source_id = canonical_region_id
  where campaign_id = target_campaign_id
    and source_type = 'region'
    and source_id = duplicate_region_id;

  delete from public.regions
  where id = duplicate_region_id;

  update public.regions
  set border_color = 'none',
      updated_at = now()
  where id = canonical_region_id;
end;
$$;

select ref_code, name, region_type, border_color
from public.regions
where campaign_id = '83de6e77-e967-4df2-aa57-b9e9024d84e1'
  and lower(name) like '%unclaimed%'
order by ref_code;
